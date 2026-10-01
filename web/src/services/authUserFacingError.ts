type AuthErrorAction = "sign-in" | "sign-up" | "password-reset" | "profile";

/** Convert Firebase Auth/Firestore failures into concise messages suitable for auth screens. */
export function authUserFacingError(error: unknown, action: AuthErrorAction): string {
  const value = error as { code?: string; message?: string } | null;
  const code = String(value?.code ?? "").toLowerCase();
  const message = String(value?.message ?? "");
  const normalizedMessage = message.toLowerCase();

  if (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    /network-request-failed|network-error|unavailable|deadline-exceeded|timeout/.test(code) ||
    /network|offline|fetch failed|internet connection|timed?\s*out/.test(normalizedMessage)
  ) {
    return "Your internet connection is unavailable or was interrupted. Reconnect and try again.";
  }

  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("too-many-requests")) return "There have been too many attempts. Wait a moment, then try again.";
  if (code.includes("api-key-expired")) return "This service is temporarily unavailable. Please contact support if the problem continues.";

  if (action === "sign-in") {
    if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "Invalid email or password.";
    if (code.includes("user-disabled")) return "This account has been disabled. Contact your organisation administrator.";
    if (code.includes("permission-denied")) return "We signed you in, but could not load your account profile. Contact your organisation administrator.";
  }

  if (action === "sign-up") {
    if (code.includes("email-already-in-use")) return "An account already exists for this email. Try signing in or resetting your password.";
    if (code.includes("weak-password")) return "Choose a stronger password with at least 6 characters.";
    if (code.includes("operation-not-allowed")) return "Account registration is currently unavailable. Please contact support.";
  }

  if (action === "password-reset" && code.includes("user-not-found")) {
    return "If an account exists for that email, a password reset link will be sent.";
  }

  if (code.includes("permission-denied")) {
    return action === "profile"
      ? "We couldn’t finish setting up your account because access was denied. Contact your organisation administrator."
      : "We couldn’t complete this request because access was denied. Please contact support.";
  }

  // Keep application validation messages (such as an invalid invite code), but
  // never expose SDK internals or raw Firebase diagnostics in the UI.
  if (message && !/firebase|auth\/|firestore|firebaseerror|\[firebase/i.test(message)) return message;

  const fallbacks: Record<AuthErrorAction, string> = {
    "sign-in": "We couldn’t complete sign-in. Please try again.",
    "sign-up": "We couldn’t create your account. Please try again.",
    "password-reset": "We couldn’t send the password reset link. Please try again.",
    profile: "We couldn’t complete account setup. Please try again.",
  };
  return fallbacks[action];
}
