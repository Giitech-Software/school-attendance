// Keep this renderer aligned with /shared/reports/attendanceReportHtml.ts.
// It lives inside mobile because EAS archives the mobile directory as its build root.
export type EnterpriseAggregateRow = {
  name: string; displayId?: string; present: number; late: number;
  attended: number; absent: number; scheduledDays: number; percentage: number;
};

export type EnterpriseDetailRow = {
  date: string; status?: string | null; checkInTime?: string | null;
  checkOutTime?: string | null; movementEntry?: string | null;
};

export type EnterpriseMovementRow = {
  name: string; displayId?: string; date: string; eventType: string;
  reason: string; checkInTime?: string | null; checkOutTime?: string | null;
};

export type EnterpriseAttendanceReport = {
  mode: "aggregate" | "detail";
  subjectLabel: "Student" | "Staff";
  title: string;
  periodLabel?: string;
  organizationName: string;
  organizationType?: string | null;
  logoUrl?: string;
  generatedAtIso?: string;
  generatedBy?: string;
  reference: string;
  aggregateRows?: EnterpriseAggregateRow[];
  detailRows?: EnterpriseDetailRow[];
  movementRows?: EnterpriseMovementRow[];
  summary: { records: number; present: number; late: number; absent: number; attended: number };
  interactiveToolbar?: boolean;
};

export function escapeReportHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function reportTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Accra" }).format(date);
}

function performanceClass(value: number) {
  if (value === 100) return "excellent";
  if (value >= 75) return "good";
  if (value >= 60) return "average";
  if (value >= 50) return "weak";
  return "critical";
}

export function makeAttendanceReportReference(subject: string, fromIso: string, toIso: string) {
  return `ASTEM-${subject.toUpperCase()}-${fromIso.replace(/-/g, "")}-${toIso.replace(/-/g, "")}`;
}

