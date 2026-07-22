// mobile/app/attendance/qr.tsx
import React, { useEffect, useState, useCallback, JSX } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
// use the unified register function (prevent duplicates)
import { registerAttendanceUnified } from "../../src/services/attendance";
import { getClassById } from "../../src/services/classes";
import { listStudents } from "../../src/services/students";
import { collection, query, where, getDocs } from "firebase/firestore";

import { db } from "../../app/firebase";
import { validateQrPayload } from "../../src/services/qr";
import { registerStaffAttendance } from "../../src/services/staffAttendance";
import { getStaffByStaffId } from "../../src/services/staff";
import { getAttendanceSettings } from "../../src/services/attendanceSettings";
import { getMovementReasonRequirement } from "../../src/services/movementPolicy";
import { useRequireAttendanceAccess } from "../../src/hooks/useRouteAuthorization";
import { useCurrentStaff } from "../../src/hooks/useCurrentStaff";
import { useMovementReasonPrompt } from "../../components/MovementReasonPrompt";
import { getTenantScope, tenantConstraints } from "../../src/services/tenantScope";

/** Helper: returns YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Parse JSON or string QR; returns studentId + classId if present */
function parseQRCodePayload(payload: string): {
  studentId?: string;
  staffId?: string;
  classId?: string;
} {
  try {
    const maybeJson = JSON.parse(payload);

    if (typeof maybeJson === "object" && maybeJson !== null) {

      const staffId =
        typeof maybeJson.staffId === "string"
          ? maybeJson.staffId
          : undefined;

      const studentId =
        typeof maybeJson.studentId === "string"
          ? maybeJson.studentId
          : typeof maybeJson.userId === "string"
          ? maybeJson.userId
          : undefined;

      const classId =
        typeof maybeJson.classId === "string"
          ? maybeJson.classId
          : undefined;

      return { studentId, staffId, classId };
    }
  } catch {}

  if (typeof payload === "string" && payload.trim().length > 0) {
    return { studentId: payload.trim() };
  }

  return {};
}


