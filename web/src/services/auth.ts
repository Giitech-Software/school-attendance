import {
  createUserWithEmailAndPassword,
  reload,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth } from "../firebase";

/** Sign up a new user */
export async function signUp(email: string, password: string): Promise<UserCredential> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return credential;
  } catch (error: any) {
    // You can handle specific Firebase errors here
    console.error("SignUp Error:", error.code, error.message);
    throw error;
  }
}

/** Sign in an existing user */
export async function signIn(email: string, password: string): Promise<UserCredential> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential;
  } catch (error: any) {
    console.error("SignIn Error:", error.code, error.message);
    throw error;
  }
}

/** Get the currently logged-in user */
export function getCurrentUser() {
  return auth.currentUser;
}

/** Sign out the current user */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("SignOut Error:", error.code, error.message);
    throw error;
  }
}

export async function sendEmailVerificationToCurrentUser(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user to send verification to.");
  await sendEmailVerification(user);
}

export async function reloadCurrentUser(): Promise<User | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await reload(user);
  return auth.currentUser;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}
