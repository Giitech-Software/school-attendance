// mobile/src/services/attendanceCore.ts

import {
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { auth, db } from "../../app/firebase";
import type { AttendanceRecord } from "./types";
import { validateSchoolLocation } from "./locationGuard";
import { logAdminAction } from "./adminLogs";
import { getTenantScope, withTenantScope } from "./tenantScope";
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
  const locationValidation = await validateSchoolLocation();
  await assertCanRecordDuringGeofenceBypass(
    locationValidation.geofencingBypassed,
    record.subjectType
  );
  const now = new Date().toISOString();
  const tenantScope = await getTenantScope();
  const attendanceCollection = collection(db, collectionName);
  const locationAudit = {
    verificationMethod: locationValidation.verificationMethod,
    campusNetworkVerified: locationValidation.campusNetworkVerified ?? false,
    campusServerName: locationValidation.campusServerName ?? null,
    campusInstitutionId: locationValidation.campusInstitutionId ?? null,
    campusTokenExpiresAt: locationValidation.campusTokenExpiresAt ?? null,
    wifiBssidVerified: locationValidation.wifiBssidVerified ?? false,
    wifiBssid: locationValidation.wifiBssid ?? null,
    wifiSsid: locationValidation.wifiSsid ?? null,
    wifiLabel: locationValidation.wifiLabel ?? null,
    latitude: locationValidation.latitude,
    longitude: locationValidation.longitude,
    accuracyMeters: locationValidation.accuracyMeters,
    distanceMeters:
      typeof locationValidation.distanceMeters === "number"
        ? Math.round(locationValidation.distanceMeters)
        : null,
    allowedDistanceMeters:
      typeof locationValidation.allowedDistanceMeters === "number"
        ? Math.round(locationValidation.allowedDistanceMeters)
        : null,
    radiusMeters: locationValidation.radiusMeters,
    geofencingBypassed: locationValidation.geofencingBypassed,
    bypassReason: locationValidation.bypassReason ?? null,
    bypassedBy: locationValidation.bypassedBy ?? null,
    bypassExpiresAt: locationValidation.bypassExpiresAt ?? null,
    checkedAt: now,
  };

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
    updateFields.location = locationAudit;

    const ref = doc(db, collectionName, id);
    await updateDoc(ref, withTenantScope(updateFields, tenantScope));
    await logAdminAction({
      action: record.type === "out" ? "CHECK_OUT" : "UPDATE_ATTENDANCE",
      targetType: "attendance",
      targetId: ref.id,
      description: `${record.subjectType} ${record.subjectId} ${
        record.type === "out" ? "checked out" : "attendance updated"
      }`,
      metadata: {
        subjectType: record.subjectType,
        subjectId: record.subjectId,
        date: record.date,
        method: updateFields.method,
        collectionName,
      },
    });

    return {
      ...(updateFields as AttendanceRecord),
      id: ref.id,
    };
  }

  /* ===============================
     CREATE NEW CHECK-IN
  =============================== */
  const data = withTenantScope({
    ...record,
    createdAt: serverTimestamp(),
    checkInTime: now,
    checkOutTime: null,
    type: "in",
    biometric: record.biometric ?? false,
    method: record.method ?? "qr",
    location: locationAudit,
  }, tenantScope);

  const ref = await addDoc(attendanceCollection, data);
  await logAdminAction({
    action: "CHECK_IN",
    targetType: "attendance",
    targetId: ref.id,
    description: `${record.subjectType} ${record.subjectId} checked in`,
    metadata: {
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      date: record.date,
      method: data.method,
      collectionName,
    },
  });

  return {
    ...data,
    id: ref.id,
    createdAt: new Date().toISOString(),
  } as AttendanceRecord;
} // ✅ CLOSES recordAttendanceCore PROPERLY

async function assertCanRecordDuringGeofenceBypass(
  geofencingBypassed: boolean,
  subjectType: AttendanceSubjectType
) {
  if (!geofencingBypassed) return;

  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Sign in again before recording attendance.");
  }

  const userSnap = await getDoc(doc(db, "users", uid));
  const user = userSnap.data();
  const isAdmin = user?.role === "admin";
  const canTakeAttendance =
    subjectType === "staff"
      ? user?.canTakeStaffAttendance === true
      : user?.canTakeStudentAttendance === true;

  if (!isAdmin && !canTakeAttendance) {
    throw new Error(
      "Geofencing is currently bypassed. Only authorized attendance takers can record attendance."
    );
  }
}

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


