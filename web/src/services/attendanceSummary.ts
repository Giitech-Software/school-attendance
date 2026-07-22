import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { belongsToTenant, getTenantScope, tenantConstraints } from "./tenantScope";
import type { AttendanceRecord } from "../types";

const attendanceCollection = collection(db, "attendance");
const studentsCollection = collection(db, "students");

export type AttendanceScope = "daily" | "weekly" | "monthly" | "termly";

export type AttendanceSummary = {
  studentId: string;
  displayId?: string;
  studentName?: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendedSessions: number;
  totalSchoolDays: number;
  totalSessions?: number;
  percentagePresent: number;
};

export type GetAttendanceSummaryOptions = {
  days?: number;
  fromIso?: string;
  toIso?: string;
  classId?: string;
  includeStudentName?: boolean;
  studentId?: string;
  scope?: AttendanceScope;
};

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function normalizeIsoDate(d?: string) {
  if (!d) return "";
  return d.length > 10 ? d.slice(0, 10) : d;
}

function getLastNSchoolDays(n: number, today = new Date()): string[] {
  const result: string[] = [];
  const cursor = new Date(today);

  while (result.length < n) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) result.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  return result.reverse();
}

function getSchoolDaysInRange(fromIso: string, toIso: string): string[] {
  const start = new Date(`${normalizeIsoDate(fromIso)}T12:00:00`);
  const end = new Date(`${normalizeIsoDate(toIso)}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) days.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function statusRank(status: string) {
  if (status === "present") return 3;
  if (status === "late") return 2;
  if (status === "absent") return 1;
  return 0;
}

function summarizeRecords(studentId: string, records: AttendanceRecord[], expectedDates: string[] = []): AttendanceSummary {
  const statusByDate = new Map<string, "present" | "late" | "absent">();

  for (const record of records) {
    const date = normalizeIsoDate(record.date);
    if (!date) continue;

    const status = (record.status ?? (record.checkInTime ? "present" : "absent")) as "present" | "late" | "absent";
    const current = statusByDate.get(date);
    if (!current || statusRank(status) > statusRank(current)) {
      statusByDate.set(date, status);
    }
  }

  const datesToCount = expectedDates.length ? expectedDates : Array.from(statusByDate.keys());
  let present = 0;
  let absent = 0;
  let late = 0;

  for (const date of datesToCount) {
    const status = statusByDate.get(date);
    if (status === "present") present++;
    else if (status === "late") late++;
    else absent++;
  }

  const totalSchoolDays = datesToCount.length;
  const attendedSessions = present + late;
  const score = present + late * 0.5;
  const percentagePresent = totalSchoolDays === 0 ? 0 : Number(((score / totalSchoolDays) * 100).toFixed(2));

  return {
    studentId,
    presentCount: present,
    lateCount: late,
    absentCount: absent,
    attendedSessions,
    totalSchoolDays,
    totalSessions: totalSchoolDays,
    percentagePresent,
  };
}
export async function getAttendanceForStudentInRange(
  studentId: string,
  fromIso: string,
  toIso: string
): Promise<AttendanceRecord[]> {
  if (!studentId || !fromIso || !toIso) return [];

  const q = query(
    attendanceCollection,
    where("studentId", "==", studentId),
    where("date", ">=", normalizeIsoDate(fromIso)),
    where("date", "<=", normalizeIsoDate(toIso)),
    ...tenantConstraints(await getTenantScope())
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord));
}

export async function computeAttendanceSummaryForStudent(
  studentId: string,
  fromIso: string,
  toIso: string,
  expectedDates = getSchoolDaysInRange(fromIso, toIso)
): Promise<AttendanceSummary> {
  const records = await getAttendanceForStudentInRange(studentId, fromIso, toIso);
  return summarizeRecords(studentId, records, expectedDates);
}

export async function computeClassSummary(
  classId: string,
  fromIso: string,
  toIso: string,
  includeStudentName = false
): Promise<AttendanceSummary[]> {
  const q = query(
    attendanceCollection,
    where("classId", "==", classId),
    where("date", ">=", normalizeIsoDate(fromIso)),
    where("date", "<=", normalizeIsoDate(toIso)),
    ...tenantConstraints(await getTenantScope())
  );

  const snap = await getDocs(q);
  const byStudent = new Map<string, AttendanceRecord[]>();

  for (const d of snap.docs) {
    const rec = { id: d.id, ...(d.data() as any) } as AttendanceRecord;
    if (!rec.studentId) continue;
    byStudent.set(rec.studentId, [...(byStudent.get(rec.studentId) ?? []), rec]);
  }

  const studentDetails: Record<string, { name: string; displayId: string }> = {};
  if (includeStudentName) {
    const scope = await getTenantScope();
    const studentDocs = await Promise.all(Array.from(byStudent.keys()).map((id) => getDoc(doc(db, "students", id))));
    studentDocs.forEach((snapDoc) => {
      if (!snapDoc.exists()) return;
      const data = snapDoc.data();
      if (!belongsToTenant(data, scope)) return;
      studentDetails[snapDoc.id] = {
        name: data.name ?? data.studentId ?? data.rollNo ?? "",
        displayId: data.studentId ?? data.rollNo ?? data.studentCode ?? "",
      };
    });
  }

  const expectedDates = getSchoolDaysInRange(fromIso, toIso);
  const out = Array.from(byStudent.entries()).map(([studentId, records]) => ({
    ...summarizeRecords(studentId, records, expectedDates),
    displayId: includeStudentName ? studentDetails[studentId]?.displayId : undefined,
    studentName: includeStudentName ? studentDetails[studentId]?.name : undefined,
  }));

  out.sort((a, b) => b.percentagePresent - a.percentagePresent);
  return out;
}

export async function getAttendanceSummary(opts: GetAttendanceSummaryOptions = {}): Promise<AttendanceSummary[]> {
  const days = opts.days ?? 5;
  const range = opts.fromIso && opts.toIso ? [opts.fromIso, opts.toIso] : getLastNSchoolDays(days);
  const fromIso = opts.fromIso && opts.toIso ? range[0] : range[0];
  const toIso = opts.fromIso && opts.toIso ? range[1] : range[range.length - 1];

  const expectedDates = getSchoolDaysInRange(fromIso, toIso);
  let students: any[] = [];

  if (opts.studentId) {
    const scope = await getTenantScope();
    const snap = await getDoc(doc(db, "students", opts.studentId));
    if (!snap.exists() || !belongsToTenant(snap.data(), scope)) return [];
    students = [{ id: snap.id, ...(snap.data() as any) }];
  } else {
    const scope = await getTenantScope();
    const snap = await getDocs(query(studentsCollection, ...tenantConstraints(scope)));
    students = snap.docs.map((studentDoc) => ({ id: studentDoc.id, ...(studentDoc.data() as any) }));
  }

  students = students.filter((student) => student.isActive !== false);

  if (opts.classId) {
    students = students.filter((student) => student.classId === opts.classId || student.classDocId === opts.classId);
  }

  const summaries = await Promise.all(
    students.map(async (student) => {
      const summary = await computeAttendanceSummaryForStudent(student.id, fromIso, toIso, expectedDates);
      return {
        ...summary,
        studentId: student.id,
        displayId: student.studentId ?? student.rollNo ?? "",
        studentName: opts.includeStudentName ? student.name ?? "" : undefined,
      };
    })
  );

  summaries.sort((a, b) => b.percentagePresent - a.percentagePresent);
  (summaries as any).__fromIso = fromIso;
  (summaries as any).__toIso = toIso;
  return summaries;
}





