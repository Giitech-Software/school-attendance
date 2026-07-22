import { query, where, getDocs, collection } from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceRecord } from "../types";
import type { AppUser } from "./users";
import { listUsersByRole } from "./users";
import { assertAttendanceCheckInOpen, assertStaffAttendanceDayAllowed, getAttendanceSettings } from "./attendanceSettings";
import { todayISO } from "./attendance";
import { recordAttendance } from "./attendance";
import { getTenantScope, tenantConstraints } from "./tenantScope";

const attendanceCollection = collection(db, "attendance");
type MovementReasonRequirement = {
  kind: "late" | "early_checkout";
  minutes: number;
};

const LATE_REASON_GRACE_MINUTES = 60;

function parseTimeToMinutes(time?: string): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesInTimezone(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return hour * 60 + minute;
  } catch {}
  return date.getHours() * 60 + date.getMinutes();
}

function getMovementReasonRequirement(settings: any, mode: "in" | "out", now = new Date()): MovementReasonRequirement | null {
  const currentMinutes = minutesInTimezone(now, settings.timezone || "Africa/Accra");
  if (mode === "in") {
    const lateAfter = parseTimeToMinutes(settings.lateAfter);
    if (lateAfter === null) return null;
    const minutesLate = currentMinutes - lateAfter;
    return minutesLate >= LATE_REASON_GRACE_MINUTES ? { kind: "late", minutes: minutesLate } : null;
  }
  const closeAfter = parseTimeToMinutes(settings.closeAfter);
  if (closeAfter === null) return null;
  const minutesEarly = closeAfter - currentMinutes;
  return minutesEarly > 0 ? { kind: "early_checkout", minutes: minutesEarly } : null;
}

function cleanMovementReason(reason?: string | null) {
  return (reason ?? "").trim();
}

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
    where("date", "<=", toIso),
    ...tenantConstraints(await getTenantScope())
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
    where("date", "==", date),
    ...tenantConstraints(await getTenantScope())
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
  movementReason,
}: {
  staffId: string;
  mode: "in" | "out";
  method?: "qr" | "fingerprint" | "face" | "manual";
  biometric?: boolean;
  movementReason?: string | null;
}): Promise<AttendanceRecord> {
  const date = todayISO();
  const existing = await findStaffAttendanceForDate(staffId, date);
  await assertStaffAttendanceDayAllowed();

  if (mode === "in") {
    if (existing?.checkInTime) throw new Error("Staff already checked-in today.");
    const settings = await assertAttendanceCheckInOpen();
    const now = new Date().toISOString();
    const movementRequirement = getMovementReasonRequirement(settings, "in", new Date(now));
    const cleanedReason = cleanMovementReason(movementReason);
    if (movementRequirement && !cleanedReason) throw new Error("A movement book entry is required for this late arrival.");
    return recordAttendance({
      subjectType: "staff",
      subjectId: staffId,
      staffId,
      date,
      type: "in",
      method,
      biometric,
      status: isLate(now, settings.lateAfter) ? "late" : "present",
      lateReason: movementRequirement?.kind === "late" ? cleanedReason : null,
      lateMinutes: movementRequirement?.kind === "late" ? movementRequirement.minutes : null,
    } as any);
  }

  if (!existing) throw new Error("Staff must check-in before checking-out.");
  if (existing.checkOutTime) throw new Error("Staff already checked-out today.");

  const settings = await getAttendanceSettings();
  const movementRequirement = getMovementReasonRequirement(settings, "out");
  const cleanedReason = cleanMovementReason(movementReason);
  if (movementRequirement && !cleanedReason) throw new Error("A movement book entry is required for this early departure.");

  return recordAttendance({
    ...existing,
    subjectType: "staff",
    subjectId: staffId,
    staffId,
    date,
    type: "out",
    method: existing.method ?? method,
    biometric,
    earlyCheckoutReason: movementRequirement?.kind === "early_checkout" ? cleanedReason : null,
    earlyCheckoutMinutes: movementRequirement?.kind === "early_checkout" ? movementRequirement.minutes : null,
  } as any);
}

