import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceRecord } from "../types";
import { assertAttendanceCheckInOpen, getAttendanceSettings } from "./attendanceSettings";
import { validateAttendancePresence } from "./locationGuard";
import { getTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

const attendanceCollection = collection(db, "attendance");

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
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
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
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

function normalizeAttendance(data: any): AttendanceRecord {
  return {
    ...data,
    type: data.type ?? (data.checkOutTime ? "out" : "in"),
    checkInTime: data.checkInTime ?? null,
    checkOutTime: data.checkOutTime ?? null,
    status: data.status ?? "present",
    method: data.method ?? "manual",
    biometric: data.biometric ?? false,
  } as AttendanceRecord;
}

function isLate(checkInIso: string, lateAfter: string): boolean {
  const checkIn = new Date(checkInIso);
  const [h, m] = lateAfter.split(":").map(Number);
  const lateTime = new Date(checkIn);
  lateTime.setHours(h, m, 0, 0);
  return checkIn > lateTime;
}

async function buildPresenceAudit(checkedAt: string) {
  const validation = await validateAttendancePresence();
  return {
    verificationMethod: validation.verificationMethod,
    campusNetworkVerified: validation.campusNetworkVerified ?? false,
    campusServerName: validation.campusServerName ?? null,
    campusInstitutionId: validation.campusInstitutionId ?? null,
    campusTokenExpiresAt: validation.campusTokenExpiresAt ?? null,
    wifiBssidVerified: validation.wifiBssidVerified ?? false,
    wifiBssid: validation.wifiBssid ?? null,
    wifiSsid: validation.wifiSsid ?? null,
    wifiLabel: validation.wifiLabel ?? null,
    latitude: validation.latitude,
    longitude: validation.longitude,
    accuracyMeters: validation.accuracyMeters,
    distanceMeters:
      typeof validation.distanceMeters === "number"
        ? Math.round(validation.distanceMeters)
        : null,
    allowedDistanceMeters:
      typeof validation.allowedDistanceMeters === "number"
        ? Math.round(validation.allowedDistanceMeters)
        : null,
    radiusMeters: validation.radiusMeters,
    geofencingBypassed: validation.geofencingBypassed,
    bypassReason: validation.bypassReason ?? null,
    bypassedBy: validation.bypassedBy ?? null,
    bypassExpiresAt: validation.bypassExpiresAt ?? null,
    checkedAt,
  };
}

async function writeAttendance(record: Partial<AttendanceRecord> & {
  subjectType: "student" | "staff";
  subjectId: string;
  date: string;
  type: "in" | "out";
}) {
  const now = new Date().toISOString();
  const location = await buildPresenceAudit(now);
  const scope = await getTenantScope();

  if (record.id) {
    const { id, createdAt, ...updateFields } = record;
    if (record.type === "out") updateFields.checkOutTime = now;
    if (record.type === "in" && !record.checkInTime) updateFields.checkInTime = now;
    updateFields.location = location;
    const scopedUpdate = withTenantScope(updateFields, scope);
    await updateDoc(doc(db, "attendance", id), scopedUpdate);
    return normalizeAttendance({ id, ...scopedUpdate });
  }

  const payload = withTenantScope({
    ...record,
    createdAt: serverTimestamp(),
    checkInTime: now,
    checkOutTime: null,
    biometric: record.biometric ?? false,
    method: record.method ?? "manual",
    location,
  }, scope);
  const ref = await addDoc(attendanceCollection, payload);
  return normalizeAttendance({ id: ref.id, ...payload, createdAt: now });
}

export async function findAttendance(
  studentId: string,
  classId: string,
  date: string,
  classDocId?: string
): Promise<AttendanceRecord | null> {
  const filters: any[] = [where("studentId", "==", studentId), where("classId", "==", classId), where("date", "==", date), ...tenantConstraints(await getTenantScope())];
  if (classDocId) filters.push(where("classDocId", "==", classDocId));

  const q = query(attendanceCollection, ...filters);
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return normalizeAttendance({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) });
}

