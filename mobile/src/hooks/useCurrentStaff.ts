import { useEffect, useState } from "react";
import { auth } from "../../app/firebase";
import { getStaffByUserUid } from "../services/staff";
import type { Staff } from "../services/types";

export function useCurrentStaff() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          if (mounted) setStaff(null);
          return;
        }

        const currentStaff = await getStaffByUserUid(uid);
        if (mounted) setStaff(currentStaff);
      } catch (error) {
        console.error("useCurrentStaff", error);
        if (mounted) setStaff(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { staff, loading };
}
