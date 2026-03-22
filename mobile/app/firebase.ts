// app/firebase.ts
import 'react-native-get-random-values';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// @ts-ignore: getReactNativePersistence exists at runtime, TS definitions are missing
import { initializeAuth, getReactNativePersistence, getAuth, type Auth } from 'firebase/auth';
import { getStorage } from "firebase/storage";


console.log("EXPO EXTRA LOADED → ", Constants.expoConfig?.extra);




const extra = Constants.expoConfig?.extra;

if (!extra?.FIREBASE_API_KEY) {
  throw new Error(
    "🔥 Firebase ENV not loaded — Expo Web requires a full rebuild"
  );
}

const firebaseConfig = {
  apiKey: extra.FIREBASE_API_KEY,
  authDomain: extra.FIREBASE_AUTH_DOMAIN,
  projectId: extra.FIREBASE_PROJECT_ID,
  storageBucket: extra.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.FIREBASE_APP_ID,
  measurementId: extra.FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 🔥 DEBUG: confirm which Firebase project is being used
console.log(
  "🔥 DEBUG FIREBASE → projectId:",
  app.options?.projectId,
  "apiKey:",
  app.options?.apiKey
);

export const db = getFirestore(app);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export default app;
export const storage = getStorage(app);