import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/* ---------------------------------------------
   Base HTML generator for Staff PDF
---------------------------------------------- */

export async function exportStaffAttendanceBase({
  title,
  staffName,
  fromIso,
  toIso,
  summary,
  records,
}: {
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
  records: any[];
}) {
  const rowsHtml =
    records.length === 0
      ? `<tr><td colspan="5">No attendance records</td></tr>`
      : records
          .map((r: any, idx: number) => {
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
              <tr>
                <td>${idx + 1}</td>
                <td>${new Date(r.date).toLocaleDateString()}</td>
                <td>${status}</td>
                <td>${checkIn}</td>
                <td>${checkOut}</td>
              </tr>
            `;
          })
          .join("");

  const html = `
    <html>
      <body style="font-family: Arial; padding: 24px;">
        <h2>${title}</h2>

        <p><strong>Staff:</strong> ${staffName}</p>
        <p><strong>Period:</strong> ${fromIso} → ${toIso}</p>

        <h3>Summary</h3>
        <ul>
          <li>Present: ${summary.presentCount}</li>
          <li>Late: ${summary.lateCount}</li>
          <li>Absent: ${summary.absentCount}</li>
          <li>Attendance %: ${summary.percentagePresent.toFixed(1)}%</li>
        </ul>

        <h3>Attendance Timeline</h3>

        <table border="1" cellspacing="0" cellpadding="6" width="100%">
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Status</th>
            <th>Check-In</th>
            <th>Check-Out</th>
          </tr>

          ${rowsHtml}
        </table>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });

  if (Platform.OS === "ios" || Platform.OS === "android") {
    await Sharing.shareAsync(uri);
  } else {
    await Print.printAsync({ uri });
  }
}
