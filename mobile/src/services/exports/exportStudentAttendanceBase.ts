import { studentAttendancePdfTemplate } from "./studentAttendancePdfTemplate";
import { buildAttendancePdf } from "./buildAttendancePdf";
import type { AttendanceRecord } from "../types";

type ExportBaseParams = {
  title: string;
  studentName: string;
  classLabel: string;
  fromIso: string;
  toIso: string;
  summary: {
    presentCount: number;
    absentCount: number;
    lateCount: number;
    percentagePresent: number;
  };
  records: AttendanceRecord[];
};

export async function exportStudentAttendanceBase(
  params: ExportBaseParams
) {
  const html = studentAttendancePdfTemplate(params);

  await buildAttendancePdf({
    html,
    fileName: params.title,
  });
}
