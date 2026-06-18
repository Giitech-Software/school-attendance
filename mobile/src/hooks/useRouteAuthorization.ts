import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import useCurrentUser from "./useCurrentUser";
import { useAssignedStudentClasses } from "./useAssignedStudentClasses";
import { getSchoolLocationReadiness } from "../services/locationGuard";

type AttendanceKind = "staff" | "student";
type AttendanceAccessOptions = {
  allowSelfService?: boolean;
};

function isAdminRole(userDoc: any) {
  return userDoc?.role === "admin";
}

function isApprovedUser(userDoc: any) {
  return isAdminRole(userDoc) || userDoc?.approved === true;
}

export function useRequireAdmin(message = "You must be an admin to access this page.") {
  const router = useRouter();
  const warnedRef = useRef(false);
  const { userDoc, loading } = useCurrentUser();
  const isAdmin = isAdminRole(userDoc);
  const ready = !loading && isAdmin;

  useEffect(() => {
    if (loading) return;

    if (!userDoc) {
      router.replace("/(auth)/login" as any);
      return;
    }

    if (!isAdmin && !warnedRef.current) {
      warnedRef.current = true;
      Alert.alert("Access denied", message);
      router.replace("/" as any);
    }
  }, [isAdmin, loading, message, router, userDoc]);

  return {
    userDoc,
    loading,
    isAdmin,
    ready,
  };
}

function isStaffRole(userDoc: any) {
  return (
    userDoc?.role === "teacher" ||
    userDoc?.role === "staff" ||
    userDoc?.role === "non_teaching_staff" ||
    userDoc?.role === "general_staff"
  );
}

export function useRequireAttendanceAccess(
  kind: AttendanceKind,
  options: AttendanceAccessOptions = {}
) {
  const router = useRouter();
  const warnedRef = useRef(false);
  const { userDoc, loading } = useCurrentUser();
  const [geofenceBypassActive, setGeofenceBypassActive] = useState(false);
  const [checkingGeofencePolicy, setCheckingGeofencePolicy] = useState(true);
  const isAdmin = isAdminRole(userDoc);
  const isApproved = isApprovedUser(userDoc);
  const {
    classes: assignedStudentClasses,
    hasAssignedClasses,
    loading: assignedClassesLoading,
  } = useAssignedStudentClasses(isApproved ? userDoc?.uid ?? userDoc?.id : null);
  const hasCapability =
    kind === "staff"
      ? userDoc?.canTakeStaffAttendance === true
      : userDoc?.canTakeStudentAttendance === true;
  const explicitAttendanceTaker = isAdmin || (isApproved && hasCapability);

  useEffect(() => {
    let mounted = true;

    getSchoolLocationReadiness()
      .then((readiness) => {
        if (mounted) {
          setGeofenceBypassActive(readiness.emergencyBypassActive);
        }
      })
      .catch(() => {
        if (mounted) {
          setGeofenceBypassActive(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setCheckingGeofencePolicy(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selfServiceAllowed =
    !geofenceBypassActive &&
    options.allowSelfService === true &&
    kind === "staff" &&
    isApproved &&
    isStaffRole(userDoc);
  const assignedClassAllowed =
    !geofenceBypassActive &&
    kind === "student" &&
    isApproved &&
    isStaffRole(userDoc) &&
    hasAssignedClasses;
  const checkingAssignedClasses =
    !geofenceBypassActive &&
    kind === "student" &&
    isApproved &&
    isStaffRole(userDoc) &&
    !isAdmin &&
    !hasCapability &&
    assignedClassesLoading;
  const allowed =
    explicitAttendanceTaker ||
    selfServiceAllowed ||
    assignedClassAllowed;
  const ready =
    !loading && !checkingGeofencePolicy && !checkingAssignedClasses && allowed;

  useEffect(() => {
    if (loading || checkingGeofencePolicy || checkingAssignedClasses) return;

    if (!userDoc) {
      router.replace("/(auth)/login" as any);
      return;
    }

    if (!allowed && !warnedRef.current) {
      warnedRef.current = true;
      Alert.alert(
        "Access denied",
        geofenceBypassActive
          ? "Geofencing is currently bypassed. Only users explicitly permitted to take attendance can record student or staff attendance."
          : "You do not have permission to take this attendance."
      );
      router.replace("/" as any);
    }
  }, [
    allowed,
    checkingAssignedClasses,
    checkingGeofencePolicy,
    geofenceBypassActive,
    loading,
    router,
    userDoc,
  ]);

  return {
    userDoc,
    assignedStudentClasses,
    loading: loading || checkingGeofencePolicy || checkingAssignedClasses,
    allowed,
    ready,
    geofenceBypassActive,
    hasCapability: explicitAttendanceTaker,
  };
}
