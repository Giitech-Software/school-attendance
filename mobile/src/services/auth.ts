// mobile/src/services/auth.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  reload,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth } from "../../app/firebase"; // path to your platform-aware firebase (adjust if needed)

export async function signUp(email: string, password: string): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential;
}

export async function signIn(email: string, password: string): Promise<UserCredential> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/** Send verification email to the currently-signed-in user (throws if no user) */
export async function sendEmailVerificationToCurrentUser(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user to send verification to.");
  await sendEmailVerification(user);
}

/** Reload the currently-signed-in user from the server (to refresh emailVerified) */
export async function reloadCurrentUser(): Promise<User | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await reload(user);
  return auth.currentUser;
}

/** Return the current user (may be null) */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