export default function QRScanner(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  const actorParam = params?.actor === "staff" ? "staff" : "student";
  const isSelfServiceStaff = actorParam === "staff" && params?.self === "1";
  const { staff: currentStaff, loading: currentStaffLoading } = useCurrentStaff();
  const {
    userDoc,
    assignedStudentClasses,
    loading: authorizationLoading,
    ready: authorizationReady,
    hasCapability,
  } = useRequireAttendanceAccess(actorParam, {
    allowSelfService: isSelfServiceStaff,
  });

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { promptMovementReason, movementReasonPrompt } = useMovementReasonPrompt();

  const [mode, setMode] = useState<"in" | "out">("in"); // default check-in

  async function getMovementReasonFor(nextMode: "in" | "out") {
    const settings = await getAttendanceSettings();
    const requirement = getMovementReasonRequirement({ settings, mode: nextMode });
    if (!requirement) return undefined;
    const reason = await promptMovementReason(requirement);
    if (!reason) throw new Error("A movement book entry is required to complete this attendance action.");
    return reason;
  }

  // selectedClassId from URL param (if provided)
  const [selectedClassIdFromParam, setSelectedClassIdFromParam] = useState<string | null>(null);

  // friendly display name for the class (loaded from Firestore if possible)
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);

  // resolvedDocId: the actual classes collection document id (useful for listing students)
  const [selectedClassResolvedDocId, setSelectedClassResolvedDocId] = useState<string | null>(null);

  // student count for resolved class doc id
  const [selectedClassStudentCount, setSelectedClassStudentCount] = useState<number | null>(null);

  /** Read ?mode=in or ?mode=out and ?classId=... from route */
  useEffect(() => {
    const m = params?.mode;
    if (m === "out") setMode("out");
    else setMode("in");

    const cid = params?.classId;
    if (cid && typeof cid === "string" && cid.trim().length > 0) {
      setSelectedClassIdFromParam(cid);
    } else {
      setSelectedClassIdFromParam(null);
      setSelectedClassName(null);
      setSelectedClassResolvedDocId(null);
      setSelectedClassStudentCount(null);
    }
  }, [params]);

  /** If we have a classId param, try to resolve a friendly name and resolved doc id, and then fetch student count */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedClassIdFromParam) return;

      setSelectedClassName(null);
      setSelectedClassResolvedDocId(null);
      setSelectedClassStudentCount(null);

      try {
        const doc = await getClassById(selectedClassIdFromParam);
        if (mounted && doc) {
          setSelectedClassName(doc.name ?? selectedClassIdFromParam);
          setSelectedClassResolvedDocId(doc.id ?? null);
          try {
            const students = await listStudents(doc.id ?? "");
            if (mounted) setSelectedClassStudentCount(students.length);
          } catch {}
          return;
        }
      } catch {}

      try {
        const q = query(
          collection(db, "classes"),
          where("classId", "==", selectedClassIdFromParam),
          ...tenantConstraints(await getTenantScope())
        );
        const snap = await getDocs(q);
        if (mounted && snap.docs.length > 0) {
          const d = snap.docs[0];
          const data = d.data() as any;
          setSelectedClassName(data.name ?? selectedClassIdFromParam);
          setSelectedClassResolvedDocId(d.id);
          try {
            const students = await listStudents(d.id);
            if (mounted) setSelectedClassStudentCount(students.length);
          } catch {}
          return;
        }
      } catch {}

      if (mounted) {
        setSelectedClassName(selectedClassIdFromParam);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedClassIdFromParam]);

  /** Request camera permission */
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  /** Handle scan */
  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      // prevent running multiple times while processing or already scanned
      if (scanned || processing) return;

      setScanned(true);
      setScannedPayload(data);

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      console.log("[QR] scanned data:", data);

      // Try to parse JSON or fallback
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(data);
      } catch (e) {
        parsedJson = null;
      }

      // Detect signed payload (legacy/signed)
      const isSignedPayload =
        parsedJson &&
        typeof parsedJson === "object" &&
        typeof parsedJson.userId === "string" &&
        typeof parsedJson.role === "string" &&
        typeof parsedJson.ts !== "undefined" &&
        typeof parsedJson.sig === "string";

     let scannedId: string | null = null;
let classIdFromQR: string | null = null;

const isStaffActor = params?.actor === "staff";

if (isSignedPayload) {
  try {
    const valid = await validateQrPayload(parsedJson as any);
    if (!valid) {
      Alert.alert("Invalid QR", "Signature validation failed.");
      setScanned(false);
      setScannedPayload(null);
      return;
    }
  } catch (err) {
    Alert.alert("Invalid QR", "Signature validation error.");
    setScanned(false);
    setScannedPayload(null);
    return;
  }

  scannedId = String(parsedJson.userId);
  classIdFromQR = parsedJson.classId ?? null;

} else {
  const fallback = parseQRCodePayload(data);

  scannedId = isStaffActor
    ? (fallback.staffId ?? fallback.studentId ?? null)
    : (fallback.studentId ?? null);

  classIdFromQR = fallback.classId ?? null;
}


// ✅ Role-aware safety check
if (!scannedId) {
  Alert.alert(
    "Invalid QR",
    isStaffActor
      ? "This QR code does not contain a Staff ID."
      : "This QR code does not contain a Student ID."
  );
  setScanned(false);
  setScannedPayload(null);
  return;
}


     // Determine class id to use: prefer URL param, then QR payload
const finalClassId = selectedClassIdFromParam ?? classIdFromQR ?? null;
const classDocIdFromParam =
  typeof params?.classDocId === "string" ? params.classDocId : null;
const assignedClassForScan = assignedStudentClasses.find(
  (cls) => cls.id === finalClassId || cls.classId === finalClassId
);
const finalClassDocId =
  classDocIdFromParam ?? selectedClassResolvedDocId ?? assignedClassForScan?.id ?? null;
const canUseAllStudentClasses =
  params?.actor === "staff" ||
  (userDoc?.role === "admin" || userDoc?.role === "super_admin") ||
  hasCapability;

