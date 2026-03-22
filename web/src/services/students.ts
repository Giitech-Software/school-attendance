import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase"; // shared firebase.ts (platform-aware)
import type { Student } from "../types";

const studentsCollection = collection(db, "students");

/** Create a new student */
export async function createStudent(data: Omit<Student, "id" | "createdAt">): Promise<Student> {
  try {
    const ref = await addDoc(studentsCollection, {
      ...data,
      createdAt: serverTimestamp(), // Firestore timestamp
    });
    return { id: ref.id, ...data } as Student;
  } catch (error: any) {
    console.error("createStudent error:", error.code, error.message);
    throw error;
  }
}

/** Get student by ID */
export async function getStudentById(id: string): Promise<Student | null> {
  try {
    const d = await getDoc(doc(db, "students", id));
    if (!d.exists()) return null;
    const data = d.data() as Omit<Student, "id">;
    return { id: d.id, ...data } as Student;
  } catch (error: any) {
    console.error("getStudentById error:", error.code, error.message);
    throw error;
  }
}

/** List all students */
export async function listStudents(): Promise<Student[]> {
  try {
    const snap = await getDocs(studentsCollection);
    return snap.docs.map((d) => {
      const data = d.data() as Omit<Student, "id">;
      return { id: d.id, ...data } as Student;
    });
  } catch (error: any) {
    console.error("listStudents error:", error.code, error.message);
    throw error;
  }
}
