import { exportClassAttendancePdf } from "./exportClassAttendancePdf";

export async function exportTermlyClassAttendance(
  classId: string,
  termLabel: string,
  fromIso: string,
  toIso: string
) {
  await exportClassAttendancePdf({
    classId,
    fromIso,
    toIso,
    title: `Term Attendance (${termLabel})`,
  });
}
