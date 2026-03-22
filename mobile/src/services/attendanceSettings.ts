// mobile/src/services/attendanceSettings.ts
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../app/firebase";

const SETTINGS_REF = doc(db, "settings", "attendance");

export interface AttendanceSettings {
  lateAfter: string; // "HH:mm"
   closeAfter: string; // "HH:mm"  ✅ NEW
  timezone: string;
}

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const snap = await getDoc(SETTINGS_REF);

  if (!snap.exists()) {
    // sensible defaults (won’t break anything)
    return {
      lateAfter: "08:00",
      closeAfter: "16:00", // ✅ NEW
      timezone: "Africa/Accra",
    };
  }
//changed return snap.data() as AttendanceSettings; to below to ensure defaults for any missing fields
const data = snap.data();

return {
  lateAfter: data.lateAfter ?? "08:00",
  closeAfter: data.closeAfter ?? "16:00",
  timezone: data.timezone ?? "Africa/Accra",
};
}

export async function saveAttendanceSettings(
  settings: AttendanceSettings
) {
  await setDoc(
    SETTINGS_REF,
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
