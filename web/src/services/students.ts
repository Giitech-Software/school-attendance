import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  limit,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Student } from "../types";
import { getClassById } from "./classes";
import { belongsToTenant, getTenantScope, sortByCreatedAtDesc, tenantConstraints, withTenantScope } from "./tenantScope";

export type { Student };

const studentsCollection = collection(db, "students");

function withShortId(id: string, data: any): Student {
  return {
    id,
    shortId: id.slice(0, 6),
    ...data,
    studentId: data.studentId ?? data.studentCode,
  } as Student;
}

async function findClassDocIdForShortId(shortClassId?: string): Promise<string | null> {
  if (!shortClassId) return null;

  try {
    const scope = await getTenantScope();
    const q = query(collection(db, "classes"), where("classId", "==", shortClassId), ...tenantConstraints(scope), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
  } catch (err) {
    console.error("findClassDocIdForShortId error:", err);
  }

  return null;
}

async function nextStudentId() {
  const scope = await getTenantScope();
  const snap = await getDocs(query(studentsCollection, ...tenantConstraints(scope)));
  const maxNumber = snap.docs.reduce((max, studentDoc) => {
    const lastId: string = studentDoc.data()?.studentId ?? studentDoc.data()?.studentCode ?? "";
    const match = lastId.match(/\d+$/);
    return match ? Math.max(max, Number(match[0])) : max;
  }, 0);
  return `STU-${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function createStudent(data: Omit<Student, "id" | "createdAt">): Promise<Student> {
  try {
    const scope = await getTenantScope();
    const payload: any = withTenantScope({
      ...data,
      createdAt: serverTimestamp(),
    }, scope);

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
    });

    if (!payload.studentId) payload.studentId = await nextStudentId();

    if (payload.classId) {
      const classDocId = await findClassDocIdForShortId(payload.classId);
      if (classDocId) payload.classDocId = classDocId;
    }

    const ref = await addDoc(studentsCollection, payload);
    const snap = await getDoc(ref);
    return withShortId(ref.id, snap.data());
  } catch (error: any) {
    console.error("createStudent error:", error.code, error.message);
    throw error;
  }
}

export async function upsertStudent(student: Partial<Student> & { id?: string }): Promise<Student> {
  if (!student.id) {
    return createStudent(student as Omit<Student, "id" | "createdAt">);
  }

  const ref = doc(db, "students", student.id);
  const patch: any = withTenantScope({ updatedAt: serverTimestamp() }, await getTenantScope());

  for (const [key, value] of Object.entries(student)) {
    if (key === "id") continue;
    patch[key] = value === undefined ? deleteField() : value;
  }

  if (student.classId) {
    const cls = await getClassById(student.classId);
    if (cls) {
      patch.classDocId = cls.id;
      patch.classId = cls.classId;
    } else {
      const classDocId = await findClassDocIdForShortId(student.classId);
      if (classDocId) {
        patch.classDocId = classDocId;
        patch.classId = student.classId;
      }
    }
  }

  await updateDoc(ref, patch);
  const snap = await getDoc(ref);
  return withShortId(snap.id, snap.data());
}

export async function deleteStudent(id: string): Promise<boolean> {
  await deleteDoc(doc(db, "students", id));
  return true;
}

export async function getStudentById(id: string): Promise<Student | null> {
  try {
    const d = await getDoc(doc(db, "students", id));
    if (!d.exists()) return null;
    const data = d.data();
    if (!belongsToTenant(data, await getTenantScope())) return null;
    return withShortId(d.id, data);
  } catch (error: any) {
    console.error("getStudentById error:", error.code, error.message);
    throw error;
  }
}

export async function listStudents(classId?: string): Promise<Student[]> {
  try {
    const scope = await getTenantScope();
    const baseConstraints = tenantConstraints(scope);

    if (!classId) {
      const snapAll = await getDocs(query(studentsCollection, ...baseConstraints));
      return sortByCreatedAtDesc(snapAll.docs.map((d) => withShortId(d.id, d.data())));
    }

    const candidates: Student[] = [];

    for (const classField of ["classId", "classDocId"] as const) {
      const snap = await getDocs(query(studentsCollection, where(classField, "==", classId), ...baseConstraints));
      candidates.push(...snap.docs.map((d) => withShortId(d.id, d.data())));
    }

    const cls = await getClassById(classId).catch(() => null);
    if (cls?.classId && cls.classId !== classId) {
      const snap = await getDocs(query(studentsCollection, where("classId", "==", cls.classId), ...baseConstraints));
      candidates.push(...snap.docs.map((d) => withShortId(d.id, d.data())));
    }

    const unique = new Map(candidates.map((student) => [student.id, student]));
    return sortByCreatedAtDesc(Array.from(unique.values()));
  } catch (error: any) {
    console.error("listStudents error:", error.code, error.message);
    throw error;
  }
}

export async function updateStudent(id: string, patch: Partial<Omit<Student, "id">>): Promise<void> {
  try {
    await updateDoc(doc(db, "students", id), withTenantScope({
      ...patch,
      updatedAt: serverTimestamp(),
    }, await getTenantScope()));
  } catch (error: any) {
    console.error("updateStudent error:", error.code, error.message);
    throw error;
  }
}
