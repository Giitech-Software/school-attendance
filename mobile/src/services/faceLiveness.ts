import { auth } from "../../app/firebase";
import { Platform } from "react-native";

const PROJECT_ID = "astem-student-register";
const REGION = "us-central1";
const AWS_REGION = "us-east-1";

const endpoint = (name: string) => `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;

async function call(name: string, body: unknown) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in before starting face liveness.");
  const token = await user.getIdToken();
  const response = await fetch(endpoint(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error ?? `Face liveness request failed (${response.status}).`);
  return data;
}

export async function createMobileFaceLivenessSession(): Promise<{ sessionId: string; region: string }> {
  const data = await call("createFaceLivenessSession", {});
  return { sessionId: data.sessionId, region: AWS_REGION };
}

export async function getMobileFaceLivenessCredentials(sessionId: string) {
  const data = await call("getFaceLivenessCredentials", { sessionId });
  return {
    ...data,
    expiration: data.expiration ? new Date(data.expiration).toISOString() : undefined,
  };
}

export async function completeMobileFaceLiveness(sessionId: string) {
  const result = await call("getFaceLivenessSessionResults", { sessionId });
  if (result.status !== "SUCCEEDED" || Number(result.confidence ?? 0) < 80) {
    throw new Error("Liveness verification was not strong enough. Please try again in good lighting.");
  }
  return result as { sessionId: string; status: string; confidence: number };
}

export async function runMobileFaceLiveness() {
  const { startNativeFaceLiveness } = await import("./nativeFaceLiveness");
  const session = await createMobileFaceLivenessSession();
  if (Platform.OS !== "android") {
    throw new Error("Mobile Face Liveness is not available on iOS until the native iOS bridge is installed.");
  }
  await startNativeFaceLiveness(session.sessionId, session.region);
  return completeMobileFaceLiveness(session.sessionId);
}
