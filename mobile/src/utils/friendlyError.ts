const INTERNET_MESSAGE =
  "Please check your internet connection and try again.";

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }

  return "";
}

function getErrorText(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }

  return String(error ?? "");
}

export function getFriendlyAuthErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
) {
  const code = getErrorCode(error);
  const text = getErrorText(error).toLowerCase();

  if (
    code === "auth/network-request-failed" ||
    code === "unavailable" ||
    text.includes("network request failed") ||
    text.includes("failed to get document") ||
    text.includes("failed to fetch") ||
    text.includes("offline") ||
    text.includes("network error") ||
    text.includes("client is offline")
  ) {
    return INTERNET_MESSAGE;
  }

  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
      return "You are not registered or your login details are incorrect. Please create an account or try again.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment or reset your password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "That email is already in use. Try signing in or reset your password.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/requires-recent-login":
      return "Please sign in again, then retry this action.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact the administrator.";
    default:
      return fallback;
  }
}
