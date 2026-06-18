// mobile/src/services/attendanceSettings.ts
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../app/firebase";
import { logAdminAction } from "./adminLogs";

const SETTINGS_REF = doc(db, "settings", "attendance");

export interface AttendanceSettings {
  lateAfter: string; // "HH:mm"
  closeAfter: string; // "HH:mm"
  timezone: string;
}

const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  lateAfter: "08:00",
  closeAfter: "16:00",
  timezone: "Africa/Accra",
};

function parseTimeToMinutes(time?: string): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;

  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

function getMinutesInTimezone(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);

    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return hour * 60 + minute;
    }
  } catch {
    // Fall back to device time if the runtime does not support the saved timezone.
  }

  return date.getHours() * 60 + date.getMinutes();
}

export function hasReachedAttendanceCloseTime(
  settings: AttendanceSettings,
  now = new Date()
): boolean {
  const closeMinutes = parseTimeToMinutes(settings.closeAfter);
  if (closeMinutes === null) return false;

  const timezone = settings.timezone || DEFAULT_ATTENDANCE_SETTINGS.timezone;
  return getMinutesInTimezone(now, timezone) >= closeMinutes;
}

export async function assertAttendanceCheckInOpen() {
  const settings = await getAttendanceSettings();

  if (hasReachedAttendanceCloseTime(settings)) {
    throw new Error("Attendance check-in is closed for today.");
  }

  return settings;
}

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const snap = await getDoc(SETTINGS_REF);

  if (!snap.exists()) {
    return DEFAULT_ATTENDANCE_SETTINGS;
  }

  const data = snap.data();

  return {
    lateAfter: data.lateAfter ?? DEFAULT_ATTENDANCE_SETTINGS.lateAfter,
    closeAfter: data.closeAfter ?? DEFAULT_ATTENDANCE_SETTINGS.closeAfter,
    timezone: data.timezone ?? DEFAULT_ATTENDANCE_SETTINGS.timezone,
  };
}

export async function saveAttendanceSettings(settings: AttendanceSettings) {
  await setDoc(
    SETTINGS_REF,
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await logAdminAction({
    action: "UPDATE_ATTENDANCE_SETTINGS",
    targetType: "settings",
    targetId: "attendance",
    description: "Updated attendance time settings",
    metadata: settings,
  });
}
