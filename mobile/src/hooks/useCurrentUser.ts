// mobile/src/hooks/useCurrentUser.ts
import { useEffect, useState } from "react";
import { doc as firestoreDoc, getDoc as getFirestoreDoc } from "firebase/firestore";
import { auth, db } from "../../app/firebase";
import { getUserById, type AppUser } from "../services/users";

let cachedUid: string | null = null;
let cachedProfile: AppUser | null = null;
let profileRequest: Promise<AppUser | null> | null = null;

async function hydrateTenantType(profile: AppUser | null): Promise<AppUser | null> {
  if (!profile?.tenantId || profile.tenantType) return profile;

  const tenantSnap = await getFirestoreDoc(firestoreDoc(db, "tenants", profile.tenantId));
  if (!tenantSnap.exists()) return profile;

  const tenantType = tenantSnap.data()?.type;
  return typeof tenantType === "string" && tenantType.trim() ? { ...profile, tenantType } : profile;
}

export async function getCachedCurrentUser(): Promise<AppUser | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  if (cachedUid === uid && cachedProfile) return cachedProfile;
  if (profileRequest && cachedUid === uid) return profileRequest;
  cachedUid = uid;
  profileRequest = (async () => hydrateTenantType(await getUserById(uid)))();
  try {
    cachedProfile = await profileRequest;
    return cachedProfile;
  } finally {
    profileRequest = null;
  }
}

export function clearCurrentUserCache() {
  cachedUid = null;
  cachedProfile = null;
  profileRequest = null;
}

/**
 * useCurrentUser - returns the Firestore user doc for the signed-in user.
 * This is authoritative for role checks (role: 'admin' | 'teacher' | ...)
 */
export default function useCurrentUser() {
  const [userDoc, setUserDoc] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          if (mounted) {
            setUserDoc(null);
            setLoading(false);
          }
          return;
        }
        const profile = await getCachedCurrentUser();
        if (mounted) setUserDoc(profile);
      } catch (err) {
        if (mounted) setUserDoc(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { userDoc, loading };
}
