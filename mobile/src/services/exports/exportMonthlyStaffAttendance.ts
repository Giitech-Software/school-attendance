import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { getStaffGlobalSummary } from "../staffAttendanceSummary";
import { attendanceTableStyles } from "./generateAttendanceRows";

import { exportStaffAttendancePdf } from "./exportStaffAttendancePdf";

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);

  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}

export async function exportMonthlySingleStaffAttendance(
  staffId: string,
  year: number,
  month: number // 0-based
) {
  const { fromIso, toIso } = getMonthRange(year, month);

  await exportStaffAttendancePdf({
    staffId,
    fromIso,
    toIso,
    title: "Monthly Staff Attendance Report",
  });
}
/* ---------------------------------------------
   Monthly Staff Attendance PDF Export
---------------------------------------------- */

export type ExportMonthlyStaffPdfOptions = {
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

export async function exportMonthlyStaffAttendance(
  opts: ExportMonthlyStaffPdfOptions
) {
  const { fromIso, toIso, label } = opts;

  if (Platform.OS === "web") {
    throw new Error(
      "PDF export is not supported on web. Please use the mobile app."
    );
  }

  const title = "Monthly Staff Attendance Report";

  const summaries = await getStaffGlobalSummary(fromIso, toIso);

  if (!summaries || summaries.length === 0) {
    throw new Error("No staff attendance records found for this month");
  }

  const rowsHtml = generateStaffRows(summaries);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${attendanceTableStyles}

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
      margin-bottom: 20px;
      font-size: 14px;
      color: #555;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>

  <div class="meta">
    <div>${label}</div>
    <div>${fromIso} → ${toIso}</div>
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

  if (!result?.uri) {
    throw new Error("Failed to generate PDF file");
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Monthly Staff Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}