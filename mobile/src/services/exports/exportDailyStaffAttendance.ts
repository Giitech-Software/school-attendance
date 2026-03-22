// mobile/src/services/exports/exportDailyStaffAttendance.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { getAllStaffAttendanceInRange, getStaffAttendanceInRange } from "../staffAttendanceSummary";
import { getStaffGlobalSummary } from "../staffAttendanceSummary";
import { attendanceTableStyles } from "./generateAttendanceRows";
/* ------------------------------------------------------------------
   Helpers for generating table rows & styles
------------------------------------------------------------------- */


/* ------------------------------------------------------------------
   Build table rows HTML
------------------------------------------------------------------- */
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
              ${r.staffName ?? "Unknown"}
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
          <td class="absent">${r.absentCount ?? 0}</td>
          <td class="percent">
            ${percent.toFixed(1)}%
          </td>
        </tr>
      `;
    })
    .join("");
}
/* ------------------------------------------------------------------
   Export function
------------------------------------------------------------------- */
export type ExportDailyStaffPdfOptions = {
  dateIso: string;
};

export async function exportDailyStaffAttendance(opts: ExportDailyStaffPdfOptions) {
  if (Platform.OS === "web") {
    throw new Error(
      "PDF export is not supported on web. Please use the mobile app."
    );
  }

  const { dateIso } = opts;

  // Fetch all staff attendance for the selected day


// With this:


const summaries = await getStaffGlobalSummary(dateIso, dateIso);

  if (!summaries || summaries.length === 0) {
    throw new Error("No staff attendance records found for this day");
  }

  // Build HTML table rows
  const rowsHtml = generateStaffRows(summaries);

  // Full HTML
 const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${attendanceTableStyles}
  </style>
</head>
<body>
  <h1>Daily Staff Attendance Report</h1>

  <div class="meta">
    <div>${dateIso}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Staff</th>
        <th class="present">Present</th>
        <th class="late">Late</th>
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

  // Generate PDF
  const result = await Print.printToFileAsync({ html });

  if (!result?.uri) {
    throw new Error("Failed to generate PDF file");
  }

  // Share PDF
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Daily Staff Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}
