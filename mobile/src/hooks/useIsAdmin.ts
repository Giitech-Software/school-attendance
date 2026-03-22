// mobile/src/hooks/useIsAdmin.ts
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "../../app/firebase";
import { db } from "../../app/firebase";

export function useIsAdmin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();

        setIsAdmin(
          data?.role === "admin" ||
          data?.isAdmin === true
        );
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  return { isAdmin, loading };
}
