import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { type UserRole } from "./constants/roles";
import { logAdminAction } from "./adminLogs";
import { belongsToTenant, getTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

/* ---------------- Types ---------------- */
 

export async function updateUserApproval(
  uid: string,
  approved: boolean
) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    approved,
  });
  await logAdminAction({
    action: "UPDATE_USER_APPROVAL",
    targetType: "user",
    targetId: uid,
    description: `${approved ? "Approved" : "Unapproved"} user account`,
    metadata: { approved },
  });
}


export type AppUser = {
  id?: string;
  uid?: string;
  displayName?: string | null;
  role?: UserRole | null;
  email?: string | null;
  createdAt?: any;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantType?: string | null;
  tenantInviteCode?: string | null;
  wards?: string[];

  // 🔐 NEW — authorization fields
  approved?: boolean;
  canTakeStaffAttendance?: boolean;
  canTakeStudentAttendance?: boolean;
};

const USERS_COLLECTION = "users";

/* ---------------- List users ---------------- */

export async function listUsers(): Promise<AppUser[]> {
  try {
    const scope = await getTenantScope();
    const q = scope.isScoped
      ? query(collection(db, USERS_COLLECTION), ...tenantConstraints(scope))
      : query(collection(db, USERS_COLLECTION), orderBy("createdAt", "desc"));

    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data() as any;

      return {
        id: d.id,
        uid: data.uid ?? d.id,
        displayName: data.displayName ?? null,
        role: data.role ?? null,
        email: data.email ?? null,
        createdAt: data.createdAt ?? Date.now(),
        tenantId: data.tenantId ?? null,
        tenantName: data.tenantName ?? null,
        tenantType: data.tenantType ?? null,
    tenantInviteCode: data.tenantInviteCode ?? null,
        
// ✅ SAFE DEFAULT
        wards: Array.isArray(data.wards) ? data.wards : [],
        approved: Boolean(data.approved),
        canTakeStaffAttendance: Boolean(data.canTakeStaffAttendance),
        canTakeStudentAttendance: Boolean(data.canTakeStudentAttendance),
      } as AppUser;
    });
  } catch (err) {
    console.error("listUsers error:", err);
    throw err;
  }
}


/* ---------------- Get user by ID ---------------- */

export async function getUserById(id: string): Promise<AppUser | null> {
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, id));

    const scope = await getTenantScope();
    if (!snap.exists() || !belongsToTenant(snap.data(), scope)) return null;

    const data = snap.data() as any;

    return {
      id: snap.id,
      uid: data.uid ?? snap.id,
      displayName: data.displayName ?? null,
      role: data.role ?? null,
      email: data.email ?? null,
      createdAt: data.createdAt ?? Date.now(),
      tenantId: data.tenantId ?? null,
      tenantName: data.tenantName ?? null,
      tenantType: data.tenantType ?? null,
    tenantInviteCode: data.tenantInviteCode ?? null,

      // SAFE DEFAULTS
      wards: Array.isArray(data.wards) ? data.wards : [],
      approved: Boolean(data.approved),
      canTakeStaffAttendance: Boolean(data.canTakeStaffAttendance),
      canTakeStudentAttendance: Boolean(data.canTakeStudentAttendance),
    } as AppUser;
  } catch (err) {
    console.error("getUserById error:", err);
    throw err;
  }
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  try {
    const scope = await getTenantScope();
    const q = query(
      collection(db, USERS_COLLECTION),
      where("email", "==", email),
      ...tenantConstraints(scope),
    );

    const snap = await getDocs(q);
    if (snap.empty) return null;

    const userDoc = snap.docs[0];
    const data = userDoc.data() as any;

    return {
      id: userDoc.id,
      uid: data.uid ?? userDoc.id,
      displayName: data.displayName ?? null,
      role: data.role ?? null,
      email: data.email ?? null,
      createdAt: data.createdAt ?? Date.now(),
      tenantId: data.tenantId ?? null,
      tenantName: data.tenantName ?? null,
      tenantType: data.tenantType ?? null,
    tenantInviteCode: data.tenantInviteCode ?? null,
      wards: Array.isArray(data.wards) ? data.wards : [],
      approved: Boolean(data.approved),
      canTakeStaffAttendance: Boolean(data.canTakeStaffAttendance),
      canTakeStudentAttendance: Boolean(data.canTakeStudentAttendance),
    } as AppUser;
  } catch (err) {
    console.error("getUserByEmail error:", err);
    throw err;
  }
}
 

/* ---------------- Upsert user ---------------- */

/**
 * Upsert user (always use UID as document ID)
 * This is merge-safe and backward-compatible
 */
export async function upsertUser(user: AppUser): Promise<string> {
  try {
    if (!user.id) {
      throw new Error("User id is required (must be UID)");
    }

    const ref = doc(db, USERS_COLLECTION, user.id);

   await setDoc(
  ref,
  withTenantScope({
    uid: user.id,

    ...(user.displayName !== undefined && {
      displayName: user.displayName,
    }),

    ...(user.email !== undefined && {
      email: user.email,
    }),

    ...(user.role !== undefined && {
      role: user.role,
    }),

    ...(user.tenantId !== undefined && {
      tenantId: user.tenantId,
    }),

    ...(user.tenantName !== undefined && {
      tenantName: user.tenantName,
    }),

    ...(user.tenantType !== undefined && {
      tenantType: user.tenantType,
    }),

    ...(user.tenantInviteCode !== undefined && {
      tenantInviteCode: user.tenantInviteCode,
    }),

    ...(user.approved !== undefined && {
      approved: user.approved,
    }),

    ...(user.canTakeStaffAttendance !== undefined && {
      canTakeStaffAttendance: user.canTakeStaffAttendance,
    }),

    ...(user.canTakeStudentAttendance !== undefined && {
      canTakeStudentAttendance: user.canTakeStudentAttendance,
    }),

    ...(user.wards !== undefined && {
      wards: user.wards,
    }),

    createdAt: user.createdAt ?? serverTimestamp(),
  }, await getTenantScope()),
  { merge: true }
);
    await logAdminAction({
      action: "UPSERT_USER",
      targetType: "user",
      targetId: user.id,
      description: `Updated user ${user.displayName ?? user.email ?? user.id}`,
      metadata: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        approved: user.approved,
        canTakeStaffAttendance: user.canTakeStaffAttendance,
        canTakeStudentAttendance: user.canTakeStudentAttendance,
        wardsCount: user.wards?.length,
      },
    });


    return user.id;
  } catch (err) {
    console.error("upsertUser error:", err);
    throw err;
  }
}

/* ---------------- Delete user ---------------- */

export async function deleteUser(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, id));
    await logAdminAction({
      action: "DELETE_USER",
      targetType: "user",
      targetId: id,
      description: "Deleted user account",
    });
  } catch (err) {
    console.error("deleteUser error:", err);
    throw err;
  }
}





