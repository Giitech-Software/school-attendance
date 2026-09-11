import { buildAttendancePdf } from "./buildAttendancePdf";
import type { AttendanceRecord } from "../types";
import { buildMobileDetailReport } from "./enterpriseAttendanceReport";

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
  const html = await buildMobileDetailReport({
    title: params.title, subjectLabel: "Student", fromIso: params.fromIso, toIso: params.toIso,
    periodLabel: `${params.studentName} · ${params.classLabel} · ${params.fromIso} to ${params.toIso}`,
    rows: [{ studentName: params.studentName, presentCount: params.summary.presentCount, lateCount: params.summary.lateCount, absentCount: params.summary.absentCount, percentagePresent: params.summary.percentagePresent }],
    detailRows: params.records.map((record) => ({ date: record.date, status: record.status, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime, movementEntry: [record.lateReason, record.earlyCheckoutReason].filter(Boolean).join(" / ") || null })),
  });

  await buildAttendancePdf({
    html,
    fileName: params.title,
  });
}
