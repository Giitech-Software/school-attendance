export function userFacingError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const value = error as { code?: string; message?: string; customData?: { message?: string } } | null;
  const code = String(value?.code ?? "").toLowerCase();
  const message = String(value?.message ?? value?.customData?.message ?? "");
  const cleanMessage = message.replace(/^FirebaseError:\s*/i, "").trim();

  // Preserve explicit application validation messages (for example, an ID lookup
  // that completed successfully but returned no matching person).
  if (cleanMessage && !code && !/firebase(auth|error)|\[firebase/i.test(cleanMessage)) return cleanMessage;
  if (code.includes("network-request-failed") || code.includes("unavailable") || code.includes("deadline-exceeded") || code.includes("network-error")) {
    return "Connection interrupted. Check your internet connection and try again. Attendance is not confirmed until you see a success message.";
  }
  if (code.includes("auth/network-request-failed")) {
    return "Connection interrupted. Check your internet connection and try again. Attendance is not confirmed until you see a success message.";
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect to the internet and retry. Attendance is not confirmed until you see a success message.";
  }
  if (code.includes("permission-denied")) {
    return "We couldn’t verify this attendance action with your current access. Confirm that your account is approved, assigned to this organisation, and enabled for this attendance type. Contact your organisation administrator if the issue continues.";
  }
  if (code.includes("unauthenticated") || code.includes("auth/user-token-expired") || code.includes("auth/invalid-user-token")) {
    return "Your session has expired. Sign in again, then retry the attendance action.";
  }
  if (code.includes("auth/too-many-requests")) return "There have been too many attempts. Wait a moment, then try again.";
  if (code.includes("already-exists")) return "This record already exists.";
  if (code.includes("failed-precondition")) return cleanMessage || "This action cannot be completed until the required setup is finished.";
  if (cleanMessage && !/firebase(auth|error)|\[firebase/i.test(cleanMessage)) return cleanMessage;
  return fallback;
}
