//mobile/src/services/exports/exportTermlyStudentAttendance.ts
import { exportStudentAttendancePdf } from "./exportStudentAttendancePdf";

export async function exportTermlyStudentAttendance(
  studentId: string,
  termLabel: string,
  fromIso: string,
  toIso: string
) {
  await exportStudentAttendancePdf({
    studentId,
    fromIso,
    toIso,
    title: `Term Attendance Report (${termLabel})`,
  });
} 
