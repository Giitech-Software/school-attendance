// mobile/src/services/exports/exportClassAttendancePdf.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { listClasses } from "../classes";
import { getAttendanceSummary } from "../attendanceSummary";
import { generateAttendanceRows, attendanceTableStyles } from "./generateAttendanceRows";

export type ExportClassPdfOptions = {
  classId: string;
  fromIso: string;
  toIso: string;
  title?: string;
};

export async function exportClassAttendancePdf(opts: ExportClassPdfOptions) {
  const { classId, fromIso, toIso, title } = opts;

  // ---------------------------------------------
  // Resolve class name
  // ---------------------------------------------
  let classLabel = "Class";
  try {
    const classes = await listClasses();
    const match = classes.find(c => c.id === classId || c.classId === classId);
    if (match) classLabel = match.name;
  } catch (e) {
    console.warn("Failed to resolve class name", e);
  }

  // ---------------------------------------------
  // Load attendance summaries
  // ---------------------------------------------
  const summaries = await getAttendanceSummary({
    fromIso,
    toIso,
    classId,
    includeStudentName: true,
  });

  if (!summaries || summaries.length === 0) {
    throw new Error("No attendance records found");
  }

  // ---------------------------------------------
  // Generate table rows with performance coloring
  // ---------------------------------------------
  const rowsHtml = generateAttendanceRows(summaries);

  // ---------------------------------------------
  // Build full HTML
  // ---------------------------------------------
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
  <h1>${title ?? "Class Attendance Report"}</h1>

  <div class="meta">
    <div><strong>Class:</strong> ${classLabel}</div>
    <div>${fromIso} → ${toIso}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Student</th>
        <th class="present">Present</th>
        <th class="absent">Absent</th>
        <th class="late">Late</th>
        <th class="total">Total</th>
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

  // ---------------------------------------------
  // Platform handling: web vs mobile
  // ---------------------------------------------
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }

  const result = await Print.printToFileAsync({ html });
  if (!result?.uri) throw new Error("Failed to generate PDF");

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Class Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}
