// mobile/src/services/attendanceAutoAbsent.ts
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import { listStudents } from "./students";

export async function markAbsenteesForDate(
  classId: string,
  date: string
) {
  const students = await listStudents(classId);
  const attendanceRef = collection(db, "attendance");

  for (const s of students) {
    await addDoc(attendanceRef, {
      studentId: s.id,
      classId,
      date,
      status: "absent",
      type: "in",
      checkInTime: null,
      checkOutTime: null,
      createdAt: new Date(),
      biometric: false,
    });
  }
}
