// mobile/src/services/students.ts
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
import { db } from "../../app/firebase";
import type { Student } from "./types";
import { getClassById } from "./classes";

const studentsCollection = collection(db, "students");

function withShortId(id: string, data: any): Student {
  return {
    id,
    shortId: id.slice(0, 6),
    ...data,
    studentId: data.studentId ?? data.studentCode, // prefer actual studentId, fallback to studentCode
  } as Student;
}


/** Resolve Firestore class doc id using short classId */
async function findClassDocIdForShortId(
  shortClassId?: string
): Promise<string | null> {
  if (!shortClassId) return null;

  try {
    const classesRef = collection(db, "classes");
    const q = query(classesRef, where("classId", "==", shortClassId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
  } catch (err) {
    console.error("findClassDocIdForShortId error:", err);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* CREATE                                                             */
/* ------------------------------------------------------------------ */
export async function createStudent(
  data: Omit<Student, "id" | "createdAt">
): Promise<Student> {
  const payload: any = {
    ...data,
    createdAt: serverTimestamp(),
  };
// allow isActive in student writes
if (typeof data.isActive === "boolean") {
  payload.isActive = data.isActive;
}

  // 🔥 CRITICAL: strip undefined values
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  // ✅ AUTO-GENERATE studentCode IF MISSING
  // ✅ AUTO-GENERATE studentId IF MISSING
if (!payload.studentId) {
  const snap = await getDocs(
    query(studentsCollection, orderBy("createdAt", "desc"), limit(1))
  );

  let nextNum = 1; // default for first student

  if (!snap.empty) {
    const lastStudent = snap.docs[0].data();
    const lastId: string = lastStudent?.studentId ?? lastStudent?.studentCode ?? "STU-000";

    const match = lastId.match(/\d+$/); // extract numeric part
    if (match) {
      nextNum = Number(match[0]) + 1;
    }
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
}


/* ------------------------------------------------------------------ */
/* UPSERT (🔥 HARDENED AGAINST undefined)                              */
/* ------------------------------------------------------------------ */

export async function upsertStudent(
  student: Partial<Student> & { id?: string }
): Promise<Student> {
  if (!student.id) {
    return createStudent(student as Omit<Student, "id" | "createdAt">);
  }

  const ref = doc(db, "students", student.id);
  const patch: any = { updatedAt: serverTimestamp() };

  /**
   * IMPORTANT:
   * We copy fields manually to prevent undefined
   */

  for (const [key, value] of Object.entries(student)) {
    if (key === "id") continue;

    if (value === undefined) {
      patch[key] = deleteField();
    } else {
      patch[key] = value;
    }
  }

  /**
 * Normalize class assignment
 */
if (student.classId) {
  const cls = await getClassById(student.classId);

  // Case: student.classId is actually a docId
  if (cls) {
    patch.classDocId = cls.id;
    patch.classId = cls.classId;
  } else {
    // Case: student.classId is a shortId
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

/* ------------------------------------------------------------------ */
/* DELETE                                                             */
/* ------------------------------------------------------------------ */

export async function deleteStudent(id: string) {
  await deleteDoc(doc(db, "students", id));
  return true;
}

/* ------------------------------------------------------------------ */
/* GET                                                                */
/* ------------------------------------------------------------------ */

export async function getStudentById(id: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, "students", id));
  return snap.exists() ? withShortId(snap.id, snap.data()) : null;
}

/* ------------------------------------------------------------------ */
/* LIST                                                               */
/* ------------------------------------------------------------------ */

export async function listStudents(classId?: string): Promise<Student[]> {
  if (!classId) {
    const qAll = query(studentsCollection, orderBy("createdAt", "desc"));
    const snapAll = await getDocs(qAll);
    return snapAll.docs.map((d) => withShortId(d.id, d.data()));
  }

  // 1️⃣ by short classId
  try {
    const q1 = query(
      studentsCollection,
      where("classId", "==", classId),
      orderBy("createdAt", "desc")
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return snap1.docs.map((d) => withShortId(d.id, d.data()));
    }
  } catch (err) {
    console.error("listStudents (classId) error:", err);
  }

  // 2️⃣ by classDocId
  try {
    const q2 = query(
      studentsCollection,
      where("classDocId", "==", classId),
      orderBy("createdAt", "desc")
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      return snap2.docs.map((d) => withShortId(d.id, d.data()));
    }
  } catch (err) {
    console.error("listStudents (classDocId) error:", err);
  }

  // 3️⃣ resolve via class doc
  try {
    const cls = await getClassById(classId);
    if (cls?.classId) {
      const q3 = query(
        studentsCollection,
        where("classId", "==", cls.classId),
        orderBy("createdAt", "desc")
      );
      const snap3 = await getDocs(q3);
      if (!snap3.empty) {
        return snap3.docs.map((d) => withShortId(d.id, d.data()));
      }
    }
  } catch (err) {
    console.error("listStudents (via class) error:", err);
  }

  return [];
}

/* ------------------------------------------------------------------ */
/* BIOMETRIC LOOKUP                                                    */
/* ------------------------------------------------------------------ */

export async function findStudentByFingerprint(
  fingerprintId: string
): Promise<Student | null> {
  const q = query(
    studentsCollection,
    where("fingerprintId", "==", fingerprintId),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return withShortId(docSnap.id, docSnap.data());
}
