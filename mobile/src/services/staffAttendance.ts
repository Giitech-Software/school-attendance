// mobile/src/services/staffAttendance.ts

import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { getTenantScope, tenantConstraints } from "./tenantScope";
import { recordAttendanceCore } from "./attendanceCore";
import type { AttendanceRecord } from "./types";
import { todayISO } from "./attendance";
import {
  assertAttendanceCheckInOpen,
  assertStaffAttendanceDayAllowed,
  getAttendanceSettings,
} from "./attendanceSettings";
import {
  cleanMovementReason,
  getMovementReasonRequirement,
} from "./movementPolicy";


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
    where("date", "==", date),
    ...tenantConstraints(await getTenantScope())
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

  /* ===============================
     CHECK-IN
  =============================== */if (mode === "in") {
  if (existing?.checkInTime) {
    throw new Error("Staff already checked-in today.");
  }

  await assertAttendanceCheckInOpen();

  const settings = await getAttendanceSettings();
  const now = new Date().toISOString();
  const movementRequirement = getMovementReasonRequirement({
    settings,
    mode: "in",
    now: new Date(now),
  });
  const cleanedReason = cleanMovementReason(movementReason);
  if (movementRequirement && !cleanedReason) {
    throw new Error("A movement book entry is required for this late arrival.");
  }

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
      lateReason: movementRequirement?.kind === "late" ? cleanedReason : null,
      lateMinutes:
        movementRequirement?.kind === "late" ? movementRequirement.minutes : null,
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

  const settings = await getAttendanceSettings();
  const movementRequirement = getMovementReasonRequirement({
    settings,
    mode: "out",
  });
  const cleanedReason = cleanMovementReason(movementReason);
  if (movementRequirement && !cleanedReason) {
    throw new Error("A movement book entry is required for this early departure.");
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
      earlyCheckoutReason:
        movementRequirement?.kind === "early_checkout" ? cleanedReason : null,
      earlyCheckoutMinutes:
        movementRequirement?.kind === "early_checkout"
          ? movementRequirement.minutes
          : null,
    },
  });
}

