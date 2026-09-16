export function userFacingError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const value = error as { code?: string; message?: string } | null;
  const code = String(value?.code ?? "").toLowerCase();
  const message = String(value?.message ?? "");
  if (!navigator.onLine || code.includes("network") || code.includes("unavailable") || code.includes("deadline")) return "You appear to be offline. Check your internet connection and try again.";
  if (code.includes("permission-denied") || code.includes("unauthenticated")) return "You do not have permission to perform this action.";
  if (code.includes("already-exists")) return "This record already exists.";
  if (code.includes("failed-precondition")) return message || "This action cannot be completed until the required setup is finished.";
  if (message && !message.includes("FirebaseError") && !message.includes("[Firebase")) return message;
  return fallback;
}
