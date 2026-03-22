//mobile/src/services/exports/exportMonthlyStudentAttendance.ts
import { exportStudentAttendancePdf } from "./exportStudentAttendancePdf";

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);

  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}

export async function exportMonthlyStudentAttendance(
  studentId: string,
  year: number,
  month: number // 0-based (Jan = 0)
) {
  const { fromIso, toIso } = getMonthRange(year, month);

  await exportStudentAttendancePdf({
    studentId,
    fromIso,
    toIso,
    title: "Monthly Attendance Report",
  });
}
