// mobile/src/services/secureKeys.ts
import * as SecureStore from "expo-secure-store";

/**
 * Produce a safe SecureStore key by replacing invalid chars.
 * Allowed chars: alphanumeric, ".", "-", "_"
 */
function makeSafeKey(prefix: string, studentId: string) {
  const safe = (studentId ?? "").toString().replace(/[^A-Za-z0-9._-]/g, "_");
  return `${prefix}_${safe}`;
}

/** Key for storing a per-student biometric token on-device (biometric enrollment) */
export function biometricKeyForStudent(studentId: string): string {
  return makeSafeKey("biometricId", studentId);
}

/** Key for storing the last attendance scan timestamp for a student */
export function attendanceLastScanKey(studentId: string): string {
  return makeSafeKey("attendance_lastScan", studentId);
}

/** Convenience wrappers that interact with SecureStore (optional) */

export async function saveBiometricKey(studentId: string, value: string) {
  const key = biometricKeyForStudent(studentId);
  await SecureStore.setItemAsync(key, value);
}

export async function getBiometricKey(studentId: string) {
  const key = biometricKeyForStudent(studentId);
  return SecureStore.getItemAsync(key);
}

export async function saveLastScan(studentId: string, timestamp: number) {
  const key = attendanceLastScanKey(studentId);
  await SecureStore.setItemAsync(key, String(timestamp));
}

export async function getLastScan(studentId: string): Promise<number | null> {
  const key = attendanceLastScanKey(studentId);
  const v = await SecureStore.getItemAsync(key);
  return v ? Number(v) : null;
}
