//services/exports/exportDailyClassAttendance.ts
import { exportClassAttendancePdf } from "./exportClassAttendancePdf";

export async function exportDailyClassAttendance(
  classId: string,
  dateIso: string
) {
  await exportClassAttendancePdf({
    classId,
    fromIso: dateIso,
    toIso: dateIso,
    title: "Daily Class Attendance",
  });
}
