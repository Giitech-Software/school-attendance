// mobile/src/services/exports/exportTermStaffAttendancePdf.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { getStaffGlobalSummary } from "../staffAttendanceSummary";
import {
  generateAttendanceRows,
  attendanceTableStyles,
} from "./generateAttendanceRows";

type ExportTermStaffPdfOptions = {
  fromIso: string;
  toIso: string;
  label: string;
};

export async function exportTermStaffAttendancePdf(
  opts: ExportTermStaffPdfOptions
) {
  const { fromIso, toIso, label } = opts;

  if (Platform.OS === "web") {
    throw new Error("PDF export not supported on web.");
  }

  const summaries = await getStaffGlobalSummary(fromIso, toIso);

  if (!summaries || summaries.length === 0) {
    throw new Error("No staff attendance records found for this term");
  }

  /* ---------------------------------------------
     🔥 Transform staff → student shape
  ---------------------------------------------- */

 const formatted = summaries.map((s: any, index: number) => ({
  studentName: s.staffName,                // name column
  displayId: s.displayId ?? s.staffId,    // ID column
  presentCount: s.presentCount ?? 0,
  lateCount: s.lateCount ?? 0,
  attendedSessions: s.attendedSessions ?? 0,
  absentCount: s.absentCount ?? 0,
  percentagePresent: s.percentagePresent ?? 0,
}));

  /* ---------------------------------------------
     Use SAME row generator as students
  ---------------------------------------------- */

  const rowsHtml = generateAttendanceRows(formatted);

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
  <h1>Term Staff Attendance Report</h1>

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
    throw new Error("Failed to generate PDF");
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Term Staff Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}