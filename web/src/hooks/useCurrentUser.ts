import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { getUserById, type AppUser } from "../services/users";

export default function useCurrentUser() {
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [userDoc, setUserDoc] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);

      if (!user) {
        if (active) {
          setUserDoc(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const profile = await getUserById(user.uid);
        if (active) setUserDoc(profile);
      } catch (err) {
        console.error("useCurrentUser", err);
        if (active) setUserDoc(null);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { authUser, userDoc, loading };
}
