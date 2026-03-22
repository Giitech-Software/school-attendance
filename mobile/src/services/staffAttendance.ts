// mobile/src/services/staffAttendance.ts

import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { recordAttendanceCore } from "./attendanceCore";
import type { AttendanceRecord } from "./types";
import { todayISO } from "./attendance";
import { getAttendanceSettings } from "./attendanceSettings";


function isLate(checkInIso: string, lateAfter: string): boolean {
  const checkIn = new Date(checkInIso);
  const [h, m] = lateAfter.split(":").map(Number);

  const lateTime = new Date(checkIn);
  lateTime.setHours(h, m, 0, 0);

  return checkIn > lateTime;
}
/**
 * Find staff attendance for a given date
 */
export async function findStaffAttendanceForDate(
  staffId: string,
  date: string
): Promise<AttendanceRecord | null> {
  const q = query(
    collection(db, "attendance"),
    where("subjectType", "==", "staff"),
    where("subjectId", "==", staffId),
    where("date", "==", date)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  return {
    id: snap.docs[0].id,
    ...(snap.docs[0].data() as any),
  };
}

/**
 * Register staff check-in / check-out
 */
export async function registerStaffAttendance({
  staffId,
  mode,
  method = "qr",
  biometric = false,
}: {
  staffId: string;
  mode: "in" | "out";
  method?: "qr" | "fingerprint" | "face" | "manual";
  biometric?: boolean;
}): Promise<AttendanceRecord> {
  const date = todayISO();

  const existing = await findStaffAttendanceForDate(staffId, date);

  /* ===============================
     CHECK-IN
  =============================== */if (mode === "in") {
  if (existing?.checkInTime) {
    throw new Error("Staff already checked-in today.");
  }

  const settings = await getAttendanceSettings();
  const now = new Date().toISOString();

  let status: "present" | "late" = "present";

  if (settings?.lateAfter) {
    status = isLate(now, settings.lateAfter) ? "late" : "present";
  }

  return await recordAttendanceCore({
    record: {
      subjectType: "staff",
      subjectId: staffId,
      date,
      type: "in",
      biometric,
      method,
      status, // ✅ THIS is what was missing
    },
  });
}

  /* ===============================
     CHECK-OUT
  =============================== */
  if (!existing) {
    throw new Error("Staff must check-in before checking-out.");
  }

  if (existing.checkOutTime) {
    throw new Error("Staff already checked-out today.");
  }

  return await recordAttendanceCore({
    record: {
      id: existing.id,
      subjectType: "staff",
      subjectId: staffId,
      date,
      type: "out",
      biometric,
      method: existing.method ?? method,
      checkInTime: existing.checkInTime,
    },
  });
}
