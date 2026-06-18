//app/attendance/checkin.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { listClasses, type ClassRecord } from "../../src/services/classes";
import type { Student as StudentRecord } from "../../src/services/types";
import { registerAttendanceUnified } from "../../src/services/attendance";
import { getStudentById } from "../../src/services/students";
import { getStaffByStaffId } from "../../src/services/staff";
import { registerStaffAttendance } from "../../src/services/staffAttendance";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../app/firebase";
import { handleStaffBiometricCheck } from "../../src/services/staffBiometricHandler";
import { useRequireAttendanceAccess } from "../../src/hooks/useRouteAuthorization";
import AppInput from "@/components/AppInput";

/* ------------------------- Attendance Restrictions ------------------------- */
function isAttendanceAllowed(): { allowed: boolean; reason?: string } {
  const today = new Date();
  const day = today.getDay();
  if (day === 0) return { allowed: false, reason: "Today is Sunday. Attendance is not allowed." };
  if (day === 6) return { allowed: false, reason: "Today is Saturday. Attendance is not allowed." };
  const holidays = ["2026-01-01", "2026-04-15", "2026-12-25"];
  const todayISO = today.toISOString().slice(0, 10);
  if (holidays.includes(todayISO)) {
    return { allowed: false, reason: "Today is a holiday. Attendance is not allowed." };
  }
  return { allowed: true };
}

/* ------------------------- Student Row ------------------------- */
function StudentRow({ student, onCheckIn, onCheckOut }: { student: StudentRecord; onCheckIn: () => void; onCheckOut: () => void; }) {
  const [hasBiometric, setHasBiometric] = useState(false);
  useEffect(() => {
    setHasBiometric(!!student.fingerprintId);
  }, [student.fingerprintId]);

  const idText = student.studentId ?? student.rollNo ?? "";
  const enrollStatus = hasBiometric ? " (Enrolled)" : " (No biometric)";

  return (
    <View className={`px-4 py-3 rounded-xl mb-3 ${hasBiometric ? "bg-green-100" : "bg-gray-100"}`}>
      <Text className={`${hasBiometric ? "text-green-800" : "text-gray-700"} mb-2`}>
        {`${student.name} ${idText ? `(${idText})` : ""}${enrollStatus}`}
      </Text>
      <View className="flex-row">
  <Pressable
    onPress={onCheckIn}
    disabled={!hasBiometric}
    className={`${hasBiometric ? "bg-blue-600" : "bg-gray-400"} px-4 py-2 rounded-lg mr-3`}
  >
    <Text className="text-white font-semibold">Check-In</Text>
  </Pressable>

  <Pressable
    onPress={onCheckOut}
    disabled={!hasBiometric}
    className={`${hasBiometric ? "bg-yellow-600" : "bg-gray-400"} px-4 py-2 rounded-lg mr-3`}
  >
    <Text className="text-white font-semibold">Check-Out</Text>
  </Pressable>
</View>

    </View>
  );
}

