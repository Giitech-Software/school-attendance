import type { AttendanceSummary } from "./attendanceSummary";
import type { StaffAttendanceSummary } from "./staffAttendanceSummary";
import { getTenantScope } from "./tenantScope";
import { buildAttendanceReportHtml, makeAttendanceReportReference, type EnterpriseMovementRow } from "../../../shared/reports/attendanceReportHtml";
import { getAllStudentAttendanceInRange } from "./attendanceSummary";
import { getAllStaffAttendanceInRange } from "./staffAttendanceSummary";

type ReportRow = AttendanceSummary | StaffAttendanceSummary;

export type AttendanceDetailRecord = {
  date: string;
  status?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  lateReason?: string | null;
  earlyCheckoutReason?: string | null;
};

type ExportOptions = {
  title: string;
  subtitle?: string;
  filename: string;
  subjectLabel: "Student" | "Staff";
  rows: ReportRow[];
  organizationName?: string;
  organizationType?: string;
  generatedBy?: string;
  detailRecords?: AttendanceDetailRecord[];
  movementRows?: EnterpriseMovementRow[];
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFilename(value: string, extension: "csv") {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${cleaned || "attendance-report"}.${extension}`;
}

function getName(row: ReportRow) {
  if ("staffName" in row) return row.staffName || "Staff";
  return row.studentName || "Student";
}

function getDisplayId(row: ReportRow) {
  return row.displayId || ("staffId" in row ? row.staffId : row.studentId);
}

function totalCount(row: ReportRow) {
  return "totalDays" in row ? row.totalDays : row.totalSchoolDays;
}

function percentageClass(row: ReportRow) {
  const percentage = row.percentagePresent;
  if (percentage === 100) return "excellent";
  if (percentage >= 75) return "good";
  if (percentage >= 60) return "average";
  if (percentage >= 50) return "weak";
  return "critical";
}

function csvContent(options: ExportOptions) {
  const header = [options.subjectLabel, "ID", "Present", "Late", "Attended", "Absent", "Scheduled Days", "Attendance %"];
  const lines = options.rows.map((row) =>
    [
      getName(row),
      getDisplayId(row),
      row.presentCount,
      row.lateCount,
      row.attendedSessions,
      row.absentCount,
      totalCount(row),
      `${row.percentagePresent.toFixed(1)}%`,
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [header.map(escapeCsv).join(","), ...lines].join("\r\n");
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function reportRowsHtml(options: ExportOptions) {
  if (options.rows.length === 0) {
    return `<tr><td colspan="8" class="empty">No records available.</td></tr>`;
  }

  return options.rows
    .map(
      (row, index) => `
        <tr>
          <td class="index">${index + 1}</td>
          <td class="subject ${percentageClass(row)}">
            <div class="subject-name">${escapeHtml(getName(row))}</div>
            <div class="subject-id">${escapeHtml(getDisplayId(row))}</div>
          </td>
          <td class="present">${escapeHtml(row.presentCount)}</td>
          <td class="late">${escapeHtml(row.lateCount)}</td>
          <td class="total">${escapeHtml(row.attendedSessions)}</td>
          <td class="absent">${escapeHtml(row.absentCount)}</td>
          <td>${escapeHtml(totalCount(row))}</td>
          <td class="percent">${escapeHtml(row.percentagePresent.toFixed(1))}%</td>
        </tr>`
    )
    .join("");
}

function formatReportTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}

function detailRowsHtml(records: AttendanceDetailRecord[]) {
  if (records.length === 0) return `<tr><td colspan="6" class="empty">No attendance timeline records available.</td></tr>`;
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record, index) => {
      const status = (record.status || (record.checkInTime ? "present" : "absent")).toLowerCase();
      const movementEntry = [record.lateReason, record.earlyCheckoutReason].filter(Boolean).join(" / ") || "—";
      return `<tr>
        <td class="index">${index + 1}</td>
        <td>${escapeHtml(record.date)}</td>
        <td><span class="status-badge status-${escapeHtml(status)}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(formatReportTime(record.checkInTime))}</td>
        <td>${escapeHtml(formatReportTime(record.checkOutTime))}</td>
        <td class="movement-entry">${escapeHtml(movementEntry)}</td>
      </tr>`;
    })
    .join("");
}

function printableHtml(options: ExportOptions) {
  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date());
  const subtitle = options.subtitle?.trim();
  const organizationName = options.organizationName?.trim() || "ASTEM Attendance Register";
  const organizationType = options.organizationType?.trim();
  const logoUrl = `${window.location.origin}/web-app-manifest-192x192.png`;
  const totalPresent = options.rows.reduce((sum, row) => sum + row.presentCount, 0);
  const totalLate = options.rows.reduce((sum, row) => sum + row.lateCount, 0);
  const totalAbsent = options.rows.reduce((sum, row) => sum + row.absentCount, 0);
  const totalAttended = options.rows.reduce((sum, row) => sum + row.attendedSessions, 0);
  const reportReference = `ASTEM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(options.rows.length).padStart(3, "0")}`;
  const isDetailReport = options.detailRecords !== undefined;

  return buildAttendanceReportHtml({
    mode: isDetailReport ? "detail" : "aggregate",
    subjectLabel: options.subjectLabel,
    title: options.title,
    periodLabel: subtitle,
    organizationName,
    organizationType,
    logoUrl,
    generatedBy: options.generatedBy,
    reference: makeAttendanceReportReference(options.subjectLabel, new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)),
    aggregateRows: options.rows.map((row) => ({
      name: getName(row), displayId: getDisplayId(row), present: row.presentCount,
      late: row.lateCount, attended: row.attendedSessions, absent: row.absentCount,
      scheduledDays: totalCount(row), percentage: row.percentagePresent,
    })),
    detailRows: options.detailRecords?.map((row) => ({
      date: row.date, status: row.status, checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      movementEntry: [row.lateReason, row.earlyCheckoutReason].filter(Boolean).join(" / ") || null,
    })),
    movementRows: options.movementRows,
    summary: { records: options.rows.length, present: totalPresent, late: totalLate, absent: totalAbsent, attended: totalAttended },
    interactiveToolbar: true,
  });

  /* Legacy template retained temporarily for safe rollback during the shared-renderer migration. */
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body, main, section, table, thead, tbody, tr, th, td, div, span {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      background: #f8fafc;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .toolbar {
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      display: flex;
      gap: 10px;
      justify-content: space-between;
      padding: 12px 18px;
    }
    .toolbar-title { font-size: 13px; font-weight: 700; }
    .toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    button {
      background: #ffffff;
      border: 0;
      border-radius: 6px;
      color: #0f172a;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 12px;
    }
    main {
      background: #ffffff;
      margin: 24px auto;
      max-width: 1280px;
      min-height: calc(100vh - 48px);
      padding: 28px;
      box-shadow: 0 10px 35px rgba(15, 23, 42, 0.08);
    }
    .header {
      border-bottom: 3px solid #2563eb;
      display: flex;
      gap: 16px;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 14px;
    }
    .brand { align-items: center; display: flex; gap: 12px; }
    .brand-logo { height: 48px; object-fit: contain; width: 48px; }
    .organization { color: #0f172a; font-size: 15px; font-weight: 900; letter-spacing: .01em; }
    .organization-type { color: #64748b; font-size: 10px; font-weight: 700; margin-top: 2px; text-transform: uppercase; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0; }
    .subtitle { color: #475569; font-size: 13px; margin-top: 6px; }
    .meta { color: #64748b; font-size: 12px; text-align: right; white-space: nowrap; }
    .summary {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin-bottom: 18px;
    }
    .metric {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
    }
    .metric:nth-child(1) { background: #f8fafc; }
    .metric:nth-child(2) { background: #dcfce7; color: #166534; }
    .metric:nth-child(3) { background: #fef3c7; color: #92400e; }
    .metric:nth-child(4) { background: #fee2e2; color: #991b1b; }
    .metric:nth-child(5) { background: #ede9fe; color: #5b21b6; }
    .metric-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .metric-value { font-size: 18px; font-weight: 800; margin-top: 3px; }
    table {
      border-collapse: collapse;
      font-size: 12px;
      width: 100%;
    }
    th, td {
      border: 1px solid #dbe3ef;
      padding: 7px 8px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .index { color: #64748b; width: 42px; }
    .subject { min-width: 190px; text-align: left; }
    .subject-name { font-weight: 800; }
    .subject-id { color: #64748b; font-size: 11px; margin-top: 2px; }
    .present { background: #dcfce7 !important; color: #166534; font-weight: 700; }
    .late { background: #fef3c7 !important; color: #92400e; font-weight: 700; }
    .total { background: #e0f2fe !important; color: #075985; font-weight: 700; }
    .absent { background: #fee2e2 !important; color: #991b1b; font-weight: 700; }
    .percent { background: #ede9fe !important; color: #5b21b6; font-weight: 800; }
    .excellent { background: #dcfce7 !important; }
    .good { background: #ecfeff !important; }
    .average { background: #ffedd5 !important; }
    .weak { background: #fde68a !important; }
    .critical { background: #fecaca !important; }
    .empty { color: #64748b; padding: 18px; text-align: center; }
    .status-badge { border-radius: 999px; display: inline-block; font-size: 10px; font-weight: 800; padding: 3px 8px; text-transform: capitalize; }
    .status-present { background: #dcfce7; color: #166534; }
    .status-late { background: #fef3c7; color: #92400e; }
    .status-absent { background: #fee2e2; color: #991b1b; }
    .status-excused { background: #e0f2fe; color: #075985; }
    .movement-entry { max-width: 280px; text-align: left; white-space: normal; }
    .signoff { display: grid; gap: 48px; grid-template-columns: 1fr 1fr; margin-top: 34px; page-break-inside: avoid; }
    .sign-line { border-top: 1px solid #94a3b8; color: #64748b; font-size: 10px; padding-top: 5px; }
    .document-footer { color: #64748b; display: flex; font-size: 9px; justify-content: space-between; margin-top: 18px; padding-top: 8px; }
    @media (max-width: 720px) {
      main { margin: 0; min-height: 100vh; padding: 18px; }
      .header { display: block; }
      .meta { margin-top: 8px; text-align: left; white-space: normal; }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .table-wrap { overflow-x: auto; }
      table { min-width: 760px; }
    }
    @media print {
      @page { size: A4 ${isDetailReport ? "portrait" : "landscape"}; margin: 11mm 10mm 13mm; }
      body { background: #ffffff; }
      .toolbar { display: none; }
      main {
        box-shadow: none;
        margin: 0;
        max-width: none;
        min-height: auto;
        padding: 0;
      }
      .table-wrap { overflow: visible; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      .header, .summary, .signoff { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-title">${escapeHtml(options.filename)}</div>
    <div class="toolbar-actions">
      <button type="button" onclick="window.print()">Save PDF</button>
    </div>
  </div>
  <main>
    <section class="header">
      <div class="brand">
        <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="ASTEM logo" />
        <div>
          <div class="organization">${escapeHtml(organizationName)}</div>
          ${organizationType ? `<div class="organization-type">${escapeHtml(organizationType)} attendance management</div>` : ""}
          <h1>${escapeHtml(options.title)}</h1>
          ${subtitle ? `<div class="subtitle">Period / scope: ${escapeHtml(subtitle)}</div>` : ""}
        </div>
      </div>
      <div class="meta">
        <div><strong>${escapeHtml(options.subjectLabel)} attendance report</strong></div>
        <div>Reference: ${escapeHtml(reportReference)}</div>
        <div>Generated: ${escapeHtml(generatedAt)} GMT</div>
        ${options.generatedBy ? `<div>Prepared by: ${escapeHtml(options.generatedBy)}</div>` : ""}
      </div>
    </section>
    <section class="summary">
      <div class="metric"><div class="metric-label">Records</div><div class="metric-value">${options.rows.length}</div></div>
      <div class="metric"><div class="metric-label">Present</div><div class="metric-value">${totalPresent}</div></div>
      <div class="metric"><div class="metric-label">Late</div><div class="metric-value">${totalLate}</div></div>
      <div class="metric"><div class="metric-label">Absent</div><div class="metric-value">${totalAbsent}</div></div>
      <div class="metric"><div class="metric-label">Attended sessions</div><div class="metric-value">${totalAttended}</div></div>
    </section>
    <section class="table-wrap">
      <table>
        <thead>
          ${isDetailReport ? `<tr><th>#</th><th>Date</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Movement book entry</th></tr>` : `<tr>
              <th>#</th><th>${escapeHtml(options.subjectLabel)}</th><th class="present">Present</th>
              <th class="late">Late</th><th class="total">Attended</th><th class="absent">Absent</th>
              <th>Scheduled Days</th><th class="percent">Attendance %</th>
            </tr>`}
        </thead>
        <tbody>${isDetailReport ? detailRowsHtml(options.detailRecords || []) : reportRowsHtml(options)}</tbody>
      </table>
    </section>
    <section class="signoff">
      <div class="sign-line">Prepared / verified by</div>
      <div class="sign-line">Authorised signature and date</div>
    </section>
    <footer class="document-footer">
      <span>Generated by ASTEM Attendance Register</span>
      <span>${escapeHtml(organizationName)} · ${escapeHtml(reportReference)}</span>
    </footer>
  </main>
</body>
</html>`;
}

