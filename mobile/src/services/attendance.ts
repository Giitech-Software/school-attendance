// mobile/src/services/attendance.ts

import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
  doc,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import type { AttendanceRecord } from "./types";
import {
  assertAttendanceCheckInOpen,
  getAttendanceSettings,
  hasReachedAttendanceCloseTime,
} from "./attendanceSettings";
import { recordAttendanceCore } from "./attendanceCore";
import {
  cleanMovementReason,
  getMovementReasonRequirement,
} from "./movementPolicy";
import { getTenantScope, tenantConstraints, withTenantScope } from "./tenantScope";

const attendanceCollection = collection(db, "attendance");

/** Utility: today's date (YYYY-MM-DD) */
export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Normalize attendance records so UI never breaks
 */
function normalizeAttendance(data: any): AttendanceRecord {
  let inferredType: "in" | "out" = "in";
  if (data.checkOutTime) inferredType = "out";

  return {
    ...data,
    type: data.type ?? inferredType,
    checkInTime: data.checkInTime ?? null,
    checkOutTime: data.checkOutTime ?? null,
    status: data.status ?? "present",
    method: data.method ?? "qr",          // ✅ SAFE DEFAULT
    biometric: data.biometric ?? false,
  } as AttendanceRecord;
}

/**
 * Late calculation helper
 */
function isLate(checkInIso: string, lateAfter: string): boolean {
  const checkIn = new Date(checkInIso);
  const [h, m] = lateAfter.split(":").map(Number);

  const lateTime = new Date(checkIn);
  lateTime.setHours(h, m, 0, 0);

  return checkIn > lateTime;
}

/**
 * CREATE or UPDATE attendance entry — UI SAFE
 */
export async function recordAttendance(
  record: Partial<AttendanceRecord> & {
    studentId: string;
    classId: string;
    classDocId?: string;
    type: "in" | "out";
    date: string;
    biometric?: boolean;
    method?: "qr" | "fingerprint" | "face" | "manual";
    movementReason?: string | null;
  }
): Promise<AttendanceRecord> {
  const now = new Date().toISOString();

  /* ===============================
     UPDATE EXISTING RECORD
  =============================== */
  if (record.id) {
    if (record.type === "in") {
      await assertAttendanceCheckInOpen();
    }

    return normalizeAttendance(
      await recordAttendanceCore({
        record: {
          ...record,
          subjectType: "student",
          subjectId: record.studentId,
          checkInTime:
            record.type === "in" && !record.checkInTime ? now : record.checkInTime,
          checkOutTime:
            record.type === "out" ? now : record.checkOutTime,
        },
      })
    );
  }

  /* ===============================
     CREATE NEW CHECK-IN
  =============================== */
  const settings = await getAttendanceSettings();
  if (hasReachedAttendanceCloseTime(settings)) {
    throw new Error("Attendance check-in is closed for today.");
  }

  const movementRequirement = getMovementReasonRequirement({
    settings,
    mode: "in",
    now: new Date(now),
  });
  const movementReason = cleanMovementReason(record.movementReason);
  if (movementRequirement && !movementReason) {
    throw new Error("A movement book entry is required for this late arrival.");
  }

  const status = isLate(now, settings.lateAfter)
    ? "late"
    : "present";

  return normalizeAttendance(
    await recordAttendanceCore({
      record: {
        ...record,
        subjectType: "student",
        subjectId: record.studentId,
        status,
        lateReason:
          movementRequirement?.kind === "late" ? movementReason : null,
        lateMinutes:
          movementRequirement?.kind === "late"
            ? movementRequirement.minutes
            : null,
        type: "in",
      },
    })
  );
}

/**
 * Find attendance for a specific student/class/date
 */
export async function findAttendance(
  studentId: string,
  classId: string,
  date: string,
  classDocId?: string,
  enforceClassAssignment = false
): Promise<AttendanceRecord | null> {
  const filters: any[] = [
    where("studentId", "==", studentId),
    where("classId", "==", classId),
    where("date", "==", date),
    ...tenantConstraints(await getTenantScope()),
  ];

  if (classDocId && enforceClassAssignment) {
    filters.unshift(where("subjectType", "==", "student"));
    filters.push(where("classDocId", "==", classDocId));
  }

  const q = query(attendanceCollection, ...filters);

  const snap = await getDocs(q);
  if (snap.empty) return null;

  return normalizeAttendance({
    id: snap.docs[0].id,
    ...(snap.docs[0].data() as any),
  });
}

/**
 * Unified attendance registration
 */
