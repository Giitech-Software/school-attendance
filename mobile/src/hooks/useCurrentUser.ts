// mobile/src/hooks/useCurrentUser.ts
import { useEffect, useState } from "react";
import { doc as firestoreDoc, getDoc as getFirestoreDoc } from "firebase/firestore";
import { auth, db } from "../../app/firebase";
import { getUserById, type AppUser } from "../services/users";

async function hydrateTenantType(profile: AppUser | null): Promise<AppUser | null> {
  if (!profile?.tenantId || profile.tenantType) return profile;

  const tenantSnap = await getFirestoreDoc(firestoreDoc(db, "tenants", profile.tenantId));
  if (!tenantSnap.exists()) return profile;

  const tenantType = tenantSnap.data()?.type;
  return typeof tenantType === "string" && tenantType.trim() ? { ...profile, tenantType } : profile;
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
        const profile = await hydrateTenantType(await getUserById(uid));
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
