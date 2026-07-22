import type { AttendanceSettings } from "./attendanceSettings";

export type MovementReasonKind = "late" | "early_checkout";

export type MovementReasonRequirement = {
  kind: MovementReasonKind;
  minutes: number;
  title: string;
  message: string;
};

export const LATE_REASON_GRACE_MINUTES = 60;

export const LATE_REASON_OPTIONS = [
  "Transport or traffic disruption",
  "Health or medical matter",
  "Family or personal emergency",
  "Authorised organisational duty",
  "Severe weather or road conditions",
];

export const EARLY_CHECKOUT_REASON_OPTIONS = [
  "Authorised organisational assignment",
  "Medical appointment or health matter",
  "Family or personal emergency",
  "Approved early departure",
  "Transport or safety requirement",
];

function parseTimeToMinutes(time?: string) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesInTimezone(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return hour * 60 + minute;
  } catch {}

  return date.getHours() * 60 + date.getMinutes();
}

export function getMovementReasonRequirement({
  settings,
  mode,
  now = new Date(),
}: {
  settings: AttendanceSettings;
  mode: "in" | "out";
  now?: Date;
}): MovementReasonRequirement | null {
  const currentMinutes = minutesInTimezone(now, settings.timezone || "Africa/Accra");

  if (mode === "in") {
    const lateAfter = parseTimeToMinutes(settings.lateAfter);
    if (lateAfter === null) return null;
    const minutesLate = currentMinutes - lateAfter;
    if (minutesLate >= LATE_REASON_GRACE_MINUTES) {
      return {
        kind: "late",
        minutes: minutesLate,
        title: "Late arrival — movement book entry",
        message: `This arrival is ${minutesLate} minutes after the scheduled time. Record an approved reason to complete the attendance audit trail.`,
      };
    }
  }

  if (mode === "out") {
    const closeAfter = parseTimeToMinutes(settings.closeAfter);
    if (closeAfter === null) return null;
    const minutesEarly = closeAfter - currentMinutes;
    if (minutesEarly > 0) {
      return {
        kind: "early_checkout",
        minutes: minutesEarly,
        title: "Early departure — movement book entry",
        message: `This departure is ${minutesEarly} minutes before the scheduled closing time. Record an approved reason to complete the attendance audit trail.`,
      };
    }
  }

  return null;
}

export function cleanMovementReason(reason?: string | null) {
  return (reason ?? "").trim();
}
