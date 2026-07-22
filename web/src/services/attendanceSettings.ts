import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { scopedSettingsDocId } from "./tenantScope";

export type AttendanceSettings = {
  lateAfter: string;
  closeAfter: string;
  timezone: string;
  allowStaffWeekendAttendance: boolean;
};

async function attendanceSettingsDoc() {
  return doc(db, "settings", await scopedSettingsDocId("attendance"));
}

const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  lateAfter: "08:00",
  closeAfter: "16:00",
  timezone: "Africa/Accra",
  allowStaffWeekendAttendance: false,
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

function getDayInTimezone(date: Date, timezone: string): number {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).format(date);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  } catch {
    return date.getDay();
  }
}

export function isWeekendForAttendance(settings: AttendanceSettings, now = new Date()) {
  const timezone = settings.timezone || DEFAULT_ATTENDANCE_SETTINGS.timezone;
  const day = getDayInTimezone(now, timezone);
  return day === 0 || day === 6;
}

export async function assertStaffAttendanceDayAllowed() {
  const settings = await getAttendanceSettings();
  if (isWeekendForAttendance(settings) && !settings.allowStaffWeekendAttendance) {
    throw new Error("Staff attendance is disabled on weekends. Ask an admin to allow weekend staff attendance.");
  }
  return settings;
}

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const snap = await getDoc(await attendanceSettingsDoc());

  if (!snap.exists()) {
    return DEFAULT_ATTENDANCE_SETTINGS;
  }

  const data = snap.data();
  return {
    lateAfter: data.lateAfter ?? DEFAULT_ATTENDANCE_SETTINGS.lateAfter,
    closeAfter: data.closeAfter ?? DEFAULT_ATTENDANCE_SETTINGS.closeAfter,
    timezone: data.timezone ?? DEFAULT_ATTENDANCE_SETTINGS.timezone,
    allowStaffWeekendAttendance:
      data.allowStaffWeekendAttendance ?? DEFAULT_ATTENDANCE_SETTINGS.allowStaffWeekendAttendance,
  };
}

export async function saveAttendanceSettings(settings: AttendanceSettings) {
  await setDoc(
    await attendanceSettingsDoc(),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

