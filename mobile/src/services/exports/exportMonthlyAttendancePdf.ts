// mobile/src/services/exports/exportMonthlyAttendancePdf.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { getAttendanceSummary } from "../attendanceSummary";
import { listClasses } from "../classes";
import { generateAttendanceRows, attendanceTableStyles } from "./generateAttendanceRows";

/* ---------------------------------------------
   Monthly Attendance PDF Export
---------------------------------------------- */

export type ExportMonthlyPdfOptions = {
  fromIso: string;
  toIso: string;
  label: string;
  classId?: string;
};

export async function exportMonthlyAttendancePdf(
  opts: ExportMonthlyPdfOptions
) {
  const { fromIso, toIso, label, classId } = opts;

  /* ---------------------------------------------
     Platform guard
  ---------------------------------------------- */
  if (Platform.OS === "web") {
    throw new Error(
      "PDF export is not supported on web. Please use the mobile app."
    );
  }

  /* ---------------------------------------------
     Resolve class name
  ---------------------------------------------- */
  let classLabel = "All Classes";
  if (classId) {
    try {
      const classes = await listClasses();
      const match = classes.find(c => c.id === classId || c.classId === classId);
      if (match) classLabel = match.name;
    } catch (err) {
      console.warn("Failed to resolve class name", err);
    }
  }

  const title = "Monthly Attendance Report";

  /* ---------------------------------------------
     Load summaries
  ---------------------------------------------- */
  const summaries = await getAttendanceSummary({
    fromIso,
    toIso,
    classId,
    includeStudentName: true,
    scope: "monthly",
  });

  if (!summaries || summaries.length === 0) {
    throw new Error("No attendance records found for this month");
  }

  /* ---------------------------------------------
     Build table rows with performance coloring
  ---------------------------------------------- */
  const rowsHtml = generateAttendanceRows(summaries);

  /* ---------------------------------------------
     HTML Template
  ---------------------------------------------- */
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
    <div><strong>Class:</strong> ${classLabel}</div>
    <div>${label}</div>
    <div>${fromIso} → ${toIso}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
          <th>Student</th>
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

  /* ---------------------------------------------
     Generate PDF
  ---------------------------------------------- */
  const result = await Print.printToFileAsync({ html });
  if (!result?.uri) {
    throw new Error("Failed to generate PDF file");
  }

  /* ---------------------------------------------
     Share PDF
  ---------------------------------------------- */
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Monthly Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}
