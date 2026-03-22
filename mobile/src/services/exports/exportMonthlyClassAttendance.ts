import { exportClassAttendancePdf } from "./exportClassAttendancePdf";

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);

  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}

export async function exportMonthlyClassAttendance(
  classId: string,
  year: number,
  month: number
) {
  const { fromIso, toIso } = getMonthRange(year, month);

  await exportClassAttendancePdf({
    classId,
    fromIso,
    toIso,
    title: "Monthly Class Attendance",
  });
}
