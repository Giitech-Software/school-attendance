// src/services/admin.ts
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import { logAdminAction } from "./adminLogs";

export async function updateUserRole(
  userId: string,
  newRole: string,
  adminUid?: string
) {
  if (!adminUid) throw new Error("Admin UID required to update roles");

  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { role: newRole });

  await logAdminAction({
    action: "ROLE_CHANGE",
    targetType: "user",
    targetId: userId,
    description: `Changed user role to ${newRole}`,
    metadata: {
      adminUid,
      newRole,
    },
  });
}
