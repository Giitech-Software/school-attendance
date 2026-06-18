import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export type AttendanceSettings = {
  lateAfter: string;
  closeAfter: string;
  timezone: string;
};

const ATTENDANCE_SETTINGS_DOC = doc(db, "settings", "attendance");

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
    // Fall back to browser local time if the saved timezone is unsupported.
  }

  return date.getHours() * 60 + date.getMinutes();
}

export function hasReachedAttendanceCloseTime(settings: AttendanceSettings, now = new Date()): boolean {
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
  const snap = await getDoc(ATTENDANCE_SETTINGS_DOC);

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
    ATTENDANCE_SETTINGS_DOC,
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
