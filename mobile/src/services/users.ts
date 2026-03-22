import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { type UserRole } from "./constants/roles";

/* ---------------- Types ---------------- */
 

export async function updateUserApproval(
  uid: string,
  approved: boolean
) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    approved,
  });
}


export type AppUser = {
  id?: string;
  uid?: string;
  displayName?: string | null;
  role?: UserRole | null;
  email?: string | null;
  createdAt?: any;
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
    const q = query(
      collection(db, USERS_COLLECTION),
      orderBy("createdAt", "desc")
    );

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

    if (!snap.exists()) return null;

    const data = snap.data() as any;

    return {
      id: snap.id,
      uid: data.uid ?? snap.id,
      displayName: data.displayName ?? null,
      role: data.role ?? null,
      email: data.email ?? null,
      createdAt: data.createdAt ?? Date.now(),

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
  {
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
  },
  { merge: true }
);


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
  } catch (err) {
    console.error("deleteUser error:", err);
    throw err;
  }
}
