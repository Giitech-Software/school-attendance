// shared/services/classes.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
//import type { Term } from "../types";

export type SchoolClass = {
  id?: string;
  name: string;
  teacherId?: string;
  createdAt?: any;
  metadata?: Record<string, unknown>;
};

const classesCollection = collection(db, "classes");

/** Create a class */
export async function createClass(data: Omit<SchoolClass, "id" | "createdAt">): Promise<SchoolClass> {
  try {
    const ref = await addDoc(classesCollection, {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, ...data } as SchoolClass;
  } catch (err: any) {
    console.error("createClass error:", err.code ?? err);
    throw err;
  }
}

/** Get a class by id */
export async function getClassById(id: string): Promise<SchoolClass | null> {
  try {
    const snap = await getDoc(doc(db, "classes", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as SchoolClass;
  } catch (err: any) {
    console.error("getClassById error:", err.code ?? err);
    throw err;
  }
}

/** Update a class */
export async function updateClass(id: string, patch: Partial<SchoolClass>): Promise<void> {
  try {
    await updateDoc(doc(db, "classes", id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    console.error("updateClass error:", err.code ?? err);
    throw err;
  }
}

/** Delete a class */
export async function deleteClass(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "classes", id));
  } catch (err: any) {
    console.error("deleteClass error:", err.code ?? err);
    throw err;
  }
}

/** List classes (optionally ordered by name) */
export async function listClasses(): Promise<SchoolClass[]> {
  try {
    const q = query(classesCollection, orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as SchoolClass));
  } catch (err: any) {
    console.error("listClasses error:", err.code ?? err);
    throw err;
  }
}
