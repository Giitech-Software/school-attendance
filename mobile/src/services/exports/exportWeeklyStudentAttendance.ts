//app/services/exports/exportWeeklyStudentAttendance.ts
import { exportStudentAttendancePdf } from "./exportStudentAttendancePdf";

export async function exportWeeklyStudentAttendance(
  studentId: string,
  fromIso: string,
  toIso: string
) {
  await exportStudentAttendancePdf({
    studentId,
    fromIso,
    toIso,
    title: "Weekly Attendance Report",
  });
}
