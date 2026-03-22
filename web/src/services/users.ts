// shared/services/users.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export type AppUser = {
  id?: string;
  uid?: string; // firebase auth uid
  email?: string;
  displayName?: string;
  role?: "admin" | "teacher" | "parent" | "student" | "guest";
  createdAt?: any;
};

const usersCollection = collection(db, "users");

/** Create or upsert a user profile after auth */
export async function upsertUser(profile: Partial<AppUser> & { uid: string }) {
  try {
    // attempt to find existing by uid
    const snap = await getDocs(query(usersCollection, where("uid", "==", profile.uid)));
    if (!snap.empty) {
      // update the first matched doc
      const docRef = snap.docs[0].ref;
      await updateDoc(docRef, { ...profile, updatedAt: new Date() });
      return { id: docRef.id, ...profile } as AppUser;
    } else {
      const ref = await addDoc(usersCollection, { ...profile, createdAt: new Date() });
      return { id: ref.id, ...profile } as AppUser;
    }
  } catch (err: any) {
    console.error("upsertUser error:", err.code ?? err);
    throw err;
  }
}

export async function getUserByUid(uid: string): Promise<AppUser | null> {
  try {
    const snap = await getDocs(query(usersCollection, where("uid", "==", uid)));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as any) } as AppUser;
  } catch (err: any) {
    console.error("getUserByUid error:", err.code ?? err);
    throw err;
  }
}

export async function getUserById(id: string): Promise<AppUser | null> {
  try {
    const d = await getDoc(doc(db, "users", id));
    if (!d.exists()) return null;
    return { id: d.id, ...(d.data() as any) } as AppUser;
  } catch (err: any) {
    console.error("getUserById error:", err.code ?? err);
    throw err;
  }
}

export async function listUsersByRole(role: AppUser["role"]): Promise<AppUser[]> {
  try {
    const snap = await getDocs(query(usersCollection, where("role", "==", role)));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AppUser));
  } catch (err: any) {
    console.error("listUsersByRole error:", err.code ?? err);
    throw err;
  }
}
