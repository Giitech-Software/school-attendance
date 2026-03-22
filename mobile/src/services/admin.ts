// src/services/admin.ts
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../app/firebase";

export async function updateUserRole(
  userId: string,
  newRole: string,
  adminUid?: string // optional: the UID of the admin making the change
) {
  if (!adminUid) throw new Error("Admin UID required to update roles");

  const userRef = doc(db, "users", userId);

  // 1️⃣ Update the user's role
  await updateDoc(userRef, { role: newRole });

  // 2️⃣ Log the action in /logs/adminActions
  const logRef = collection(db, "logs", "adminActions", "actions"); // subcollection
  await addDoc(logRef, {
    userId,
    newRole,
    changedBy: adminUid,
    timestamp: serverTimestamp(),
  });
}
