// src/services/updateUserRole.ts
import { db } from '../../app/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { logAdminAction } from '../utils/logAdminAction.ts.bak';

/**
 * Updates the role of a user and logs the action.
 * @param adminUid UID of the admin performing the action
 * @param targetUid UID of the user being updated
 * @param newRole New role to assign
 */
export async function updateUserRole(adminUid: string, targetUid: string, newRole: string) {
  try {
    const userRef = doc(db, 'users', targetUid);

    // Get the previous role
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Target user does not exist.');
    const previousRole = userSnap.data().role;

    // Update role
    await updateDoc(userRef, { role: newRole });

    // Log the action
    await logAdminAction({
      performedBy: adminUid,
      action: 'UPDATE_ROLE',
      targetUser: targetUid,
      previousRole,
      newRole,
    });

    console.log(`User role updated successfully: ${previousRole} → ${newRole}`);
  } catch (err: any) {
    console.error('Error updating user role:', err.message || err);
    throw err;
  }
}
