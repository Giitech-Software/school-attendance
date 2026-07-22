import type { AttendanceSummary } from "./attendanceSummary";
import type { StaffAttendanceSummary } from "./staffAttendanceSummary";

type ReportRow = AttendanceSummary | StaffAttendanceSummary;

type ExportOptions = {
  title: string;
  subtitle?: string;
  filename: string;
  subjectLabel: "Student" | "Staff";
  rows: ReportRow[];
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
  const header = [options.subjectLabel, "ID", "Present", "Late", "Attended", "Absent", "Total", "Attendance %"];
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

function printableHtml(options: ExportOptions) {
  const generatedAt = new Date().toLocaleString();
  const subtitle = options.subtitle?.trim();
  const totalPresent = options.rows.reduce((sum, row) => sum + row.presentCount, 0);
  const totalLate = options.rows.reduce((sum, row) => sum + row.lateCount, 0);
  const totalAbsent = options.rows.reduce((sum, row) => sum + row.absentCount, 0);

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
      max-width: 1120px;
      min-height: calc(100vh - 48px);
      padding: 28px;
      box-shadow: 0 10px 35px rgba(15, 23, 42, 0.08);
    }
    .header {
      border-bottom: 2px solid #1d4ed8;
      display: flex;
      gap: 16px;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 14px;
    }
    h1 { font-size: 24px; line-height: 1.2; margin: 0; }
    .subtitle { color: #475569; font-size: 13px; margin-top: 6px; }
    .meta { color: #64748b; font-size: 12px; text-align: right; white-space: nowrap; }
    .summary {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
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
    @media (max-width: 720px) {
      main { margin: 0; min-height: 100vh; padding: 18px; }
      .header { display: block; }
      .meta { margin-top: 8px; text-align: left; white-space: normal; }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .table-wrap { overflow-x: auto; }
      table { min-width: 760px; }
    }
    @media print {
      @page { margin: 12mm; }
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
      <div>
        <h1>${escapeHtml(options.title)}</h1>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      <div class="meta">
        <div>${escapeHtml(options.subjectLabel)} attendance</div>
        <div>Generated ${escapeHtml(generatedAt)}</div>
      </div>
    </section>
    <section class="summary">
      <div class="metric"><div class="metric-label">Records</div><div class="metric-value">${options.rows.length}</div></div>
      <div class="metric"><div class="metric-label">Present</div><div class="metric-value">${totalPresent}</div></div>
      <div class="metric"><div class="metric-label">Late</div><div class="metric-value">${totalLate}</div></div>
      <div class="metric"><div class="metric-label">Absent</div><div class="metric-value">${totalAbsent}</div></div>
    </section>
    <section class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${escapeHtml(options.subjectLabel)}</th>
            <th class="present">Present</th>
            <th class="late">Late</th>
            <th class="total">Attended</th>
            <th class="absent">Absent</th>
            <th>Total</th>
            <th class="percent">Attendance %</th>
          </tr>
        </thead>
        <tbody>${reportRowsHtml(options)}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

export function exportReportCsv(options: ExportOptions) {
  downloadText(safeFilename(options.filename, "csv"), csvContent(options), "text/csv;charset=utf-8");
}

export function openReportPdf(options: ExportOptions) {
  const html = printableHtml(options);
  const win = window.open("about:blank", "_blank", "width=1100,height=800");

  if (!win) {
    throw new Error("Popup blocked. Allow popups, then use Save PDF from the printable report.");
  }

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } catch (error) {
    win.close();
    throw error;
  }
}




