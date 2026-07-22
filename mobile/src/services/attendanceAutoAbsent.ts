// mobile/src/services/attendanceAutoAbsent.ts
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../../app/firebase";
import { listStudents } from "./students";
import { getTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

export async function markAbsenteesForDate(
  classId: string,
  date: string
) {
  const students = await listStudents(classId);
  const attendanceRef = collection(db, "attendance");
  const scope = await getTenantScope();
  const existing = await getDocs(query(
    attendanceRef,
    where("classId", "==", classId),
    where("date", "==", date),
    ...tenantConstraints(scope)
  ));
  const recordedStudentIds = new Set(existing.docs.map((item) => item.data().studentId));

  for (const s of students) {
    if (recordedStudentIds.has(s.id)) continue;
    await setDoc(doc(attendanceRef, `auto-students-${date}-${s.id}`), withTenantScope({
      studentId: s.id,
      subjectType: "student",
      subjectId: s.id,
      classId,
      date,
      status: "absent",
      type: "in",
      checkInTime: null,
      checkOutTime: null,
      method: "manual",
      createdAt: serverTimestamp(),
      biometric: false,
      autoMarked: true,
    }, scope), { merge: true });
  }
}