export async function registerAttendanceUnified({
  studentId,
  classId,
  classDocId,
  mode,
  biometric,
  method = "qr",
  enforceClassAssignment = false,
  movementReason,
}: {
  studentId: string;
  classId: string;
  classDocId?: string;
  mode: "in" | "out";
  biometric?: boolean;
  method?: "qr" | "fingerprint" | "face" | "manual";
  enforceClassAssignment?: boolean;
  movementReason?: string | null;
}): Promise<AttendanceRecord | void> {
  const date = todayISO();

  if (mode === "in") {
    await assertAttendanceCheckInOpen();
  }

  // 🔒 GLOBAL DAILY GUARD
  const anyToday = await findAnyAttendanceForStudentOnDate(
    studentId,
    date,
    classDocId,
    enforceClassAssignment
  );
  if (mode === "in" && anyToday) {
    throw new Error("Student already checked-in today. Please check-out first.");
  }

  const existing = await findAttendance(
    studentId,
    classId,
    date,
    classDocId,
    enforceClassAssignment
  );
if (!existing) {
  if (mode === "in") {
    return await recordAttendance({
      studentId,
      classId,
      classDocId,
      type: "in",
      date,
      biometric: biometric === true,
      method,
      movementReason,
    });
  }
      
    throw new Error("Student must check-in before checking-out.");
  }

  const rec = normalizeAttendance(existing);

  if (mode === "in" && rec.checkInTime) {
    throw new Error("Student already checked-in today.");
  }

  if (mode === "out") {
    if (rec.checkOutTime) {
      throw new Error("Student already checked-out today.");
    }

    const settings = await getAttendanceSettings();
    const movementRequirement = getMovementReasonRequirement({
      settings,
      mode: "out",
    });
    const cleanedReason = cleanMovementReason(movementReason);
    if (movementRequirement && !cleanedReason) {
      throw new Error("A movement book entry is required for this early departure.");
    }

    return await recordAttendance({
      id: rec.id,
      studentId,
      classId,
      classDocId,
      date,
      type: "out",
      checkInTime: rec.checkInTime,
      earlyCheckoutReason:
        movementRequirement?.kind === "early_checkout" ? cleanedReason : null,
      earlyCheckoutMinutes:
        movementRequirement?.kind === "early_checkout"
          ? movementRequirement.minutes
          : null,
      biometric: biometric === true,
      method: rec.method, // ✅ PRESERVE ORIGINAL METHOD
    });
  }

  throw new Error("Student already checked-in today.");
}

/**
 * Find ANY attendance for a student on a date (regardless of class)
 */
async function findAnyAttendanceForStudentOnDate(
  studentId: string,
  date: string,
  classDocId?: string,
  enforceClassAssignment = false
): Promise<AttendanceRecord | null> {
  const filters: any[] = [
    where("studentId", "==", studentId),
    where("date", "==", date),
    ...tenantConstraints(await getTenantScope()),
  ];

  if (classDocId && enforceClassAssignment) {
    filters.unshift(where("subjectType", "==", "student"));
    filters.push(where("classDocId", "==", classDocId));
  }

  const q = query(attendanceCollection, ...filters);

  const snap = await getDocs(q);
  if (snap.empty) return null;

  return normalizeAttendance({
    id: snap.docs[0].id,
    ...(snap.docs[0].data() as any),
  });
}

/**
 * Get attendance for student
 */
export async function getAttendanceForStudent(
  studentId: string,
  date?: string
): Promise<AttendanceRecord[]> {
  const filters: any[] = [where("studentId", "==", studentId), ...tenantConstraints(await getTenantScope())];
  if (date) filters.push(where("date", "==", date));

  const q = query(attendanceCollection, ...filters);
  const snap = await getDocs(q);

  return snap.docs.map((d) =>
    normalizeAttendance({
      id: d.id,
      ...(d.data() as any),
    })
  );
}

/**
 * Get attendance for a date
 */
export async function getAttendanceForDate(
  dateIso: string
): Promise<AttendanceRecord[]> {
  const q = query(
    attendanceCollection,
    where("date", "==", dateIso),
    ...tenantConstraints(await getTenantScope())
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) =>
    normalizeAttendance({
      id: d.id,
      ...(d.data() as any),
    })
  );
}

/**
 * Auto-mark absent students at the end of the day
 */
export async function autoMarkAbsentsForToday() {
  try {
    const settings = await getAttendanceSettings();
    if (!hasReachedAttendanceCloseTime(settings)) return;

    const today = todayISO();

    const scope = await getTenantScope();
    const studentsSnap = await getDocs(query(collection(db, "students"), ...tenantConstraints(scope)));

    const attendanceSnap = await getDocs(
      query(collection(db, "attendance"), where("date", "==", today), ...tenantConstraints(scope))
    );

    const marked = new Set(
      attendanceSnap.docs.map(doc => doc.data().studentId)
    );

    const promises: Promise<any>[] = [];

    studentsSnap.forEach(studentDoc => {
      if (marked.has(studentDoc.id)) return;

      const ref = doc(collection(db, "attendance"));

      promises.push(
        setDoc(ref, withTenantScope({
         studentId: studentDoc.id,
subjectType: "student",
subjectId: studentDoc.id,
classId: studentDoc.data().classId ?? "",
          date: today,
          status: "absent",
          type: "in",
          method: "manual", // ✅ explicit
          biometric: false,
          checkInTime: null,
          checkOutTime: null,
          createdAt: serverTimestamp(),
          auto: true,
        }, scope))
      );
    });
/* ===============================
   AUTO-MARK STAFF ABSENT
================================= */

const staffSnap = await getDocs(query(collection(db, "staff"), ...tenantConstraints(scope)));

const markedStaff = new Set(
  attendanceSnap.docs
    .filter(doc => doc.data().subjectType === "staff")
    .map(doc => doc.data().subjectId)
);

staffSnap.forEach(staffDoc => {
  if (markedStaff.has(staffDoc.id)) return;

  const ref = doc(collection(db, "attendance"));

  promises.push(
    setDoc(ref, withTenantScope({
      subjectType: "staff",
      subjectId: staffDoc.id,
      date: today,
      status: "absent",
      type: "in",
      method: "manual",
      biometric: false,
      checkInTime: null,
      checkOutTime: null,
      createdAt: serverTimestamp(),
      auto: true,
    }, scope))
  );
});
    await Promise.all(promises);
    console.log("ABSENT auto-mark completed");
  } catch (err) {
    console.error("autoMarkAbsentsForToday error", err);
  }
}




