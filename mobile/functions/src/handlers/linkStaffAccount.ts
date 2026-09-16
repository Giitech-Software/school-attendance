import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/** Links a newly-created account to the staff record prepared by an administrator. */
export const linkStaffAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in before linking your staff account.");

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.data();
  const email = String(user?.email ?? request.auth?.token.email ?? "").trim().toLowerCase();
  const tenantId = String(user?.tenantId ?? "").trim();
  if (!email || !tenantId) return { linked: false, reason: "missing_account_details" };

  const matches = await db.collection("staff")
    .where("tenantId", "==", tenantId)
    .where("email", "==", email)
    .limit(2)
    .get();

  if (matches.empty) return { linked: false, reason: "staff_record_not_found" };
  if (matches.size > 1) throw new HttpsError("failed-precondition", "More than one staff record uses this email. Ask an administrator to correct it.");

  const staffDoc = matches.docs[0];
  const staff = staffDoc.data();
  if (staff.userUid && staff.userUid !== uid) {
    throw new HttpsError("already-exists", "This staff record is already linked to another account.");
  }

  if (staff.userUid === uid) {
    return { linked: true, staffId: staff.staffId ?? staffDoc.id, staffDocId: staffDoc.id };
  }

  await staffDoc.ref.update({ userUid: uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { linked: true, staffId: staff.staffId ?? staffDoc.id, staffDocId: staffDoc.id };
});
