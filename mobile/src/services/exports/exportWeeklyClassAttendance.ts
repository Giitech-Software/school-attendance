import { exportClassAttendancePdf } from "./exportClassAttendancePdf";

export async function exportWeeklyClassAttendance(
  classId: string,
  fromIso: string,
  toIso: string
) {
  return exportClassAttendancePdf({
    classId,
    fromIso,
    toIso,
    title: "Weekly Class Attendance",
  });
}
