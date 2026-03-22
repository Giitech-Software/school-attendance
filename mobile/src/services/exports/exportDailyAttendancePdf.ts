// mobile/src/services/exports/exportDailyAttendancePdf.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { getAttendanceSummary } from "../attendanceSummary";
import { listClasses } from "../classes";
import { generateAttendanceRows, attendanceTableStyles } from "./generateAttendanceRows";

/* ---------------------------------------------
   Daily Attendance PDF Export
---------------------------------------------- */

export type ExportDailyPdfOptions = {
  dateIso: string;
  classId?: string | null;
};

export async function exportDailyAttendancePdf(opts: ExportDailyPdfOptions) {
  /* ---------------------------------------------
     Platform guard
  ---------------------------------------------- */
  if (Platform.OS === "web") {
    throw new Error(
      "PDF export is not supported on web. Please use the mobile app."
    );
  }

  const { dateIso, classId } = opts;
  const fromIso = dateIso;
  const toIso = dateIso;

  /* ---------------------------------------------
     Resolve class name
  ---------------------------------------------- */
  let classLabel = "All Classes";

  if (classId) {
    try {
      const classes = await listClasses();
      const match = classes.find(
        (c) => c.id === classId || c.classId === classId
      );
      if (match) classLabel = match.name;
    } catch (err) {
      console.warn("Failed to resolve class name", err);
    }
  }

  /* ---------------------------------------------
     Load summaries
  ---------------------------------------------- */
  const summaries = await getAttendanceSummary({
    fromIso,
    toIso,
    classId: classId ?? undefined,
    includeStudentName: true,
    scope: "daily",
  });

  if (!summaries || summaries.length === 0) {
    throw new Error("No attendance records found for this day");
  }

  /* ---------------------------------------------
     Build table rows (6 columns for daily)
  ---------------------------------------------- */
  const rowsHtml = generateAttendanceRows(summaries, { includeTotal: false });

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
  </style>
</head>
<body>
  <h1>Daily Attendance Report</h1>
  <div class="meta">
    <div><strong>Class:</strong> ${classLabel}</div>
    <div>${dateIso}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
           <th>Student</th>
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

  /* ---------------------------------------------
     Generate PDF & Share
  ---------------------------------------------- */
  const result = await Print.printToFileAsync({ html });

  if (!result?.uri) {
    throw new Error("Failed to generate PDF file");
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Daily Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}
