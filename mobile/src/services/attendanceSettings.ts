// mobile/src/services/attendanceSettings.ts
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../app/firebase";
import { logAdminAction } from "./adminLogs";
import { scopedSettingsDocId } from "./tenantScope";

async function attendanceSettingsDoc() {
  return doc(db, "settings", await scopedSettingsDocId("attendance"));
}

export interface AttendanceSettings {
  lateAfter: string; // "HH:mm"
  closeAfter: string; // "HH:mm"
  timezone: string;
  allowStaffWeekendAttendance: boolean;
}

const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  lateAfter: "08:00",
  closeAfter: "16:00",
  timezone: "Africa/Accra",
  allowStaffWeekendAttendance: false,
};
let cachedSettings: AttendanceSettings | null = null;
let settingsRequest: Promise<AttendanceSettings> | null = null;

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
    throw new Error("The attendance check-in window has closed for today. Please contact an administrator if a correction is required.");
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
    throw new Error("Staff attendance is unavailable at weekends. Please contact an administrator if weekend attendance is required.");
  }
  return settings;
}

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  if (cachedSettings) return cachedSettings;
  if (settingsRequest) return settingsRequest;
  settingsRequest = (async () => {
  const snap = await getDoc(await attendanceSettingsDoc());

  if (!snap.exists()) {
    cachedSettings = DEFAULT_ATTENDANCE_SETTINGS;
    return cachedSettings;
  }

  const data = snap.data();

  cachedSettings = {
    lateAfter: data.lateAfter ?? DEFAULT_ATTENDANCE_SETTINGS.lateAfter,
    closeAfter: data.closeAfter ?? DEFAULT_ATTENDANCE_SETTINGS.closeAfter,
    timezone: data.timezone ?? DEFAULT_ATTENDANCE_SETTINGS.timezone,
    allowStaffWeekendAttendance:
      data.allowStaffWeekendAttendance ?? DEFAULT_ATTENDANCE_SETTINGS.allowStaffWeekendAttendance,
  };
  return cachedSettings;
  })();
  try { return await settingsRequest; } finally { settingsRequest = null; }
}

export function clearAttendanceSettingsCache() {
  cachedSettings = null;
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
  clearAttendanceSettingsCache();
  await logAdminAction({
    action: "UPDATE_ATTENDANCE_SETTINGS",
    targetType: "settings",
    targetId: "attendance",
    description: "Updated attendance time settings",
    metadata: settings,
  });
}