async function findAnyAttendanceForStudentOnDate(studentId: string, date: string): Promise<AttendanceRecord | null> {
  const q = query(attendanceCollection, where("studentId", "==", studentId), where("date", "==", date), ...tenantConstraints(await getTenantScope()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return normalizeAttendance({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) });
}

export async function registerAttendanceUnified({
  studentId,
  classId,
  classDocId,
  mode,
  biometric = false,
  method = "manual",
  movementReason,
}: {
  studentId: string;
  classId: string;
  classDocId?: string;
  mode: "in" | "out";
  biometric?: boolean;
  method?: "qr" | "fingerprint" | "face" | "manual";
  movementReason?: string | null;
}): Promise<AttendanceRecord | void> {
  const date = todayISO();
  const settings = mode === "in" ? await assertAttendanceCheckInOpen() : await getAttendanceSettings();

  const anyToday = await findAnyAttendanceForStudentOnDate(studentId, date);
  if (mode === "in" && anyToday) {
    throw new Error("Student already checked-in today. Please check-out first.");
  }

  const existing = await findAttendance(studentId, classId, date, classDocId);
  if (!existing) {
    if (mode === "out") throw new Error("Student must check-in before checking-out.");

    const now = new Date().toISOString();
    const movementRequirement = getMovementReasonRequirement(settings, "in", new Date(now));
    const cleanedReason = cleanMovementReason(movementReason);
    if (movementRequirement && !cleanedReason) throw new Error("A movement book entry is required for this late arrival.");
    return writeAttendance({
      subjectType: "student",
      subjectId: studentId,
      studentId,
      classId,
      classDocId,
      date,
      type: "in",
      biometric,
      method,
      status: isLate(now, settings.lateAfter) ? "late" : "present",
      lateReason: movementRequirement?.kind === "late" ? cleanedReason : null,
      lateMinutes: movementRequirement?.kind === "late" ? movementRequirement.minutes : null,
    });
  }

  if (mode === "in" && existing.checkInTime) throw new Error("Student already checked-in today.");
  if (mode === "out" && existing.checkOutTime) throw new Error("Student already checked-out today.");

  const checkoutRequirement = getMovementReasonRequirement(settings, "out");
  const checkoutReason = cleanMovementReason(movementReason);
  if (checkoutRequirement && !checkoutReason) throw new Error("A movement book entry is required for this early departure.");

  return writeAttendance({
    ...existing,
    subjectType: "student",
    subjectId: studentId,
    studentId,
    classId,
    classDocId,
    date,
    type: "out",
    biometric,
    method: existing.method ?? method,
    earlyCheckoutReason: checkoutRequirement?.kind === "early_checkout" ? checkoutReason : null,
    earlyCheckoutMinutes: checkoutRequirement?.kind === "early_checkout" ? checkoutRequirement.minutes : null,
  });
}

export async function recordAttendance(record: Omit<AttendanceRecord, "id" | "createdAt">): Promise<AttendanceRecord> {
  return writeAttendance({
    ...record,
    subjectType: record.subjectType ?? "student",
    subjectId: record.subjectId ?? record.studentId ?? "",
    type: record.type ?? "in",
  } as any);
}

export async function getAttendanceForStudent(studentId: string, date?: string): Promise<AttendanceRecord[]> {
  const filters: any[] = [where("studentId", "==", studentId), ...tenantConstraints(await getTenantScope())];
  if (date) filters.push(where("date", "==", date));
  const q = query(attendanceCollection, ...filters);
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeAttendance({ id: d.id, ...(d.data() as any) }));
}

export async function getAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
  const q = query(attendanceCollection, where("date", "==", date), ...tenantConstraints(await getTenantScope()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeAttendance({ id: d.id, ...(d.data() as any) }));
}






