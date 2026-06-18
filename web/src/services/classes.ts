// shared/services/classes.ts
import { collection, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export type ClassRecord = {
  id: string;
  name: string;
  classId: string;
  teacherId?: string;
  assignedStaffUids?: string[];
  description?: string;
  createdAt?: any;
  meta?: Record<string, any>;
};

export type SchoolClass = ClassRecord;

const classesCollection = collection(db, "classes");

/** Create a class */
export async function createClass(data: Omit<ClassRecord, "id" | "createdAt">): Promise<string> {
  try {
    const ref = await addDoc(classesCollection, {
      ...data,
      createdAt: Date.now(),
    });
    return ref.id;
  } catch (err: any) {
    console.error("createClass error:", err.code ?? err);
    throw err;
  }
}

/** Get a class by id */
export async function getClassById(id: string): Promise<ClassRecord | null> {
  try {
    const snap = await getDoc(doc(db, "classes", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as ClassRecord;
  } catch (err: any) {
    console.error("getClassById error:", err.code ?? err);
    throw err;
  }
}

/** Upsert a class */
export async function upsertClass(cls: ClassRecord): Promise<string> {
  try {
    if (cls.id) {
      await setDoc(doc(db, "classes", cls.id), cls, { merge: true });
      return cls.id;
    }

    return createClass({
      name: cls.name,
      classId: cls.classId,
      teacherId: cls.teacherId,
      assignedStaffUids: cls.assignedStaffUids ?? [],
      description: cls.description,
      meta: cls.meta ?? {},
    });
  } catch (err: any) {
    console.error("upsertClass error:", err.code ?? err);
    throw err;
  }
}

export async function updateClass(id: string, patch: Partial<ClassRecord>): Promise<void> {
  await setDoc(doc(db, "classes", id), patch, { merge: true });
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

/** List classes (non-paginated) */
export async function listClasses(): Promise<ClassRecord[]> {
  try {
    const q = query(classesCollection, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ClassRecord));
  } catch (err: any) {
    console.error("listClasses error:", err.code ?? err);
    throw err;
  }
}
