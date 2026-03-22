// mobile/src/services/attendanceCore.ts

import {
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import type { AttendanceRecord } from "./types";
import { validateSchoolLocation } from "./locationGuard";
/**
 * Supported attendance subjects
 */
export type AttendanceSubjectType = "student" | "staff";

/**
 * Core attendance writer (NO business rules)
 * - No class logic
 * - No late logic
 * - No auto-absent
 */
export async function recordAttendanceCore({
  collectionName = "attendance",
  record,
}: {
  collectionName?: string;
  record: Partial<AttendanceRecord> & {
    subjectType: AttendanceSubjectType;
    subjectId: string;
    date: string;
    type: "in" | "out";
    method?: "qr" | "fingerprint" | "face" | "manual";
    biometric?: boolean;
  };
}): Promise<AttendanceRecord> {
  // 🔒 SECURITY: Validate user location before recording attendance
await validateSchoolLocation();
  const now = new Date().toISOString();
  const attendanceCollection = collection(db, collectionName);

  /* ===============================
     UPDATE EXISTING RECORD
  =============================== */
  if (record.id) {
    const { id, createdAt, ...updateFields } = record;

    if (record.type === "in" && !record.checkInTime) {
      updateFields.checkInTime = now;
      updateFields.type = "in";
    }

    if (record.type === "out") {
      updateFields.checkOutTime = now;
      updateFields.type = "out";
    }

    updateFields.biometric = record.biometric ?? false;
    updateFields.method = record.method ?? updateFields.method;

    const ref = doc(db, collectionName, id);
    await updateDoc(ref, updateFields);

    return {
      ...(updateFields as AttendanceRecord),
      id: ref.id,
    };
  }

  /* ===============================
     CREATE NEW CHECK-IN
  =============================== */
  const data = {
    ...record,
    createdAt: serverTimestamp(),
    checkInTime: now,
    checkOutTime: null,
    type: "in",
    biometric: record.biometric ?? false,
    method: record.method ?? "qr",
  };

  const ref = await addDoc(attendanceCollection, data);

  return {
    ...data,
    id: ref.id,
    createdAt: new Date().toISOString(),
  } as AttendanceRecord;
} // ✅ CLOSES recordAttendanceCore PROPERLY

/* ===============================
   STUDENT-SPECIFIC HANDLERS
=============================== */

/**
 * Handle student biometric attendance
 */
export async function handleStudentBiometricCheck({
  studentId,
  classId,
  mode,
}: {
  studentId: string;
  classId: string;
  mode: "in" | "out";
}) {
  const date = new Date().toISOString().slice(0, 10);

  return await recordAttendanceCore({
    record: {
      subjectType: "student",
      subjectId: studentId,
      date,
      type: mode,
      method: "fingerprint",
      biometric: true,
    },
  });
}

/**
 * Handle student QR attendance
 */
export async function handleStudentQrScan({
  studentId,
  classId,
  mode,
}: {
  studentId: string;
  classId: string;
  mode: "in" | "out";
}) {
  const date = new Date().toISOString().slice(0, 10);

  return await recordAttendanceCore({
    record: {
      subjectType: "student",
      subjectId: studentId,
      date,
      type: mode,
      method: "qr",
      biometric: false,
    },
  });
} // ✅ CLOSED
