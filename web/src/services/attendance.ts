import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceRecord } from "../types";
import { assertAttendanceCheckInOpen, getAttendanceSettings } from "./attendanceSettings";
import { validateAttendancePresence } from "./locationGuard";

const attendanceCollection = collection(db, "attendance");

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

  if (record.id) {
    const { id, createdAt, ...updateFields } = record;
    if (record.type === "out") updateFields.checkOutTime = now;
    if (record.type === "in" && !record.checkInTime) updateFields.checkInTime = now;
    updateFields.location = location;
    await updateDoc(doc(db, "attendance", id), updateFields);
    return normalizeAttendance({ id, ...updateFields });
  }

  const payload = {
    ...record,
    createdAt: serverTimestamp(),
    checkInTime: now,
    checkOutTime: null,
    biometric: record.biometric ?? false,
    method: record.method ?? "manual",
    location,
  };
  const ref = await addDoc(attendanceCollection, payload);
  return normalizeAttendance({ id: ref.id, ...payload, createdAt: now });
}

export async function findAttendance(
  studentId: string,
  classId: string,
  date: string,
  classDocId?: string
): Promise<AttendanceRecord | null> {
  const filters: any[] = [where("studentId", "==", studentId), where("classId", "==", classId), where("date", "==", date)];
  if (classDocId) filters.push(where("classDocId", "==", classDocId));

  const q = query(attendanceCollection, ...filters);
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return normalizeAttendance({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) });
}

async function findAnyAttendanceForStudentOnDate(studentId: string, date: string): Promise<AttendanceRecord | null> {
  const q = query(attendanceCollection, where("studentId", "==", studentId), where("date", "==", date));
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
}: {
  studentId: string;
  classId: string;
  classDocId?: string;
  mode: "in" | "out";
  biometric?: boolean;
  method?: "qr" | "fingerprint" | "face" | "manual";
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
    });
  }

  if (mode === "in" && existing.checkInTime) throw new Error("Student already checked-in today.");
  if (mode === "out" && existing.checkOutTime) throw new Error("Student already checked-out today.");

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
  const filters: any[] = [where("studentId", "==", studentId)];
  if (date) filters.push(where("date", "==", date));
  const q = query(attendanceCollection, ...filters);
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeAttendance({ id: d.id, ...(d.data() as any) }));
}

export async function getAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
  const q = query(attendanceCollection, where("date", "==", date), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeAttendance({ id: d.id, ...(d.data() as any) }));
}


