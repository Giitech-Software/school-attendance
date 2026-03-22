// mobile/src/hooks/useCurrentUser.ts
import { useEffect, useState } from "react";
import { auth } from "../../app/firebase";
import { getUserById } from "../services/users";

/**
 * useCurrentUser - returns the Firestore user doc for the signed-in user.
 * This is authoritative for role checks (role: 'admin' | 'teacher' | ...)
 */
export default function useCurrentUser() {
  const [userDoc, setUserDoc] = useState<any | null>(null);
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
        const doc = await getUserById(uid);
        if (mounted) setUserDoc(doc);
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
