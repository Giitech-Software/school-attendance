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
  orderBy,
  limit,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase"; // shared firebase.ts (platform-aware)
import type { Student } from "../types";
import { getClassById } from "./classes";

// Re-export Student type
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
    const q = query(collection(db, "classes"), where("classId", "==", shortClassId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
  } catch (err) {
    console.error("findClassDocIdForShortId error:", err);
  }

  return null;
}

/** Create a new student */
export async function createStudent(data: Omit<Student, "id" | "createdAt">): Promise<Student> {
  try {
    const payload: any = {
      ...data,
      createdAt: serverTimestamp(),
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
    });

    if (!payload.studentId) {
      const snap = await getDocs(query(studentsCollection, orderBy("createdAt", "desc"), limit(1)));
      let nextNum = 1;

      if (!snap.empty) {
        const lastStudent = snap.docs[0].data();
        const lastId: string = lastStudent?.studentId ?? lastStudent?.studentCode ?? "STU-000";
        const match = lastId.match(/\d+$/);
        if (match) nextNum = Number(match[0]) + 1;
      }

      payload.studentId = `STU-${String(nextNum).padStart(3, "0")}`;
    }

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
  const patch: any = { updatedAt: serverTimestamp() };

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

/** Get student by ID */
export async function getStudentById(id: string): Promise<Student | null> {
  try {
    const d = await getDoc(doc(db, "students", id));
    if (!d.exists()) return null;
    return withShortId(d.id, d.data());
  } catch (error: any) {
    console.error("getStudentById error:", error.code, error.message);
    throw error;
  }
}

/** List all students, optionally filtered by classId */
export async function listStudents(classId?: string): Promise<Student[]> {
  try {
    if (!classId) {
      const qAll = query(studentsCollection, orderBy("createdAt", "desc"));
      const snapAll = await getDocs(qAll);
      return snapAll.docs.map((d) => withShortId(d.id, d.data()));
    }

    try {
      const q1 = query(studentsCollection, where("classId", "==", classId), orderBy("createdAt", "desc"));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) return snap1.docs.map((d) => withShortId(d.id, d.data()));
    } catch (err) {
      console.error("listStudents (classId) error:", err);
    }

    try {
      const q2 = query(studentsCollection, where("classDocId", "==", classId), orderBy("createdAt", "desc"));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) return snap2.docs.map((d) => withShortId(d.id, d.data()));
    } catch (err) {
      console.error("listStudents (classDocId) error:", err);
    }

    try {
      const cls = await getClassById(classId);
      if (cls?.classId) {
        const q3 = query(studentsCollection, where("classId", "==", cls.classId), orderBy("createdAt", "desc"));
        const snap3 = await getDocs(q3);
        if (!snap3.empty) return snap3.docs.map((d) => withShortId(d.id, d.data()));
      }
    } catch (err) {
      console.error("listStudents (via class) error:", err);
    }

    return [];
  } catch (error: any) {
    console.error("listStudents error:", error.code, error.message);
    throw error;
  }
}

export async function updateStudent(id: string, patch: Partial<Omit<Student, "id">>): Promise<void> {
  try {
    await updateDoc(doc(db, "students", id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error("updateStudent error:", error.code, error.message);
    throw error;
  }
}
