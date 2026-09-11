import { buildAttendanceReportHtml, makeAttendanceReportReference, type EnterpriseDetailRow } from "./attendanceReportHtml";
import { getTenantScope } from "../tenantScope";
import { getAllStudentAttendanceInRange } from "../attendanceSummary";
import { getAllStaffAttendanceInRange } from "../staffAttendanceSummary";

const REPORT_LOGO_URL = "https://astem-register.web.app/web-app-manifest-192x192.png";

type AggregateOptions = {
  title: string; subjectLabel: "Student" | "Staff"; fromIso: string; toIso: string;
  periodLabel?: string; rows: any[];
};

export async function buildMobileAggregateReport(options: AggregateOptions) {
  const scope = await getTenantScope();
  const rows = options.rows.map((row) => ({
    name: options.subjectLabel === "Staff" ? row.staffName || "Staff" : row.studentName || "Student",
    displayId: row.displayId || (options.subjectLabel === "Staff" ? row.staffId : row.studentId),
    present: row.presentCount ?? 0,
    late: row.lateCount ?? 0,
    attended: row.attendedSessions ?? ((row.presentCount ?? 0) + (row.lateCount ?? 0)),
    absent: row.absentCount ?? 0,
    scheduledDays: row.totalDays ?? row.totalSchoolDays ?? ((row.presentCount ?? 0) + (row.lateCount ?? 0) + (row.absentCount ?? 0)),
    percentage: row.percentagePresent ?? 0,
  }));
  const records = options.subjectLabel === "Staff"
    ? await getAllStaffAttendanceInRange(options.fromIso, options.toIso)
    : await getAllStudentAttendanceInRange(options.fromIso, options.toIso);
  const names = new Map(options.rows.map((row) => [options.subjectLabel === "Staff" ? row.staffId : row.studentId, {
    name: options.subjectLabel === "Staff" ? row.staffName || "Staff" : row.studentName || "Student",
    displayId: row.displayId || (options.subjectLabel === "Staff" ? row.staffId : row.studentId),
  }]));
  const movementRows = records.flatMap((record: any) => {
    const id = options.subjectLabel === "Staff" ? record.subjectId || record.staffId : record.studentId || record.subjectId;
    const subject = names.get(id);
    if (!subject) return [];
    const entries: any[] = [];
    if (record.lateReason) entries.push({ ...subject, date: record.date, eventType: "Late arrival", reason: record.lateReason, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime });
    if (record.earlyCheckoutReason) entries.push({ ...subject, date: record.date, eventType: "Early departure", reason: record.earlyCheckoutReason, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime });
    return entries;
  });
  return buildAttendanceReportHtml({
    mode: "aggregate", subjectLabel: options.subjectLabel, title: options.title,
    periodLabel: options.periodLabel || (options.fromIso === options.toIso ? options.fromIso : `${options.fromIso} to ${options.toIso}`),
    organizationName: scope.tenantName || "ASTEM Attendance Register", organizationType: scope.tenantType,
    logoUrl: REPORT_LOGO_URL, reference: makeAttendanceReportReference(options.subjectLabel, options.fromIso, options.toIso),
    aggregateRows: rows,
    movementRows,
    summary: {
      records: rows.length,
      present: rows.reduce((n, r) => n + r.present, 0), late: rows.reduce((n, r) => n + r.late, 0),
      absent: rows.reduce((n, r) => n + r.absent, 0), attended: rows.reduce((n, r) => n + r.attended, 0),
    },
  });
}

export async function buildMobileDetailReport(options: AggregateOptions & { detailRows: EnterpriseDetailRow[] }) {
  const scope = await getTenantScope();
  const row = options.rows[0] || {};
  return buildAttendanceReportHtml({
    mode: "detail", subjectLabel: options.subjectLabel, title: options.title,
    periodLabel: options.periodLabel || `${options.fromIso} to ${options.toIso}`,
    organizationName: scope.tenantName || "ASTEM Attendance Register", organizationType: scope.tenantType,
    logoUrl: REPORT_LOGO_URL, reference: makeAttendanceReportReference(options.subjectLabel, options.fromIso, options.toIso),
    detailRows: options.detailRows,
    summary: { records: options.detailRows.length, present: row.presentCount ?? 0, late: row.lateCount ?? 0, absent: row.absentCount ?? 0, attended: row.attendedSessions ?? ((row.presentCount ?? 0) + (row.lateCount ?? 0)) },
  });
}
