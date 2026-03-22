import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { listClasses } from "../classes";

import {
  computeAttendanceSummaryForStudent,
  getAttendanceForStudentInRange,
} from "../attendanceSummary";

import type { AttendanceRecord } from "../types";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../app/firebase";
import { exportStudentAttendanceBase } from "./exportStudentAttendanceBase";

/* ---------------------------------------------
   Student Attendance PDF Export
---------------------------------------------- */

export type ExportStudentPdfOptions = {
  studentId: string;
  fromIso: string;
  toIso: string;
  title?: string;
};

export async function exportStudentAttendancePdf(
  opts: ExportStudentPdfOptions
) {
  const { studentId, fromIso, toIso, title } = opts;

  /* ---------------------------------------------
     Resolve student + class
  ---------------------------------------------- */
  const snap = await getDoc(doc(db, "students", studentId));

 let studentName = "Student";
let classLabel = "—";

if (snap.exists()) {
  const data = snap.data();

  // ✅ STUDENT DISPLAY RULE (GLOBAL RULE)
  const name = data.name ?? "Student";
const studentCode = data.studentId ?? data.rollNo;

studentName = studentCode
  ? `${name} (${studentCode})`
  : name;

  // ✅ CLASS RESOLUTION (UNCHANGED)
  try {
    const classes = await listClasses();
    const match = classes.find(
      (c) =>
        c.id === data.classDocId ||
        c.classId === data.classId
    );
    if (match) classLabel = match.name;
  } catch (e) {
    console.warn("Failed to resolve class name", e);
  }
}


  /* ---------------------------------------------
     Load data
  ---------------------------------------------- */
  const summary = await computeAttendanceSummaryForStudent(
    studentId,
    fromIso,
    toIso
  );

  const records: AttendanceRecord[] =
    await getAttendanceForStudentInRange(
      studentId,
      fromIso,
      toIso
    );

  /* ---------------------------------------------
     Build rows
  ---------------------------------------------- */
  const rowsHtml =
    records.length === 0
      ? `<tr><td colspan="5">No attendance records</td></tr>`
      : records
          .map((r: AttendanceRecord, idx: number) => {
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

  await exportStudentAttendanceBase({
  title: title ?? "Student Attendance Report",
  studentName,
  classLabel,
  fromIso,
  toIso,
  summary: {
    presentCount: summary.presentCount,
    absentCount: summary.absentCount,
    lateCount: summary.lateCount,
    percentagePresent: summary.percentagePresent,
  },
  records,
});
}