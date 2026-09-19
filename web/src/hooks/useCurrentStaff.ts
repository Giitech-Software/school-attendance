import { useEffect, useState } from "react";
import useCurrentUser from "./useCurrentUser";
import { getStaffById, getStaffByStaffId, getStaffByUserUid, type Staff } from "../services/staff";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "../firebase";

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
        // Resolve the user's own staff record through a constrained query first.
        // This does not require permission to list the tenant's staff.
        let linkedStaff = await getStaffByUserUid(authUser.uid);
        if (!linkedStaff) {
          const linkResult = await httpsCallable<{}, { staffDocId?: string }>(getFunctions(app), "linkStaffAccount")({});
          const linkedDocId = linkResult.data.staffDocId;
          linkedStaff = linkedDocId ? await getStaffById(linkedDocId) : null;
        }
        const staffRows = linkedStaff ? [linkedStaff] : [];
        let found =
          linkedStaff ??
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
