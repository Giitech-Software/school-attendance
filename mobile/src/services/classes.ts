// mobile/src/services/classes.ts
import { collection, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../../app/firebase";
import { logAdminAction } from "./adminLogs";
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

const CLASSES_COLLECTION = "classes";

export async function createClass(cls: Omit<ClassRecord, "id" | "createdAt">): Promise<string> {
  try {
    const scope = await getTenantScope();
    const colRef = collection(db, CLASSES_COLLECTION);
    const docRef = await addDoc(colRef, withTenantScope({ ...cls, createdAt: Date.now() }, scope));
    await logAdminAction({
      action: "CREATE_CLASS",
      targetType: "class",
      targetId: docRef.id,
      description: `Created class ${cls.name}`,
      metadata: { classId: cls.classId, name: cls.name, assignedStaffCount: cls.assignedStaffUids?.length ?? 0 },
    });
    return docRef.id;
  } catch (err) {
    console.error("createClass error:", err);
    throw err;
  }
}

export async function listClasses(): Promise<ClassRecord[]> {
  try {
    const scope = await getTenantScope();
    const q = scope.isScoped ? query(collection(db, CLASSES_COLLECTION), ...tenantConstraints(scope)) : query(collection(db, CLASSES_COLLECTION), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ClassRecord)));
  } catch (err) {
    console.error("listClasses error:", err);
    throw err;
  }
}

export async function getClassById(id: string): Promise<ClassRecord | null> {
  try {
    const ref = doc(db, CLASSES_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!belongsToTenant(data, await getTenantScope())) return null;
    return { id: snap.id, ...(data as any) } as ClassRecord;
  } catch (err) {
    console.error("getClassById error:", err);
    throw err;
  }
}

export async function upsertClass(cls: ClassRecord): Promise<string> {
  try {
    if (cls.id) {
      const ref = doc(db, CLASSES_COLLECTION, cls.id);
      await setDoc(ref, withTenantScope({ ...cls }, await getTenantScope()), { merge: true });
      await logAdminAction({
        action: "EDIT_CLASS",
        targetType: "class",
        targetId: cls.id,
        description: `Updated class ${cls.name}`,
        metadata: { classId: cls.classId, name: cls.name, assignedStaffCount: cls.assignedStaffUids?.length ?? 0 },
      });
      return cls.id;
    }

    return await createClass({
      name: cls.name,
      classId: cls.classId,
      teacherId: cls.teacherId,
      assignedStaffUids: cls.assignedStaffUids ?? [],
      description: cls.description,
      meta: cls.meta ?? {},
    });
  } catch (err) {
    console.error("upsertClass error:", err);
    throw err;
  }
}

export async function deleteClass(id: string): Promise<void> {
  try {
    const ref = doc(db, CLASSES_COLLECTION, id);
    await deleteDoc(ref);
    await logAdminAction({ action: "DELETE_CLASS", targetType: "class", targetId: id, description: "Deleted class" });
  } catch (err) {
    console.error("deleteClass error:", err);
    throw err;
  }
}
