import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { getStaffGlobalSummary } from "../staffAttendanceSummary";
import { attendanceTableStyles } from "./generateAttendanceRows";

export type ExportWeeklyStaffPdfOptions = {
  fromIso: string;
  toIso: string;
  label: string;
};

function generateStaffRows(rows: any[]) {
  return rows
    .map((r, i) => {
      const percent = r.percentagePresent ?? 0;

      const rowClass =
        percent === 100
          ? "excellent"
          : percent >= 75
          ? "good"
          : percent >= 60
          ? "average"
          : percent >= 50
          ? "weak"
          : "critical";

      return `
        <tr>
          <td>${i + 1}</td>

          <td class="${rowClass}" style="text-align:left">
            <div style="font-weight:600">
              ${r.staffName}
            </div>
            ${
              r.displayId
                ? `<div style="font-size:11px;color:#555">
                     (${r.displayId})
                   </div>`
                : ""
            }
          </td>

          <td class="present">${r.presentCount ?? 0}</td>
          <td class="late">${r.lateCount ?? 0}</td>
          <td class="total">${r.attendedSessions ?? 0}</td>
          <td class="absent">${r.absentCount ?? 0}</td>
          <td class="percent">${percent.toFixed(1)}%</td>
        </tr>
      `;
    })
    .join("");
}

export async function exportWeeklyStaffAttendance(
  opts: ExportWeeklyStaffPdfOptions
) {
  if (Platform.OS === "web") {
    throw new Error("PDF export not supported on web.");
  }

  const summaries = await getStaffGlobalSummary(
    opts.fromIso,
    opts.toIso
  );

  if (!summaries?.length) {
    throw new Error("No staff data found.");
  }

  const rowsHtml = generateStaffRows(summaries);

  const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      ${attendanceTableStyles}
    </style>
  </head>
  <body>
    <h1>Weekly Staff Attendance Report</h1>
    <div class="meta">
      <div>${opts.label}</div>
      <div>${opts.fromIso} → ${opts.toIso}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Staff</th>
          <th class="present">Present</th>
          <th class="late">Late</th>
          <th class="total">Attended</th>
          <th class="absent">Absent</th>
          <th class="percent">%</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
  </html>
  `;

  const result = await Print.printToFileAsync({ html });

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Weekly Staff Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}