import type { AttendanceRecord } from "../types";

type TemplateParams = {
  title: string;
  staffName: string;
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

export function staffAttendancePdfTemplate({
  title,
  staffName,
  fromIso,
  toIso,
  summary,
  records,
}: TemplateParams) {
  const rowsHtml =
    records.length === 0
      ? `<tr><td colspan="5">No attendance records</td></tr>`
      : records
          .map((r, idx) => {
  const status =
    r.status ?? (r.checkInTime ? "present" : "absent");

  const checkIn = r.checkInTime
    ? new Date(r.checkInTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const checkOut = r.checkOutTime
    ? new Date(r.checkOutTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return `
    <tr class="${status}">
      <td>${idx + 1}</td>
      <td>${new Date(r.date).toLocaleDateString()}</td>
      <td class="status ${status}">${status}</td>
      <td>${checkIn}</td>
      <td>${checkOut}</td>
    </tr>
  `;
})
          .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
  padding: 24px;
  color: #111;
}

h1 {
  text-align: center;
  margin-bottom: 6px;
}

.meta {
  text-align: center;
  font-size: 14px;
  margin-bottom: 20px;
  color: #555;
}

.summary {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.badge.present { background: #dcfce7; color: #166534; }
.badge.absent { background: #fee2e2; color: #991b1b; }
.badge.late { background: #fef3c7; color: #92400e; }
.badge.percent { background: #ede9fe; color: #5b21b6; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th, td {
  border: 1px solid #ddd;
  padding: 6px;
  text-align: center;
}

th {
  background: #f3f4f6;
  font-weight: 600;
}

tr.present { background: #f0fdf4; }
tr.absent { background: #fef2f2; }
tr.late { background: #fffbeb; }

td.status.present { color: #166534; font-weight: 600; }
td.status.absent { color: #991b1b; font-weight: 600; }
td.status.late { color: #92400e; font-weight: 600; }
</style>
</head>

<body>
<h1>${title}</h1>

<div class="meta">
  <div><strong>${staffName}</strong></div>
  <div>${fromIso} → ${toIso}</div>

  <div class="summary">
    <span class="badge present">Present: ${summary.presentCount}</span>
    <span class="badge late">Late: ${summary.lateCount}</span>
    <span class="badge absent">Absent: ${summary.absentCount}</span>
    <span class="badge percent">
      Attendance: ${summary.percentagePresent.toFixed(1)}%
    </span>
  </div>
</div>

<table>
<thead>
<tr>
  <th>#</th>
  <th>Date</th>
  <th>Status</th>
  <th>Check-in</th>
  <th>Check-out</th>
</tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>
</body>
</html>
`;
}
