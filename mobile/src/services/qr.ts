// mobile/src/services/qr.ts
import * as Crypto from "expo-crypto";

/**
 * QR payload structure
 */
export type UserQrPayload = {
  userId: string;
  role: string;        // "student" | "teacher" | "staff" | "admin"
  classId?: string;
  ts: number;
  sig: string;
};

/**
 * Generate a secure signature (sha256)
 */
async function generateSignature(data: string) {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data
  );
}

/**
 * Generate QR payload object
 */
export async function generateQrPayload(
  userId: string,
  role: string,
  classId?: string
): Promise<UserQrPayload> {
  const ts = Date.now();
  const base = `${userId}|${role}|${classId ?? ""}|${ts}`;

  const sig = await generateSignature(base);

  return {
    userId,
    role,
    classId,
    ts,
    sig,
  };
}

/**
 * VALIDATION — used when scanning
 */
export async function validateQrPayload(payload: UserQrPayload): Promise<boolean> {
  const { userId, role, classId, ts, sig } = payload;
  const base = `${userId}|${role}|${classId ?? ""}|${ts}`;

  const expectedSig = await generateSignature(base);

  return expectedSig === sig;
}
