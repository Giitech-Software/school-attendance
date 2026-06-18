// mobile/src/services/classes.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { logAdminAction } from "./adminLogs";

export type ClassRecord = {
  id: string;
  name: string;
  classId: string; // short unique id such as "P4A" or "class-101"
  teacherId?: string; // uid of teacher
  assignedStaffUids?: string[];
  description?: string;
  createdAt?: any;
  meta?: Record<string, any>;
};

const CLASSES_COLLECTION = "classes";

/** Create a class (returns new id) */
export async function createClass(cls: Omit<ClassRecord, "id" | "createdAt">): Promise<string> {
  try {
    const colRef = collection(db, CLASSES_COLLECTION);
    const docRef = await addDoc(colRef, {
      ...cls,
      createdAt: Date.now(), // client timestamp; you can switch to serverTimestamp() if preferred
    });
    await logAdminAction({
      action: "CREATE_CLASS",
      targetType: "class",
      targetId: docRef.id,
      description: `Created class ${cls.name}`,
      metadata: {
        classId: cls.classId,
        name: cls.name,
        assignedStaffCount: cls.assignedStaffUids?.length ?? 0,
      },
    });
    return docRef.id;
  } catch (err) {
    console.error("createClass error:", err);
    throw err;
  }
}

/** List classes (non-paginated) */
export async function listClasses(): Promise<ClassRecord[]> {
  try {
    const q = query(collection(db, CLASSES_COLLECTION), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ClassRecord));
  } catch (err) {
    console.error("listClasses error:", err);
    throw err;
  }
}

/** Get class by document id */
export async function getClassById(id: string): Promise<ClassRecord | null> {
  try {
    const ref = doc(db, CLASSES_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as ClassRecord;
  } catch (err) {
    console.error("getClassById error:", err);
    throw err;
  }
}

/** Upsert class (create or update) */
export async function upsertClass(cls: ClassRecord): Promise<string> {
  try {
    if (cls.id) {
      const ref = doc(db, CLASSES_COLLECTION, cls.id);
      await setDoc(ref, { ...cls }, { merge: true });
      await logAdminAction({
        action: "EDIT_CLASS",
        targetType: "class",
        targetId: cls.id,
        description: `Updated class ${cls.name}`,
        metadata: {
          classId: cls.classId,
          name: cls.name,
          assignedStaffCount: cls.assignedStaffUids?.length ?? 0,
        },
      });
      return cls.id;
    } else {
      return await createClass({
        name: cls.name,
        classId: cls.classId,
        teacherId: cls.teacherId,
        assignedStaffUids: cls.assignedStaffUids ?? [],
        description: cls.description,
        meta: cls.meta ?? {},
      });
    }
  } catch (err) {
    console.error("upsertClass error:", err);
    throw err;
  }
}

/** Delete a class */
export async function deleteClass(id: string): Promise<void> {
  try {
    const ref = doc(db, CLASSES_COLLECTION, id);
    await deleteDoc(ref);
    await logAdminAction({
      action: "DELETE_CLASS",
      targetType: "class",
      targetId: id,
      description: "Deleted class",
    });
  } catch (err) {
    console.error("deleteClass error:", err);
    throw err;
  }
}
