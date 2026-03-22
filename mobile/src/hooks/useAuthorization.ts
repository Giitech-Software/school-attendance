import { useEffect, useState } from "react";
import { getUserById } from "../services/users";

export function useAuthorization(uid?: string) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    getUserById(uid).then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, [uid]);

  const isAdmin = user?.role === "admin";
  const isApproved = isAdmin || user?.approved === true; // admins always approved

  return {
    user,
    loading,
    isAdmin,
    isApproved,

    canTakeStaffAttendance: isAdmin || (isApproved && user?.canTakeStaffAttendance === true),
    canTakeStudentAttendance: isAdmin || (isApproved && user?.canTakeStudentAttendance === true),
  };
} 
