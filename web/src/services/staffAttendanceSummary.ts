import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getTenantScope, tenantConstraints } from "./tenantScope";
import type { AttendanceRecord } from "../types";

const attendanceCollection = collection(db, "attendance");
const staffCollection = collection(db, "staff");

function normalizeIsoDate(d?: string) {
  if (!d) return "";
  return d.length > 10 ? d.slice(0, 10) : d;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
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

function summarizeStaffRecords(records: AttendanceRecord[], expectedDates: string[]) {
  const statusByDate = new Map<string, "present" | "late" | "absent">();

  records.forEach((record) => {
    const date = normalizeIsoDate(record.date);
    if (!date) return;
    const status = (record.status ?? (record.checkInTime ? "present" : "absent")) as "present" | "late" | "absent";
    const current = statusByDate.get(date);
    if (!current || statusRank(status) > statusRank(current)) statusByDate.set(date, status);
  });

  let present = 0;
  let late = 0;
  let absent = 0;
  for (const date of expectedDates) {
    const status = statusByDate.get(date);
    if (status === "present") present++;
    else if (status === "late") late++;
    else absent++;
  }

  const attendedSessions = present + late;
  const totalDays = expectedDates.length;
  const score = present + late * 0.5;
  const percentagePresent = totalDays === 0 ? 0 : Number(((score / totalDays) * 100).toFixed(2));
  return { present, late, absent, attendedSessions, totalDays, percentagePresent };
}


export type StaffAttendanceSummary = {
  staffId: string;
  staffName: string;
  displayId?: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendedSessions: number;
  totalDays: number;
  totalSessions?: number;
  percentagePresent: number;
};

export async function getStaffAttendanceInRange(
  staffId: string,
  fromIso: string,
  toIso: string
): Promise<AttendanceRecord[]> {
  const q = query(
    attendanceCollection,
    where("subjectType", "==", "staff"),
    where("subjectId", "==", staffId),
    where("date", ">=", fromIso),
    where("date", "<=", toIso),
    ...tenantConstraints(await getTenantScope())
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord));
}

export async function getStaffGlobalSummary(fromIso: string, toIso: string): Promise<StaffAttendanceSummary[]> {
  const staffSnap = await getDocs(query(staffCollection, ...tenantConstraints(await getTenantScope())));
  const allStaff = staffSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((staff) => staff.isActive !== false);

  const expectedDates = getSchoolDaysInRange(fromIso, toIso);
  const summaries = await Promise.all(
    allStaff.map(async (staff: any) => {
      const records = await getStaffAttendanceInRange(staff.id, fromIso, toIso);
      const {
        present,
        late,
        absent,
        attendedSessions,
        totalDays,
        percentagePresent,
      } = summarizeStaffRecords(records, expectedDates);

      return {
        staffId: staff.id,
        staffName: staff.name || "Unknown Staff",
        displayId: staff.staffId || staff.id,
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        attendedSessions,
        totalDays,
        totalSessions: totalDays,
        percentagePresent,
      };
    })
  );

  return summaries;
}

export async function getAllStaffAttendanceInRange(fromIso: string, toIso: string): Promise<AttendanceRecord[]> {
  const q = query(attendanceCollection, where("subjectType", "==", "staff"), where("date", ">=", fromIso), where("date", "<=", toIso),
    ...tenantConstraints(await getTenantScope()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord));
}
