// web/src/firebase.ts
// Firebase Web initializer for Vite + React
// Works seamlessly with Expo Web when launched from monorepo

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Read environment variables (Vite auto-injects these)
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Fix incorrect bucket (Google console sometimes generates `.firebasestorage.app`)
if (cfg.storageBucket && cfg.storageBucket.endsWith(".firebasestorage.app")) {
  console.warn(
    `[WARNING] Rewriting invalid Firebase storageBucket "${cfg.storageBucket}" → appspot.com`
  );
  cfg.storageBucket = cfg.storageBucket.replace(
    ".firebasestorage.app",
    ".appspot.com"
  );
}

// Initialize Firebase App (idempotent)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(cfg);
} else {
  app = getApp();
}

// Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics only works in browser (not in Node / SSR)
if (typeof window !== "undefined") {
  try {
    const { getAnalytics } = await import("firebase/analytics");
    getAnalytics(app);
  } catch (err) {
    console.warn("[Analytics] Not initialized:", err);
  }
}

// Debug logs
if (import.meta.env.DEV) {
  console.log("🔥 WEB FIREBASE INIT", {
    apiKey: cfg.apiKey ? "✔️" : "❌ missing",
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    appId: cfg.appId,
  });
}

export default app;
