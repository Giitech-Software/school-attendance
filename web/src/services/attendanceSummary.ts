// shared/services/attendanceSummary.ts
import { query, where, getDocs, collection } from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceRecord } from "../types";

/**
 * Summary helpers that compute attendance % and counts for a date range.
 * - date strings are expected in YYYY-MM-DD format and match the `date` field in AttendanceRecord
 */

const attendanceCollection = collection(db, "attendance");

export type AttendanceSummary = {
  studentId: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  totalSessions: number;
  percentagePresent: number; // 0..100
};

/** Get attendance records for a student in a date range (inclusive) */
export async function getAttendanceForStudentInRange(studentId: string, fromIso: string, toIso: string): Promise<AttendanceRecord[]> {
  // Firestore doesn't support range queries on different fields easily; assumption: date is YYYY-MM-DD string and we can query by >= <= on same field
  const q = query(
    attendanceCollection,
    where("studentId", "==", studentId),
    where("date", ">=", fromIso),
    where("date", "<=", toIso)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord));
}

/** Compute attendance summary for a student in a date range */
export async function computeAttendanceSummaryForStudent(studentId: string, fromIso: string, toIso: string): Promise<AttendanceSummary> {
  const records = await getAttendanceForStudentInRange(studentId, fromIso, toIso);
  let present = 0;
  let absent = 0;
  let late = 0;

  for (const r of records) {
    const s = r.status ?? (r.checkInTime ? "present" : "absent");
    if (s === "present") present++;
    else if (s === "absent") absent++;
    else if (s === "late") late++;
  }

  const total = records.length;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 10000) / 100; // 2 decimals

  return {
    studentId,
    presentCount: present,
    absentCount: absent,
    lateCount: late,
    totalSessions: total,
    percentagePresent: percentage,
  };
}

/** Compute class-level summary: aggregates per-student summaries for a class within date range */
export async function computeClassSummary(classId: string, fromIso: string, toIso: string) {
  // fetch all attendance items for class in range, then aggregate by studentId
  const q = query(
    attendanceCollection,
    where("classId", "==", classId),
    where("date", ">=", fromIso),
    where("date", "<=", toIso)
  );
  const snap = await getDocs(q);
  const byStudent = new Map<string, AttendanceRecord[]>();
  for (const d of snap.docs) {
    const rec = { id: d.id, ...(d.data() as any) } as AttendanceRecord;
    const arr = byStudent.get(rec.studentId) ?? [];
    arr.push(rec);
    byStudent.set(rec.studentId, arr);
  }

  const summaries: AttendanceSummary[] = [];
  for (const [studentId, recs] of byStudent.entries()) {
    let present = 0;
    let absent = 0;
    let late = 0;
    for (const r of recs) {
      const s = r.status ?? (r.checkInTime ? "present" : "absent");
      if (s === "present") present++;
      else if (s === "absent") absent++;
      else if (s === "late") late++;
    }
    const total = recs.length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 10000) / 100;
    summaries.push({
      studentId,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      totalSessions: total,
      percentagePresent: percentage,
    });
  }

  return summaries;
}