// ✅ Only enforce class for STUDENTS
if (!finalClassId && params?.actor !== "staff") {
  Alert.alert(
    "Class not specified",
    "No class selected. Provide a class in the QR payload or select one first."
  );
  setScanned(false);
  setScannedPayload(null);
  return;
}

if (params?.actor !== "staff") {
  const assignedClassAllowed = assignedStudentClasses.some(
    (cls) =>
      cls.id === finalClassId ||
      cls.classId === finalClassId ||
      (finalClassDocId ? cls.id === finalClassDocId : false)
  );

  if (!canUseAllStudentClasses && !assignedClassAllowed) {
    Alert.alert(
      "Class not assigned",
      "You can only take attendance for classes assigned to you."
    );
    setScanned(false);
    setScannedPayload(null);
    return;
  }
}


      setProcessing(true);
try {
  const currentActor = params?.actor ?? "student";
  const movementReason = await getMovementReasonFor(mode);

  if (currentActor === "staff") {
  // ============================
  // 👨‍🏫 STAFF FLOW (Updated for recordAttendanceCore pattern)
  // ============================

  // 1️⃣ Safety check for signed QR role
  if (isSignedPayload && parsedJson.role !== "staff") {
    Alert.alert("Invalid QR", "This QR code is not for a staff member.");
    setProcessing(false);
    setScanned(false);
    return;
  }

  const finalId = scannedId; // e.g. "TCH-0017"

  if (isSelfServiceStaff) {
    const ownIds = [currentStaff?.staffId, currentStaff?.id].filter(Boolean);

    if (!currentStaff?.id || !ownIds.includes(finalId)) {
      Alert.alert(
        "Wrong QR code",
        "This QR code does not match your staff profile."
      );
      setProcessing(false);
      setScanned(false);
      return;
    }

    await registerStaffAttendance({
      staffId: currentStaff.id,
      mode,
      method: "qr",
      biometric: false,
      movementReason,
    });

    Alert.alert(
      "Success",
      `${currentStaff.name ?? "Staff member"} ${
        mode === "in" ? "checked in" : "checked out"
      } successfully.`
    );
    return;
  }

  // 2️⃣ Find the actual staff document in Firestore
  const staffRecord = await getStaffByStaffId(finalId);
  if (!staffRecord?.id) {
    Alert.alert("Unknown Staff", `No staff record found for ID: ${finalId}`);
    setProcessing(false);
    setScanned(false);
    return;
  }
  const staffDocId = staffRecord.id;
  const staffName = staffRecord.name ?? "Staff Member";

  // 3️⃣ Call your existing service
  // This internally calls findStaffAttendanceForDate + recordAttendanceCore
  await registerStaffAttendance({
    staffId: staffDocId,
    mode: mode,
    method: "qr",
    biometric: false,
    movementReason,
  });

  Alert.alert(
    "Success",
    `${staffName} ${mode === "in" ? "checked in" : "checked out"} successfully.`
  );
}
 else {
    // ============================
    // 👨‍🎓 STUDENT FLOW (Existing)
    // ============================

    let studentDoc: any = null;

    // 1️⃣ Try studentId
    const q1 = query(
      collection(db, "students"),
     where("studentId", "==", scannedId),
     ...tenantConstraints(await getTenantScope())

    );
    const snap1 = await getDocs(q1);

    if (snap1.docs.length > 0) {
      const d = snap1.docs[0];
      studentDoc = { id: d.id, ...(d.data() as any) };
    }

    // 2️⃣ Fallback rollNo
    if (!studentDoc) {
      const q2 = query(
        collection(db, "students"),
      where("rollNo", "==", scannedId),
      ...tenantConstraints(await getTenantScope())

      );
      const snap2 = await getDocs(q2);

      if (snap2.docs.length > 0) {
        const d = snap2.docs[0];
        studentDoc = { id: d.id, ...(d.data() as any) };
      }
    }

    // 3️⃣ Safety
    if (!studentDoc) {
      Alert.alert(
        "Unknown Student",
        "Scanned ID does not match any student record."
      );
      setProcessing(false);
      setScanned(false);
      return;
    }

    // Inside the STUDENT FLOW (Existing)
await registerAttendanceUnified({
  studentId: String(studentDoc.id),
  // Add the '!' to tell TypeScript: "I've checked, this is definitely not null"
  classId: finalClassId!, 
  classDocId: finalClassDocId ?? undefined,
  mode,
  biometric: false,
  enforceClassAssignment: !canUseAllStudentClasses,
  movementReason,
});

    Alert.alert(
      "Success",
      `${studentDoc.name ?? "Student"} successfully ${
        mode === "in" ? "checked in" : "checked out"
      }.`
    );
  }

  try {
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );
  } catch {}
} catch (err: any) {
  Alert.alert(
    "Attendance Error",
    err?.message ?? "Failed to record attendance."
  );
  setScanned(false);
} finally {
  setProcessing(false);
}

    },
    [
      scanned,
      processing,
      mode,
      selectedClassIdFromParam,
      params?.actor,
      isSelfServiceStaff,
      currentStaff?.id,
      currentStaff?.staffId,
      currentStaff?.name,
      params?.classDocId,
      selectedClassResolvedDocId,
      userDoc?.role,
      hasCapability,
      assignedStudentClasses,
    ]
  );

  /** Permission states UI */
  if (
    authorizationLoading ||
    (isSelfServiceStaff && currentStaffLoading) ||
    !authorizationReady
  ) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
        <Text className="mt-3 text-neutral">Checking access...</Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
        <Text className="mt-3 text-neutral">Requesting camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-xl font-semibold mb-3">Camera permission required</Text>

        <Text className="text-neutral mb-6 text-center">
          This screen needs camera access to scan QR codes. Enable it in
          Settings.
        </Text>

        <Pressable
          onPress={() =>
            Camera.requestCameraPermissionsAsync().then(({ status }) =>
              setHasPermission(status === "granted")
            )
          }
          className="bg-primary py-3 px-6 rounded-xl"
        >
          <Text className="text-white font-semibold text-center">
            Grant Permission
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace(
              isSelfServiceStaff
                ? ("/staff/my-attendance" as any)
                : ("/attendance/checkin" as any)
            )
          }
          className="mt-4 border py-2 px-4 rounded-xl"
        >
          <Text className="text-neutral text-center">Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isSelfServiceStaff && !currentStaff) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-xl font-semibold mb-3">
          Staff profile not linked
        </Text>
        <Text className="text-neutral text-center">
          Ask an administrator to link your user account to a staff record.
        </Text>
      </SafeAreaView>
    );
  }

  const displayClassInfo =
    selectedClassName
      ? `Class: ${selectedClassName}` +
        (typeof selectedClassStudentCount === "number" ? ` • ${selectedClassStudentCount} student${selectedClassStudentCount === 1 ? "" : "s"}` : "")
      : "";

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1">

        {/* CAMERA */}
        <CameraView
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          style={{ flex: 1 }}
        />

        {/* OVERLAY UI */}
        <View className="absolute inset-0">

          {/* TOP HEADER */}
         {/* TOP HEADER */}
