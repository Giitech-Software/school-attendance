import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

const AWS_ACCESS_KEY_ID = defineSecret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = defineSecret("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = defineSecret("AWS_REGION");
const AWS_LIVENESS_ROLE_ARN = defineSecret("AWS_LIVENESS_ROLE_ARN");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function rekognition() {
  const { RekognitionClient } = await import("@aws-sdk/client-rekognition");
  return new RekognitionClient({
    region: AWS_REGION.value().trim() || "us-east-1",
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID.value().trim(),
      secretAccessKey: AWS_SECRET_ACCESS_KEY.value().trim(),
    },
  });
}

async function authenticatedUser(req: Parameters<typeof onRequest>[0] extends never ? never : any) {
  const header = String(req.headers.authorization ?? "");
  if (!header.startsWith("Bearer ")) throw new Error("Authentication is required.");
  return admin.auth().verifyIdToken(header.slice("Bearer ".length));
}

function profileTenantId(profile: any, token: any) {
  return String(profile?.tenantId ?? token?.tenantId ?? "").trim();
}

export const createFaceLivenessSession = onRequest(
  { cors: true, secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_LIVENESS_ROLE_ARN] },
  async (req, res): Promise<void> => {
    try {
      if (req.method !== "POST") { res.status(405).json({ error: "POST required" }); return; }
      const user = await authenticatedUser(req);
      const profile = (await db.collection("users").doc(user.uid).get()).data() as any;
      const role = String(profile?.role ?? user.role ?? "");
      const tenantId = profileTenantId(profile, user);
      const isSuperAdmin = role === "super_admin" || role === "superadmin";
      if (!tenantId && !isSuperAdmin) { res.status(403).json({ error: "Your account is not assigned to an organisation. Add tenantId to your user profile." }); return; }
      if (!["admin", "super_admin", "superadmin", "teacher", "staff", "non_teaching_staff", "general_staff"].includes(role)) { res.status(403).json({ error: "This account cannot start liveness verification." }); return; }

      const { CreateFaceLivenessSessionCommand } = await import("@aws-sdk/client-rekognition");
      const result = await (await rekognition()).send(new CreateFaceLivenessSessionCommand({
        Settings: { AuditImagesLimit: 0 },
      }));
      if (!result.SessionId) { res.status(502).json({ error: "AWS did not return a liveness session." }); return; }
      await db.collection("faceLivenessSessions").doc(result.SessionId).set({ uid: user.uid, tenantId, status: "CREATED", createdAt: admin.firestore.FieldValue.serverTimestamp() });
      res.json({ sessionId: result.SessionId });
    } catch (error: any) {
      console.error("createFaceLivenessSession error", error);
      res.status(error?.code === "auth/id-token-expired" ? 401 : 500).json({ error: error?.message ?? "Could not create liveness session." });
    }
  },
);

export const getFaceLivenessSessionResults = onRequest(
  { cors: true, secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION] },
  async (req, res): Promise<void> => {
    try {
      if (req.method !== "POST") { res.status(405).json({ error: "POST required" }); return; }
      const user = await authenticatedUser(req);
      const sessionId = String(req.body?.sessionId ?? "").trim();
      if (!sessionId) { res.status(400).json({ error: "sessionId is required." }); return; }
      const sessionRef = db.collection("faceLivenessSessions").doc(sessionId);
      const session = (await sessionRef.get()).data() as any;
      if (!session || session.uid !== user.uid) { res.status(404).json({ error: "Liveness session not found." }); return; }
      const profile = (await db.collection("users").doc(user.uid).get()).data() as any;
      const tenantId = profileTenantId(profile, user);
      const role = String(profile?.role ?? user.role ?? "");
      const isSuperAdmin = role === "super_admin" || role === "superadmin";
      if ((!tenantId && !isSuperAdmin) || session.tenantId !== tenantId) { res.status(403).json({ error: "Liveness session tenant mismatch." }); return; }

      const { GetFaceLivenessSessionResultsCommand } = await import("@aws-sdk/client-rekognition");
      const result = await (await rekognition()).send(new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }));
      await sessionRef.set({ status: result.Status ?? "UNKNOWN", confidence: result.Confidence ?? null, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      res.json({ sessionId, status: result.Status, confidence: result.Confidence ?? null });
    } catch (error: any) {
      console.error("getFaceLivenessSessionResults error", error);
      res.status(error?.code === "auth/id-token-expired" ? 401 : 500).json({ error: error?.message ?? "Could not retrieve liveness results." });
    }
  },
);

export const getFaceLivenessCredentials = onRequest(
  { cors: true, secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_LIVENESS_ROLE_ARN] },
  async (req, res) => {
    try {
      const user = await authenticatedUser(req);
      const sessionId = String(req.body?.sessionId ?? "");
      if (!sessionId) { res.status(400).json({ error: "sessionId is required." }); return; }
      const profile = (await db.collection("users").doc(user.uid).get()).data() as any;
      const tenantId = profileTenantId(profile, user);
      const session = await db.doc(`faceLivenessSessions/${sessionId}`).get();
      if (!session.exists || session.data()?.uid !== user.uid || session.data()?.tenantId !== tenantId) {
        res.status(403).json({ error: "This liveness session is not available to this account." }); return;
      }
      const { AssumeRoleCommand, STSClient } = await import("@aws-sdk/client-sts");
      const roleSessionName = `liveness-${user.uid.slice(0, 16)}-${sessionId.replace(/[^A-Za-z0-9+=,.@_-]/g, "").slice(0, 32)}`.slice(0, 64);
      const assumed = await new STSClient({
        region: AWS_REGION.value().trim() || "us-east-1",
        credentials: { accessKeyId: AWS_ACCESS_KEY_ID.value(), secretAccessKey: AWS_SECRET_ACCESS_KEY.value() },
      }).send(new AssumeRoleCommand({
        RoleArn: AWS_LIVENESS_ROLE_ARN.value(),
        RoleSessionName: roleSessionName,
        DurationSeconds: 900,
      }));
      const credentials = assumed.Credentials;
      if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
        res.status(502).json({ error: "AWS did not return temporary credentials." }); return;
      }
      res.json({ accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretAccessKey, sessionToken: credentials.SessionToken, expiration: credentials.Expiration });
    } catch (error: any) {
      console.error("getFaceLivenessCredentials error", error);
      res.status(error?.code === "auth/id-token-expired" ? 401 : 500).json({ error: error?.message ?? "Could not create liveness credentials." });
    }
  },
);