function StaffRow({ staff, onCheckIn, onCheckOut }: { staff: any; onCheckIn: () => void; onCheckOut: () => void; }) {
  const hasBiometric = !!staff.fingerprintId;

  return (
    <View className={`px-4 py-3 rounded-xl mb-3 ${hasBiometric ? "bg-blue-50" : "bg-gray-100"}`}>
      <Text className={`${hasBiometric ? "text-blue-800" : "text-gray-700"} mb-2 font-medium`}>
        {`${staff.name} (${staff.staffId ?? "No ID"})${hasBiometric ? " (Enrolled)" : " (No biometric)"}`}
      </Text>
      <View className="flex-row">
        <Pressable
          onPress={onCheckIn}
          disabled={!hasBiometric}
          className={`${hasBiometric ? "bg-blue-600" : "bg-gray-400"} px-4 py-2 rounded-lg mr-3 shadow-sm`}
        >
          <Text className="text-white font-semibold">Check-In</Text>
        </Pressable>

        <Pressable
          onPress={onCheckOut}
          disabled={!hasBiometric}
          className={`${hasBiometric ? "bg-yellow-600" : "bg-gray-400"} px-4 py-2 rounded-lg shadow-sm`}
        >
          <Text className="text-white font-semibold">Check-Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------- Main Screen ------------------------- */
export default function CheckinScreen() {
  const router = useRouter();
  const { actor = "student" } = useLocalSearchParams<{ actor?: "student" | "staff" }>();
  const attendanceKind = actor === "staff" ? "staff" : "student";
  const {
    userDoc,
    assignedStudentClasses,
    loading: authorizationLoading,
    ready: authorizationReady,
    hasCapability,
  } = useRequireAttendanceAccess(attendanceKind);
  const [confirmation, setConfirmation] = useState<{ name: string; mode: "in" | "out"; time: string; } | null>(null);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [staffMembers] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showBiometric, setShowBiometric] = useState(false);
  const [staffIdInput, setStaffIdInput] = useState("");
  const [staffIdSubmitting, setStaffIdSubmitting] = useState(false);

  const canUseAllStudentClasses =
    userDoc?.role === "admin" || hasCapability;

  function getSelectedClass() {
    return classes.find(
      (cls) => cls.classId === selectedClassId || cls.id === selectedClassId
    );
  }

  useEffect(() => { loadClasses(); }, [actor, authorizationReady, assignedStudentClasses.length]);

  useEffect(() => {
    if (actor === "staff") {
      setShowBiometric(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor !== "student" || !selectedClassId) {
      setStudents([]);
      return;
    }
    const selectedClass = getSelectedClass();
    const classField =
      !canUseAllStudentClasses && selectedClass?.id ? "classDocId" : "classId";
    const classValue =
      !canUseAllStudentClasses && selectedClass?.id
        ? selectedClass.id
        : selectedClassId;
    const q = query(collection(db, "students"), where(classField, "==", classValue));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StudentRecord[]);
    }, (err) => {
      Alert.alert("Failed to load students", err?.message ?? String(err));
    });
    return () => unsubscribe();
  }, [selectedClassId, actor, classes]);
  async function loadClasses() {
    if (!authorizationReady) return;

    setClassesLoading(true);
    try {
      const data =
        actor === "student" && !canUseAllStudentClasses
          ? assignedStudentClasses
          : await listClasses();
      setClasses(data);
      const selectedStillAvailable = data.some(
        (cls) => cls.classId === selectedClassId || cls.id === selectedClassId
      );
      if (data.length > 0 && (!selectedClassId || !selectedStillAvailable)) {
        setSelectedClassId(data[0].classId ?? data[0].id ?? null);
      } else if (data.length === 0) {
        setSelectedClassId(null);
      }
    } catch (err: any) {
      Alert.alert("Failed to load classes", err?.message ?? String(err));
    } finally { setClassesLoading(false); }
  }

  async function tryFingerprint(actorId: string, checkType: "in" | "out") {
  if (actor === "staff") {
    Alert.alert(
      "Use QR or face recognition",
      "Staff attendance for other people should be recorded with QR code or face recognition."
    );
    return;
  }

  const attendanceCheck = isAttendanceAllowed();
  if (!attendanceCheck.allowed) {
    Alert.alert("Attendance not allowed", attendanceCheck.reason);
    return;
  }

  if (!selectedClassId && actor === "student") {
    Alert.alert("Select class", "Please select a class before recording attendance.");
    return;
  }

  setLoading(true);

  try {
    // 1️⃣ Biometric Hardware Check
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolledOnDevice = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !enrolledOnDevice) {
      Alert.alert("Biometric unavailable", "No biometrics enrolled on this device.");
      return;
    }

    // ===============================
    // 👨‍🎓 STUDENT LOGIC
    // ===============================
    if (actor === "student") {
      const student = await getStudentById(actorId);

      // ✅ NEW: Enrollment Verification
      if (!student || !student.fingerprintId) {
        Alert.alert("Denied", "This student is not biometrically enrolled.");
        return;
      }

      // Authenticate AFTER verification
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate Student`,
      });

      if (!res.success) return;

      await registerAttendanceUnified({
        studentId: actorId,
        classId: selectedClassId!,
        classDocId: getSelectedClass()?.id,
        mode: checkType,
        biometric: true,
        method: "fingerprint",
        enforceClassAssignment: !canUseAllStudentClasses,
      });

      setConfirmation({
        name: student.name ?? "Student",
        mode: checkType,
        time: new Date().toLocaleTimeString(),
      });
    }

    // ===============================
    // 👨‍🏫 STAFF LOGIC (UPDATED)
    // ===============================
    else {
      // Find staff locally
      const staff = staffMembers.find((s) => s.id === actorId);

      // ✅ NEW: Enrollment Verification
      if (!staff || !staff.fingerprintId) {
        Alert.alert(
          "Access Denied",
          "You are not biometrically enrolled. Please contact the administrator to register your fingerprint first."
        );
        return;
      }

      // Authenticate AFTER verification
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate Staff: ${staff.name}`,
      });

      if (!res.success) return;

      await handleStaffBiometricCheck({
        staffId: actorId,
        mode: checkType,
        biometricVerified: true,
        method: "fingerprint",
      });

      setConfirmation({
        name: staff.name,
        mode: checkType,
        time: new Date().toLocaleTimeString(),
      });
    }

    setTimeout(() => setConfirmation(null), 3000);
  } catch (err: any) {
    Alert.alert("Error", err?.message ?? String(err));
  } finally {
    setLoading(false);
  }
}

  function goToQR(mode?: "in" | "out") {
    const attendanceCheck = isAttendanceAllowed();
    if (!attendanceCheck.allowed) return Alert.alert("Attendance not allowed", attendanceCheck.reason);
    if (actor === "student" && !selectedClassId) return Alert.alert("Select class first");

    const selectedClass = getSelectedClass();

    router.push({
      pathname: "/attendance/qr",
      params: actor === "student"
        ? {
            classId: selectedClassId,
            classDocId: selectedClass?.id,
            mode,
            actor,
          }
        : { mode, actor },
    } as any);
  }

  async function submitStaffIdAttendance(mode: "in" | "out") {
    if (actor !== "staff") return;

    const attendanceCheck = isAttendanceAllowed();
    if (!attendanceCheck.allowed) {
      Alert.alert("Attendance not allowed", attendanceCheck.reason);
      return;
    }

    const staffCode = staffIdInput.trim();
    if (!staffCode) {
      Alert.alert("Staff ID required", "Enter a staff ID before recording attendance.");
      return;
    }

    setStaffIdSubmitting(true);
    try {
      const staff = await getStaffByStaffId(staffCode);
      if (!staff?.id) {
        Alert.alert("Staff not found", `No staff record found for ID: ${staffCode}`);
        return;
      }

      await registerStaffAttendance({
        staffId: staff.id,
        mode,
        method: "manual",
        biometric: false,
      });

      setConfirmation({
        name: staff.name ?? staff.staffId ?? "Staff member",
        mode,
        time: new Date().toLocaleTimeString(),
      });
      setStaffIdInput("");
      setTimeout(() => setConfirmation(null), 3000);
    } catch (error) {
      Alert.alert(
        "Attendance error",
        error instanceof Error ? error.message : "Could not record staff attendance."
      );
    } finally {
      setStaffIdSubmitting(false);
    }
  }

  function renderClassChip({ item }: { item: ClassRecord }) {
    const isSelected = item.classId === selectedClassId || item.id === selectedClassId;
    return (
      <Pressable
        onPress={() => setSelectedClassId(item.classId ?? item.id ?? null)}
        className={`px-3 py-2 rounded-full mr-3 ${isSelected ? "bg-primary" : "bg-white"}`}
        style={isSelected ? undefined : { borderWidth: 1, borderColor: "#E5E7EB" }}
      >
        <Text className={`${isSelected ? "text-white" : "text-dark"}`}>{`${item.name}`}</Text>
      </Pressable>
    );
  }

  function renderListHeader() {
    const check = isAttendanceAllowed();
    return (
      <View>
        {!check.allowed ? (
          <View className="bg-yellow-100 p-4 rounded-lg mb-4 mx-4">
            <Text className="text-yellow-800 font-semibold text-center">{`${check.reason}`}</Text>
          </View>
        ) : null}

        <View className="bg-white -mx-4">
          <Image source={require("../../assets/images/how-it-works.jpg")} style={{ width: "100%", height: 130 }} resizeMode="stretch" />
        </View>

        {actor === "student" ? (
          <View className="mb-4 mt-4">
            <Text className="text-sm font-semibold mb-2">Choose class</Text>
            {classesLoading ? <ActivityIndicator /> : (
              <FlatList data={classes} horizontal renderItem={renderClassChip} keyExtractor={(item) => (item.id || item.classId || Math.random().toString())} showsHorizontalScrollIndicator={false} />
            )}
          </View>
        ) : null}

        {actor === "student" ? (
        <Pressable onPress={() => setShowBiometric(!showBiometric)} className="bg-white rounded-2xl p-5 shadow flex-row items-center mb-5 mt-2">
          <View className="p-4 bg-primary/10 rounded-xl mr-4">
            <MaterialCommunityIcons name="fingerprint" size={28} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-dark">{actor === "student" ? "Student Biometric Attendance" : "Staff Biometric Attendance"}</Text>
            <Text className="text-sm text-neutral mt-1">
              {showBiometric ? "Tap to record attendance via fingerprint." : "Check-in or check-out using fingerprint."}
            </Text>
          </View>
          <MaterialIcons name={showBiometric ? "keyboard-arrow-up" : "arrow-forward-ios"} size={16} color="#64748B" />
        </Pressable>
        ) : null}

        {actor === "staff" ? (
          <View className="bg-white rounded-2xl p-5 shadow mb-5 mt-2">
            <View className="flex-row items-center mb-3">
              <View className="p-4 bg-emerald-100 rounded-xl mr-4">
                <MaterialIcons name="badge" size={28} color="#047857" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-dark">
                  Staff ID Attendance
                </Text>
                <Text className="text-sm text-neutral mt-1">
                  Enter a staff ID to check staff in or out.
                </Text>
              </View>
            </View>

            <AppInput
              value={staffIdInput}
              onChangeText={setStaffIdInput}
              placeholder="e.g. TCH-0001 or NST-0001"
              autoCapitalize="characters"
              className="border p-3 rounded-xl mb-3 bg-white"
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => submitStaffIdAttendance("in")}
                disabled={staffIdSubmitting}
                className="flex-1 bg-blue-600 rounded-xl py-3"
                style={staffIdSubmitting ? { opacity: 0.7 } : undefined}
              >
                <Text className="text-white text-center font-semibold">
                  Check-In
                </Text>
              </Pressable>
              <Pressable
                onPress={() => submitStaffIdAttendance("out")}
                disabled={staffIdSubmitting}
                className="flex-1 bg-amber-600 rounded-xl py-3"
                style={staffIdSubmitting ? { opacity: 0.7 } : undefined}
              >
                <Text className="text-white text-center font-semibold">
                  Check-Out
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable onPress={() => goToQR("in")} className="bg-white rounded-2xl p-5 shadow flex-row items-center mb-5">
          <View className="p-4 bg-primary/10 rounded-xl mr-4">
            <MaterialIcons name="qr-code-scanner" size={28} color="#1E3A8A" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-dark">Scan QR Code (In)</Text>
            <Text className="text-sm text-neutral mt-1">Check-in via QR scan.</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#64748B" />
        </Pressable>

        <Pressable onPress={() => goToQR("out")} className="bg-white rounded-2xl p-5 shadow flex-row items-center mb-5">
          <View className="p-4 bg-accent1/10 rounded-xl mr-4">
            <MaterialIcons name="qr-code-scanner" size={28} color="#0EA5E9" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-dark">Scan QR Code (Out)</Text>
            <Text className="text-sm text-neutral mt-1">Check-out via QR scan.</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#64748B" />
        </Pressable>


        {actor === "staff" ? (
          <>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/staff/face-checkin",
                  params: { mode: "in" },
                })
              }
              className="bg-white rounded-2xl p-5 shadow flex-row items-center mb-5"
            >
              <View className="p-4 bg-indigo-100 rounded-xl mr-4">
                <MaterialCommunityIcons name="face-man-profile" size={28} color="#4F46E5" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-dark">
                  Staff Face Check-In
                </Text>
                <Text className="text-sm text-neutral mt-1">
                  Check-in using facial recognition.
                </Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={16} color="#64748B" />
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/staff/face-checkin",
                  params: { mode: "out" },
                })
              }
              className="bg-white rounded-2xl p-5 shadow flex-row items-center mb-5"
            >
              <View className="p-4 bg-violet-100 rounded-xl mr-4">
                <MaterialCommunityIcons name="face-recognition" size={28} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-dark">
                  Staff Face Check-Out
                </Text>
                <Text className="text-sm text-neutral mt-1">
                  Check-out using facial recognition.
                </Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={16} color="#64748B" />
            </Pressable>
          </>
        ) : null}
        {!showBiometric ? (
          <View className="mt-4 bg-white rounded-2xl p-4 shadow">
            <Text className="font-semibold text-dark text-base mb-2">How it works</Text>
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="check-circle" size={20} color="#10B981" /><Text className="ml-3 text-neutral">{actor === "staff" ? "Scan QR or use face recognition for check-in." : "Scan QR or fingerprint for check-in."}</Text>
            </View>
            <View className="flex-row items-center">
              <MaterialIcons name="check-circle" size={20} color="#10B981" /><Text className="ml-3 text-neutral">Attendance is logged automatically.</Text>
            </View>
          </View>
        ) : null}
        <View style={{ height: 20 }} />
      </View>
    );
  }

  if (authorizationLoading || !authorizationReady) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-300">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-4 text-dark font-semibold">Checking access...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-300">
      <View className="bg-[#0B1C33] px-6 pt-2 pb-4 border-b border-blue-900/40 shadow-md">
        <View className="flex-row items-center mb-2">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#ffffff" />
          </Pressable>
          <MaterialIcons name="fact-check" size={28} color="#3B82F6" className="mr-2" />
          <Text className="text-3xl font-extrabold text-white">{actor === "student" ? "Student Attendance" : "Staff Attendance"}</Text>
        </View>
      </View>

      {showBiometric && actor === "student" ? (
        <View className="flex-1">
          {students.length === 0 ? (
            <View className="flex-1 justify-center items-center px-6">
              <MaterialCommunityIcons name="account-off-outline" size={64} color="#64748B" />
              <Text className="mt-4 text-lg font-semibold text-dark">No students found</Text>
              <Pressable onPress={() => setShowBiometric(false)} className="mt-6 bg-primary px-6 py-3 rounded-xl"><Text className="text-white">Go Back</Text></Pressable>
            </View>
          ) : (
            <View className="flex-1">
              <FlatList
                data={students}
                keyExtractor={(item) => (item.id ?? Math.random().toString())}
                renderItem={({ item }) => (
                  <StudentRow student={item} onCheckIn={() => tryFingerprint(item.id, "in")} onCheckOut={() => tryFingerprint(item.id, "out")} />
                )}
                contentContainerStyle={{ padding: 16, paddingTop: 60 }}
              />
              <Pressable onPress={() => setShowBiometric(false)} className="absolute top-4 right-4 bg-red-500 px-4 py-2 rounded-full shadow-lg z-50">
                <Text className="text-white font-semibold">Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {!showBiometric ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16 }}
        >
          {renderListHeader()}
        </ScrollView>
      ) : null}

      {confirmation ? (
        <View className="absolute bottom-10 left-0 right-0 items-center px-4">
          <View className="bg-white rounded-2xl px-6 py-4 shadow-lg border border-gray-200">
            <Text className="text-lg font-semibold text-dark">{confirmation.mode === "in" ? "Checked In" : "Checked Out"}</Text>
            <Text className="mt-1 text-neutral text-base">{`${confirmation.name}`}</Text>
            <Text className="text-xs text-neutral/60 mt-1">{`${confirmation.time}`}</Text>
          </View>
        </View>      
      ) : null}
    </View>
  );
}
