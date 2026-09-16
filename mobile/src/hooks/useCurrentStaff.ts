import { useEffect, useState } from "react";
import { auth } from "../../app/firebase";
import { getStaffById, getStaffByUserUid, linkStaffAccount } from "../services/staff";
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

        // Resolve the staff document through the callable first. This avoids
        // requiring staff-list permission for users who only have self access.
        const staffDocId = await linkStaffAccount();
        let currentStaff = staffDocId ? await getStaffById(staffDocId) : null;
        if (!currentStaff) currentStaff = await getStaffByUserUid(uid);
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
