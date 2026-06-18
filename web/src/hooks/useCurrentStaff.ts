import { useEffect, useState } from "react";
import useCurrentUser from "./useCurrentUser";
import { getStaffByStaffId, listStaff, type Staff } from "../services/staff";

export function useCurrentStaff() {
  const { authUser, userDoc, loading: userLoading } = useCurrentUser();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (userLoading) return;

    if (!authUser) {
      setStaff(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const staffRows = await listStaff();
        const found =
          staffRows.find((row) => row.userUid === authUser.uid) ??
          staffRows.find((row) => row.email?.toLowerCase() === authUser.email?.toLowerCase()) ??
          (userDoc?.uid ? await getStaffByStaffId(userDoc.uid) : null);

        if (active) setStaff(found ?? null);
      } catch (err) {
        console.error("useCurrentStaff", err);
        if (active) setStaff(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authUser, userDoc?.uid, userLoading]);

  return { staff, loading: userLoading || loading };
}
