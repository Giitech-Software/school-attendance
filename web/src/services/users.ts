// shared/services/users.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export type UserRole =
  | "admin"
  | "teacher"
  | "parent"
  | "student"
  | "staff"
  | "non_teaching_staff"
  | "general_staff"
  | "guest";

export type AppUser = {
  id?: string;
  uid?: string; // firebase auth uid
  email?: string | null;
  displayName?: string | null;
  role?: UserRole | null;
  wards?: string[];
  approved?: boolean;
  canTakeStaffAttendance?: boolean;
  canTakeStudentAttendance?: boolean;
  createdAt?: any;
};

const usersCollection = collection(db, "users");

function normalizeUser(id: string, data: any): AppUser {
  return {
    id,
    uid: data.uid ?? id,
    displayName: data.displayName ?? null,
    role: data.role ?? null,
    email: data.email ?? null,
    createdAt: data.createdAt ?? Date.now(),
    wards: Array.isArray(data.wards) ? data.wards : [],
    approved: Boolean(data.approved),
    canTakeStaffAttendance: Boolean(data.canTakeStaffAttendance),
    canTakeStudentAttendance: Boolean(data.canTakeStudentAttendance),
  };
}

/** Create or upsert a user profile after auth */
export async function upsertUser(profile: Partial<AppUser> & { uid: string }) {
  try {
    const id = profile.id ?? profile.uid;
    const ref = doc(db, "users", id);
    await setDoc(
      ref,
      {
        uid: profile.uid,
        ...(profile.displayName !== undefined && { displayName: profile.displayName }),
        ...(profile.email !== undefined && { email: profile.email }),
        ...(profile.role !== undefined && { role: profile.role }),
        ...(profile.approved !== undefined && { approved: profile.approved }),
        ...(profile.canTakeStaffAttendance !== undefined && {
          canTakeStaffAttendance: profile.canTakeStaffAttendance,
        }),
        ...(profile.canTakeStudentAttendance !== undefined && {
          canTakeStudentAttendance: profile.canTakeStudentAttendance,
        }),
        ...(profile.wards !== undefined && { wards: profile.wards }),
        createdAt: profile.createdAt ?? serverTimestamp(),
      },
      { merge: true }
    );
    return { id, ...profile } as AppUser;
  } catch (err: any) {
    console.error("upsertUser error:", err.code ?? err);
    throw err;
  }
}

export async function createUser(data: Omit<AppUser, "id" | "createdAt">): Promise<AppUser> {
  try {
    const ref = await addDoc(usersCollection, {
      ...data,
      createdAt: new Date(),
    });
    return { id: ref.id, ...data } as AppUser;
  } catch (err: any) {
    console.error("createUser error:", err.code ?? err);
    throw err;
  }
}

export async function listUsers(): Promise<AppUser[]> {
  try {
    const snap = await getDocs(query(usersCollection, orderBy("createdAt", "desc")));
    return snap.docs.map((d) => normalizeUser(d.id, d.data()));
  } catch (err: any) {
    console.error("listUsers error:", err.code ?? err);
    throw err;
  }
}

export async function getUserByUid(uid: string): Promise<AppUser | null> {
  try {
    const direct = await getDoc(doc(db, "users", uid));
    if (direct.exists()) return normalizeUser(direct.id, direct.data());

    const snap = await getDocs(query(usersCollection, where("uid", "==", uid)));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return normalizeUser(d.id, d.data());
  } catch (err: any) {
    console.error("getUserByUid error:", err.code ?? err);
    throw err;
  }
}

export async function getUserById(id: string): Promise<AppUser | null> {
  try {
    const d = await getDoc(doc(db, "users", id));
    if (!d.exists()) return null;
    return normalizeUser(d.id, d.data());
  } catch (err: any) {
    console.error("getUserById error:", err.code ?? err);
    throw err;
  }
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  try {
    const snap = await getDocs(query(usersCollection, where("email", "==", email)));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return normalizeUser(d.id, d.data());
  } catch (err: any) {
    console.error("getUserByEmail error:", err.code ?? err);
    throw err;
  }
}

export async function listUsersByRole(role: AppUser["role"]): Promise<AppUser[]> {
  try {
    const snap = await getDocs(query(usersCollection, where("role", "==", role)));
    return snap.docs.map((d) => normalizeUser(d.id, d.data()));
  } catch (err: any) {
    console.error("listUsersByRole error:", err.code ?? err);
    throw err;
  }
}

export async function updateUserApproval(uid: string, approved: boolean) {
  await updateDoc(doc(db, "users", uid), { approved });
}

export async function deleteUser(id: string): Promise<void> {
  await deleteDoc(doc(db, "users", id));
}
