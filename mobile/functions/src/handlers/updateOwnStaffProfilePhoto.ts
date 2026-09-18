import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const updateOwnStaffProfilePhoto = onCall(async (request) => {
  const uid = request.auth?.uid;
  const staffId = typeof request.data?.staffId === "string" ? request.data.staffId : "";
  const profilePhotoUrl = typeof request.data?.profilePhotoUrl === "string" ? request.data.profilePhotoUrl : "";
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to update your profile photo.");
  if (!staffId || !profilePhotoUrl) throw new HttpsError("invalid-argument", "Missing profile photo details.");
  const db = admin.firestore();
  const [userSnap, staffSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`staff/${staffId}`).get()]);
  const user = userSnap.data(); const staff = staffSnap.data();
  if (!staff || !user || (staff.userUid !== uid && String(staff.email ?? "").toLowerCase() !== String(user.email ?? "").toLowerCase())) {
    throw new HttpsError("permission-denied", "You can only update your own staff profile photo.");
  }
  await staffSnap.ref.update({ profilePhotoUrl, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true, profilePhotoUrl };
});
