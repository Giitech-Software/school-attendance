import { query, where, getDocs, collection } from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceRecord } from "../types";
import type { AppUser } from "./users";
import { listUsersByRole } from "./users";
import { assertAttendanceCheckInOpen } from "./attendanceSettings";
import { todayISO } from "./attendance";
import { recordAttendance } from "./attendance";

const attendanceCollection = collection(db, "attendance");

export type StaffAttendanceSummary = {
  staffId: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  totalSessions: number;
  percentagePresent: number;
};

export async function listStaffUsers(): Promise<AppUser[]> {
  return listUsersByRole("teacher");
}

export async function getStaffAttendanceRecords(
  staffId: string,
  fromIso: string,
  toIso: string
): Promise<AttendanceRecord[]> {
  const q = query(
    attendanceCollection,
    where("subjectType", "==", "staff"),
    where("date", ">=", fromIso),
    where("date", "<=", toIso)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord))
    .filter((record) => record.subjectId === staffId || record.staffId === staffId);
}

export async function computeStaffAttendanceSummary(
  staffId: string,
  fromIso: string,
  toIso: string
): Promise<StaffAttendanceSummary> {
  const records = await getStaffAttendanceRecords(staffId, fromIso, toIso);

  let present = 0;
  let absent = 0;
  let late = 0;

  for (const record of records) {
    const status = record.status ?? (record.checkInTime ? "present" : "absent");
    if (status === "late") late++;
    else if (status === "absent") absent++;
    else present++;
  }

  const total = present + absent + late;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 10000) / 100;

  return {
    staffId,
    presentCount: present,
    absentCount: absent,
    lateCount: late,
    totalSessions: total,
    percentagePresent: percentage,
  };
}

function isLate(checkInIso: string, lateAfter: string): boolean {
  const checkIn = new Date(checkInIso);
  const [h, m] = lateAfter.split(":").map(Number);
  const lateTime = new Date(checkIn);
  lateTime.setHours(h, m, 0, 0);
  return checkIn > lateTime;
}

export async function findStaffAttendanceForDate(staffId: string, date: string): Promise<AttendanceRecord | null> {
  const q = query(
    attendanceCollection,
    where("subjectType", "==", "staff"),
    where("subjectId", "==", staffId),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() as any) } as AttendanceRecord;
}

export async function registerStaffAttendance({
  staffId,
  mode,
  method = "manual",
  biometric = false,
}: {
  staffId: string;
  mode: "in" | "out";
  method?: "qr" | "fingerprint" | "face" | "manual";
  biometric?: boolean;
}): Promise<AttendanceRecord> {
  const date = todayISO();
  const existing = await findStaffAttendanceForDate(staffId, date);

  if (mode === "in") {
    if (existing?.checkInTime) throw new Error("Staff already checked-in today.");
    const settings = await assertAttendanceCheckInOpen();
    const now = new Date().toISOString();
    return recordAttendance({
      subjectType: "staff",
      subjectId: staffId,
      staffId,
      date,
      type: "in",
      method,
      biometric,
      status: isLate(now, settings.lateAfter) ? "late" : "present",
    } as any);
  }

  if (!existing) throw new Error("Staff must check-in before checking-out.");
  if (existing.checkOutTime) throw new Error("Staff already checked-out today.");

  return recordAttendance({
    ...existing,
    subjectType: "staff",
    subjectId: staffId,
    staffId,
    date,
    type: "out",
    method: existing.method ?? method,
    biometric,
  } as any);
}