export function exportReportCsv(options: ExportOptions) {
  downloadText(safeFilename(options.filename, "csv"), csvContent(options), "text/csv;charset=utf-8");
}

export async function openReportPdf(options: ExportOptions) {
  const win = window.open("about:blank", "_blank", "width=1100,height=800");

  if (!win) {
    throw new Error("Popup blocked. Allow popups, then use Save PDF from the printable report.");
  }

  try {
    const scope = await getTenantScope().catch(() => null);
    let movementRows: EnterpriseMovementRow[] | undefined;
    const dates = options.subtitle?.match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (!options.detailRecords && dates.length > 0) {
      const fromIso = dates[0]!;
      const toIso = dates[1] || dates[0]!;
      const records = options.subjectLabel === "Staff"
        ? await getAllStaffAttendanceInRange(fromIso, toIso)
        : await getAllStudentAttendanceInRange(fromIso, toIso);
      const names = new Map(options.rows.map((row) => [("staffId" in row ? row.staffId : row.studentId), { name: getName(row), displayId: getDisplayId(row) }]));
      movementRows = records.flatMap((record: any) => {
        const id = options.subjectLabel === "Staff" ? record.subjectId || record.staffId : record.studentId || record.subjectId;
        const subject = names.get(id);
        if (!subject) return [];
        const entries: EnterpriseMovementRow[] = [];
        if (record.lateReason) entries.push({ ...subject, date: record.date, eventType: "Late arrival", reason: record.lateReason, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime });
        if (record.earlyCheckoutReason) entries.push({ ...subject, date: record.date, eventType: "Early departure", reason: record.earlyCheckoutReason, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime });
        return entries;
      });
    }
    const html = printableHtml({
      ...options,
      organizationName: options.organizationName || scope?.tenantName || undefined,
      organizationType: options.organizationType || scope?.tenantType || undefined,
      movementRows,
    });
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } catch (error) {
    win.close();
    throw error;
  }
}




