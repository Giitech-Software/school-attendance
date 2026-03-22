// mobile/src/services/exports/generateAttendanceRows.ts

/* ---------------------------------------------
   Generate HTML table rows + shared CSS
---------------------------------------------- */

export function generateAttendanceRows(
  summaries: any[],
  options?: { includeTotal?: boolean }
) {
  const includeTotal = options?.includeTotal ?? true;

  return summaries
    .map((s, idx) => {
      const rowClass =
        s.percentagePresent === 100
          ? "excellent"
          : s.percentagePresent >= 75
          ? "good"
          : s.percentagePresent >= 60
          ? "average"
          : s.percentagePresent >= 50
          ? "weak"
          : "critical";

      return `
        <tr>
          <td>${idx + 1}</td>
        
           <td class="${rowClass}" style="text-align:left">
  <div style="font-weight:600">
    ${s.studentName}
  </div>
 <div style="font-size:11px;color:#555">
  (${s.displayId || s.rollNumber || ""})
</div>

</td>

</td>


          </td>
        <td class="present">${s.presentCount}</td>
<td class="late">${s.lateCount}</td>
${includeTotal ? `<td class="total">${s.attendedSessions}</td>` : ""}
<td class="absent">${s.absentCount}</td>
<td class="percent">${s.percentagePresent.toFixed(1)}%</td>

      `;
    })
    .join("");
}


/* ---------------------------------------------
   Shared CSS for all PDF exports
---------------------------------------------- */
export const attendanceTableStyles = `
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
  padding: 24px;
  color: #111;
}

h1 { text-align: center; margin-bottom: 4px; }

.meta {
  text-align: center;
  margin-bottom: 24px;
  font-size: 14px;
  color: #555;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th, td {
  border: 1px solid #ddd;
  padding: 6px 8px;
  text-align: center;
}

th { background: #f1f5f9; font-weight: 600; }

/* Alternating rows */
tbody tr:nth-child(even) { background: #f8fafc; }

/* Column colors */
th.present, td.present { background: #dcfce7; color: #166534; }
th.late, td.late { background: #fef3c7; color: #92400e; }
th.total, td.total { background: #e0f2fe; color: #075985; }
th.absent, td.absent { background: #fee2e2; color: #991b1b; }
th.percent, td.percent { background: #ede9fe; color: #5b21b6; font-weight: 600; }

/* Performance-based student name colors */
td.excellent { background-color: #dcfce7; }
td.good { background-color: #ecfeff; }
td.average { background-color: #ffe5b4; }
td.weak { background-color: #fde68a; }
td.critical { background-color: #fecaca; }
`;