export function buildAttendanceReportHtml(report: EnterpriseAttendanceReport) {
  const detail = report.mode === "detail";
  const generated = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(report.generatedAtIso || Date.now()));
  const aggregateRows = report.aggregateRows || [];
  const detailRows = report.detailRows || [];
  const movementRows = report.movementRows || [];
  const rows = detail
    ? (detailRows.length ? detailRows.map((r, i) => { const status = (r.status || (r.checkInTime ? "present" : "absent")).toLowerCase(); return `<tr><td>${i + 1}</td><td>${escapeReportHtml(r.date)}</td><td><span class="badge status-${escapeReportHtml(status)}">${escapeReportHtml(status)}</span></td><td>${escapeReportHtml(reportTime(r.checkInTime))}</td><td>${escapeReportHtml(reportTime(r.checkOutTime))}</td><td class="movement">${escapeReportHtml(r.movementEntry || "—")}</td></tr>`; }).join("") : `<tr><td colspan="6" class="empty">No attendance timeline records available.</td></tr>`)
    : (aggregateRows.length ? aggregateRows.map((r, i) => `<tr><td>${i + 1}</td><td class="subject ${performanceClass(r.percentage)}"><strong>${escapeReportHtml(r.name)}</strong><small>${escapeReportHtml(r.displayId || "—")}</small></td><td class="present">${r.present}</td><td class="late">${r.late}</td><td class="attended">${r.attended}</td><td class="absent">${r.absent}</td><td>${r.scheduledDays}</td><td class="percent">${r.percentage.toFixed(1)}%</td></tr>`).join("") : `<tr><td colspan="8" class="empty">No records available.</td></tr>`);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeReportHtml(report.title)}</title><style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}.toolbar{display:${report.interactiveToolbar ? "flex" : "none"};justify-content:space-between;align-items:center;background:#0f172a;color:#fff;padding:12px 18px;font-size:12px;font-weight:700}.toolbar button{border:0;border-radius:7px;background:#fff;color:#0f172a;padding:8px 13px;font-weight:800}main{max-width:1280px;margin:22px auto;background:#fff;padding:26px;box-shadow:0 10px 30px #0f172a14}.header{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #2563eb;padding-bottom:13px}.brand{display:flex;align-items:center;gap:12px}.logo{width:48px;height:48px;object-fit:contain}.org{font-size:15px;font-weight:900}.orgtype{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700}h1{font-size:23px;margin:3px 0}.period{font-size:12px;color:#475569}.meta{text-align:right;font-size:10px;color:#64748b;line-height:1.55}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:16px 0}.metric{border:1px solid #e2e8f0;border-radius:8px;padding:9px}.metric label{display:block;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase}.metric strong{font-size:18px}.metric:nth-child(2){background:#dcfce7;color:#166534}.metric:nth-child(3){background:#fef3c7;color:#92400e}.metric:nth-child(4){background:#fee2e2;color:#991b1b}.metric:nth-child(5){background:#e0f2fe;color:#075985}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #dbe3ef;padding:6px 7px;text-align:center}th{background:#f1f5f9;color:#334155;font-weight:800}tbody tr:nth-child(even) td{background:#f8fafc}.subject{text-align:left;min-width:170px}.subject small{display:block;color:#64748b;margin-top:2px}.present{background:#dcfce7!important;color:#166534;font-weight:700}.late{background:#fef3c7!important;color:#92400e;font-weight:700}.attended{background:#e0f2fe!important;color:#075985;font-weight:700}.absent{background:#fee2e2!important;color:#991b1b;font-weight:700}.percent{background:#ede9fe!important;color:#5b21b6;font-weight:800}.excellent{background:#dcfce7!important}.good{background:#ecfeff!important}.average{background:#ffedd5!important}.weak{background:#fde68a!important}.critical{background:#fecaca!important}.badge{border-radius:999px;padding:3px 8px;font-size:9px;font-weight:800;text-transform:capitalize}.status-present{background:#dcfce7;color:#166534}.status-late{background:#fef3c7;color:#92400e}.status-absent{background:#fee2e2;color:#991b1b}.status-excused{background:#e0f2fe;color:#075985}.movement{text-align:left;max-width:240px}.empty{padding:18px;color:#64748b}.signoff{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:32px;break-inside:avoid}.signoff div{border-top:1px solid #94a3b8;padding-top:5px;color:#64748b;font-size:9px}.footer{display:flex;justify-content:space-between;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:7px;color:#64748b;font-size:8px}@media print{@page{size:A4 ${detail ? "portrait" : "landscape"};margin:11mm 10mm 13mm}body{background:#fff}.toolbar{display:none}main{box-shadow:none;margin:0;max-width:none;padding:0}thead{display:table-header-group}tr{break-inside:avoid}.header,.summary,.signoff{break-inside:avoid}}
  </style></head><body><div class="toolbar"><span>${escapeReportHtml(report.reference)}</span><button onclick="window.print()">Save PDF</button></div><main><header class="header"><div class="brand">${report.logoUrl ? `<img class="logo" src="${escapeReportHtml(report.logoUrl)}" alt="ASTEM logo">` : ""}<div><div class="org">${escapeReportHtml(report.organizationName)}</div>${report.organizationType ? `<div class="orgtype">${escapeReportHtml(report.organizationType)} attendance management</div>` : ""}<h1>${escapeReportHtml(report.title)}</h1>${report.periodLabel ? `<div class="period">Period / scope: ${escapeReportHtml(report.periodLabel)}</div>` : ""}</div></div><div class="meta"><strong>${report.subjectLabel} attendance report</strong><br>Reference: ${escapeReportHtml(report.reference)}<br>Generated: ${escapeReportHtml(generated)} GMT${report.generatedBy ? `<br>Prepared by: ${escapeReportHtml(report.generatedBy)}` : ""}</div></header><section class="summary"><div class="metric"><label>Records</label><strong>${report.summary.records}</strong></div><div class="metric"><label>Present</label><strong>${report.summary.present}</strong></div><div class="metric"><label>Late</label><strong>${report.summary.late}</strong></div><div class="metric"><label>Absent</label><strong>${report.summary.absent}</strong></div><div class="metric"><label>Attended sessions</label><strong>${report.summary.attended}</strong></div></section><table><thead>${detail ? `<tr><th>#</th><th>Date</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Movement book entry</th></tr>` : `<tr><th>#</th><th>${report.subjectLabel}</th><th>Present</th><th>Late</th><th>Attended</th><th>Absent</th><th>Scheduled Days</th><th>Attendance %</th></tr>`}</thead><tbody>${rows}</tbody></table>${!detail ? `<section style="margin-top:24px;break-before:auto"><h2 style="font-size:15px;margin:0 0 8px">Movement Book Exceptions (${movementRows.length})</h2>${movementRows.length ? `<table><thead><tr><th>#</th><th>${report.subjectLabel}</th><th>Date</th><th>Event</th><th>Reason</th><th>Check-in</th><th>Check-out</th></tr></thead><tbody>${movementRows.map((r, i) => `<tr><td>${i + 1}</td><td class="subject"><strong>${escapeReportHtml(r.name)}</strong><small>${escapeReportHtml(r.displayId || "—")}</small></td><td>${escapeReportHtml(r.date)}</td><td>${escapeReportHtml(r.eventType)}</td><td class="movement">${escapeReportHtml(r.reason)}</td><td>${escapeReportHtml(reportTime(r.checkInTime))}</td><td>${escapeReportHtml(reportTime(r.checkOutTime))}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No late-arrival or early-departure movement entries for this report period.</div>`}</section>` : ""}<section class="signoff"><div>Prepared / verified by</div><div>Authorised signature and date</div></section><footer class="footer"><span>Generated by ASTEM Attendance Register</span><span>${escapeReportHtml(report.organizationName)} · ${escapeReportHtml(report.reference)}</span></footer></main></body></html>`;
}
