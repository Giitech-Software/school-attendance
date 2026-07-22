// shared/services/classes.ts
import { collection, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { belongsToTenant, getTenantScope, sortByCreatedAtDesc, tenantConstraints, withTenantScope } from "./tenantScope";

export type ClassRecord = {
  id: string;
  name: string;
  classId: string;
  teacherId?: string;
  assignedStaffUids?: string[];
  description?: string;
  createdAt?: any;
  meta?: Record<string, any>;
  tenantId?: string | null;
  tenantName?: string | null;
};

export type SchoolClass = ClassRecord;

const classesCollection = collection(db, "classes");

export async function createClass(data: Omit<ClassRecord, "id" | "createdAt">): Promise<string> {
  try {
    const scope = await getTenantScope();
    const ref = await addDoc(classesCollection, withTenantScope({ ...data, createdAt: Date.now() }, scope));
    return ref.id;
  } catch (err: any) {
    console.error("createClass error:", err.code ?? err);
    throw err;
  }
}

export async function getClassById(id: string): Promise<ClassRecord | null> {
  try {
    const snap = await getDoc(doc(db, "classes", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!belongsToTenant(data, await getTenantScope())) return null;
    return { id: snap.id, ...(data as any) } as ClassRecord;
  } catch (err: any) {
    console.error("getClassById error:", err.code ?? err);
    throw err;
  }
}

export async function upsertClass(cls: ClassRecord): Promise<string> {
  try {
    const scope = await getTenantScope();
    if (cls.id) {
      await setDoc(doc(db, "classes", cls.id), withTenantScope(cls, scope), { merge: true });
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
  await setDoc(doc(db, "classes", id), withTenantScope(patch, await getTenantScope()), { merge: true });
}

export async function deleteClass(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "classes", id));
  } catch (err: any) {
    console.error("deleteClass error:", err.code ?? err);
    throw err;
  }
}

export async function listClasses(): Promise<ClassRecord[]> {
  try {
    const scope = await getTenantScope();
    const q = scope.isScoped ? query(classesCollection, ...tenantConstraints(scope)) : query(classesCollection, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ClassRecord)));
  } catch (err: any) {
    console.error("listClasses error:", err.code ?? err);
    throw err;
  }
}
