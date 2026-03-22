import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
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

/** Sign out the current user */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("SignOut Error:", error.code, error.message);
    throw error;
  }
}
