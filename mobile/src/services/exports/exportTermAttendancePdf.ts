// mobile/src/services/exports/exportTermAttendancePdf.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { getAttendanceSummary } from "../attendanceSummary";
import { getTerm } from "../terms"; 
import { listWeeks } from "../weeks";
import { listClasses } from "../classes";
import { generateAttendanceRows, attendanceTableStyles } from "./generateAttendanceRows";

/* ---------------------------------------------
   Term Attendance PDF Export
---------------------------------------------- */

type ExportTermPdfOptions = {
  termId: string;
  classId?: string;
};

export async function exportTermAttendancePdf(opts: ExportTermPdfOptions) {
  if (Platform.OS === "web") {
    throw new Error("PDF export is not supported on web.");
  }

  // Load term
  const term = await getTerm(opts.termId);
  if (!term) throw new Error("Term not found");

  // Resolve class name
  let classLabel = "All Classes";
  if (opts.classId) {
    try {
      const classes = await listClasses();
      const match = classes.find(c => c.id === opts.classId || c.classId === opts.classId);
      if (match) classLabel = match.name;
    } catch (err) {
      console.warn("Failed to resolve class name", err);
    }
  }

  const title = "Term Attendance Report";
  const subtitle = `${term.name} (${term.startDate} → ${term.endDate})`;

  // Load weeks for term
  const weeks = await listWeeks(term.id);
  if (!weeks || weeks.length === 0) throw new Error("No weeks found for this term");

  // Build weekly sections
  let contentHtml = "";
  for (const week of weeks) {
    const summaries = await getAttendanceSummary({
      fromIso: week.startDate,
      toIso: week.endDate,
      classId: opts.classId,
      includeStudentName: true,
      scope: "weekly",
    });

    if (!summaries || summaries.length === 0) continue;

    // Use the shared helper to generate rows with performance-based coloring
    const rowsHtml = generateAttendanceRows(summaries);

    contentHtml += `
      <h2>
        Week ${week.weekNumber}
        <span class="week-range">(${week.startDate} → ${week.endDate})</span>
      </h2>

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
    `;
  }

  if (!contentHtml) throw new Error("No attendance data available for this term");

  // Build full HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${attendanceTableStyles}

    h2 {
      margin-top: 32px;
      margin-bottom: 8px;
      font-size: 16px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
    }

    .week-range {
      font-size: 12px;
      font-weight: normal;
      color: #666;
      margin-left: 6px;
    }

    table {
      margin-bottom: 16px;
    }

    @media print {
      h2 { page-break-before: always; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    <div><strong>Class:</strong> ${classLabel}</div>
    <div>${subtitle}</div>
  </div>

  ${contentHtml}
</body>
</html>
`;

  // Generate PDF & share
  const result = await Print.printToFileAsync({ html });
  if (!result?.uri) throw new Error("Failed to generate PDF file");

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Term Attendance PDF",
    UTI: "com.adobe.pdf",
  });
}
