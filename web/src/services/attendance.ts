// services/attendance.ts
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceRecord } from "../types";

const attendanceCollection = collection(db, "attendance");

/** Record a new attendance entry */
export async function recordAttendance(
  record: Omit<AttendanceRecord, "id" | "createdAt">
): Promise<AttendanceRecord> {
  const data = {
    ...record,
    createdAt: serverTimestamp(), // more accurate than Timestamp.now()
  };

  const ref = await addDoc(attendanceCollection, data);
  return { id: ref.id, ...record } as AttendanceRecord;
}

/** Get attendance for a student (optionally filtered by date) */
export async function getAttendanceForStudent(
  studentId: string,
  date?: string
): Promise<AttendanceRecord[]> {
  let filters = [where("studentId", "==", studentId)];

  if (date) {
    filters.push(where("date", "==", date));
  }

  const q = query(attendanceCollection, ...filters);
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as Omit<AttendanceRecord, "id">;
    return { id: d.id, ...data } as AttendanceRecord;
  });
}
