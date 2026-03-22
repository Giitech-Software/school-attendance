// mobile/src/services/staffQrHandler.ts

import { registerStaffAttendance } from "./staffAttendance";

/**
 * Handle staff QR scan payload
 */
export async function handleStaffQrScan({
  qrData,
  mode,
}: {
  qrData: string;
  mode: "in" | "out";
}) {
  let parsed;

  /* ===============================
     PARSE QR
  =============================== */
  try {
    parsed = JSON.parse(qrData);
  } catch {
    throw new Error("Invalid QR code.");
  }

  /* ===============================
     VALIDATE STAFF QR
  =============================== */
  if (parsed.type !== "staff" || !parsed.staffId) {
    throw new Error("This QR code is not for staff attendance.");
  }

  /* ===============================
     REGISTER ATTENDANCE
  =============================== */
  return await registerStaffAttendance({
    staffId: parsed.staffId,
    mode,
    method: "qr",
    biometric: false,
  });
}