<View className="px-6 pt-10">
  <Text className="text-white text-xl font-bold text-center">
    {isSelfServiceStaff
      ? "Scan Your Staff QR"
      : params?.actor === "staff"
      ? "Scan Staff QR"
      : "Scan Student QR"}
  </Text>
  <Text className="text-white/70 text-sm text-center mt-1">
    Point your camera at the{" "}
    {isSelfServiceStaff
      ? "QR code linked to your profile"
      : params?.actor === "staff"
      ? "staff member's QR code"
      : "student's QR code"}
  </Text>


            {/* show selected class if provided */}
            {displayClassInfo ? (
              <Text className="text-white/80 text-sm text-center mt-3">{displayClassInfo}</Text>
            ) : null}

            {/* MODE TOGGLE */}
            <View className="mt-4 flex-row justify-center space-x-3">
              <Pressable
                onPress={() => setMode("in")}
                className={`px-4 py-2 rounded-full ${mode === "in" ? "bg-white" : "bg-white/15"}`}
              >
                <Text className={`font-semibold ${mode === "in" ? "text-primary" : "text-white"}`}>
                  Check-in
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMode("out")}
                className={`px-4 py-2 rounded-full ${mode === "out" ? "bg-white" : "bg-white/15"}`}
              >
                <Text className={`font-semibold ${mode === "out" ? "text-primary" : "text-white"}`}>
                  Check-out
                </Text>
              </Pressable>
            </View>
          </View>

          {/* SCAN FRAME */}
          <View className="flex-1 items-center justify-center">
            {/* Dark dim overlay */}
            <View className="absolute inset-0 bg-black/50" />

            <View
              style={{
                width: "70%",
                aspectRatio: 1,
                borderRadius: 14,
                overflow: "hidden",
              }}
              className="relative"
            >
              {/* Border */}
              <View
                style={{
                  borderWidth: 1.5,
                  borderColor: "rgba(255,255,255,0.25)",
                  borderRadius: 14,
                }}
                className="absolute inset-0"
              />

              {/* Corner guides */}
              {["tl", "tr", "bl", "br"].map((c) => (
                <View
                  key={c}
                  style={{
                    position: "absolute",
                    width: 32,
                    height: 32,
                   borderColor: params?.actor === "staff" ? "#6366f1" : "white",

                    ...(c === "tl" && { left: -2, top: -2, borderLeftWidth: 3, borderTopWidth: 3 }),
                    ...(c === "tr" && { right: -2, top: -2, borderRightWidth: 3, borderTopWidth: 3 }),
                    ...(c === "bl" && { left: -2, bottom: -2, borderLeftWidth: 3, borderBottomWidth: 3 }),
                    ...(c === "br" && { right: -2, bottom: -2, borderRightWidth: 3, borderBottomWidth: 3 }),
                  }}
                />
              ))}
            </View>
          </View>

          {/* BOTTOM CARD */}
          <LinearGradient
            colors={["rgba(0,0,0,0.9)", "transparent"]}
            className="p-4"
          >

            {scannedPayload ? (
  <View className="bg-white/10 border border-white/10 rounded-xl p-4">
    <Text className="text-white/70 text-sm">Scanned:</Text>
    <Text className="text-white font-semibold mt-1">
      {(() => {
        try {
          const parsed = JSON.parse(scannedPayload);
          // Show only userId, role, classId like the PDF
          return JSON.stringify({
            userId: parsed.userId,
            role: parsed.role,
            classId: parsed.classId ?? undefined,
          }, null, 2);
        } catch {
          // fallback for plain strings
          return scannedPayload;
        }
      })()}
    </Text>


                <View className="flex-row mt-4 space-x-3">
                  <Pressable
                    onPress={() => {
                      setScanned(false);
                      setScannedPayload(null);
                    }}
                    className="flex-1 bg-primary py-3 rounded-xl"
                  >
                    <Text className="text-white font-semibold text-center">
                      Scan Again
                    </Text>
                  </Pressable>

          <Pressable
  onPress={() => {
    router.replace({
      pathname: isSelfServiceStaff
        ? "/staff/my-attendance"
        : "/attendance/checkin",
      params: { actor: params?.actor ?? "student" },
    });
  }}
  className="flex-1 border border-white/20 py-3 rounded-xl"
>
  <Text className="text-white font-semibold text-center">
    Done
  </Text>
</Pressable>


                </View>
              </View>
            ) : (
              <View className="flex-row justify-between">
                <Pressable
                  onPress={() => router.back()}
                  className="py-3 px-4 rounded-xl bg-white/10"
                >
                  <Text className="text-white font-semibold">Back</Text>
                </Pressable>

                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Pressable
                    onPress={() =>
                      router.replace(
                        isSelfServiceStaff
                          ? ("/staff/my-attendance" as any)
                          : ("/attendance/checkin" as any)
                      )
                    }
                    className="py-3 px-4 rounded-xl bg-white/10"
                  >
                    <Text className="text-white font-semibold">Cancel</Text>
                  </Pressable>
                )}
              </View>
            )}
          </LinearGradient> 
        </View>
      </View>
      {movementReasonPrompt}
    </SafeAreaView>
  );
}



