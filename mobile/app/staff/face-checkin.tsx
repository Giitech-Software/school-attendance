// mobile/app/staff/face-checkin.tsx
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  CameraView, useCameraPermissions,
} from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { searchFace } from "../../src/services/faceService";
import { handleStaffBiometricCheck } from "../../src/services/staffBiometricHandler";
import { registerStaffAttendance } from "../../src/services/staffAttendance";
import { getAttendanceSettings } from "../../src/services/attendanceSettings";
import { getMovementReasonRequirement } from "../../src/services/movementPolicy";
import { useRequireAttendanceAccess } from "../../src/hooks/useRouteAuthorization";
import { useCurrentStaff } from "../../src/hooks/useCurrentStaff";
import { MaterialIcons } from "@expo/vector-icons";
import { useMovementReasonPrompt } from "../../components/MovementReasonPrompt";

export default function FaceCheckin() {
  const router = useRouter();
  const { mode = "in", self } = useLocalSearchParams<{
    mode?: "in" | "out";
    self?: string;
  }>();
  const isSelfService = self === "1";
  const { staff: currentStaff, loading: currentStaffLoading } = useCurrentStaff();
  const {
    loading: authorizationLoading,
    ready: authorizationReady,
  } = useRequireAttendanceAccess("staff", {
    allowSelfService: isSelfService,
  });
  const attendanceMode = mode === "out" ? "out" : "in";
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const { promptMovementReason, movementReasonPrompt } = useMovementReasonPrompt();

  async function getMovementReasonFor(mode: "in" | "out") {
    const settings = await getAttendanceSettings();
    const requirement = getMovementReasonRequirement({ settings, mode });
    if (!requirement) return undefined;
    const reason = await promptMovementReason(requirement);
    if (!reason) throw new Error("A movement book entry is required to complete this attendance action.");
    return reason;
  }

  if (
    authorizationLoading ||
    (isSelfService && currentStaffLoading) ||
    !authorizationReady
  ) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
        <Text className="mt-3">Checking access...</Text>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center">
        <Pressable
          onPress={() => router.back()}
          className="absolute top-12 left-4 bg-black/60 rounded-full p-3"
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={requestPermission}>
          <Text>Grant Camera Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (isSelfService && !currentStaff) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-xl font-semibold mb-3">
          Staff profile not linked
        </Text>
        <Text className="text-center text-slate-500">
          Ask an administrator to link your user account to a staff record.
        </Text>
      </View>
    );
  }

  const handleCheckin = async () => {
    if (!cameraRef.current || loading) return;

    try {
      setLoading(true);
      setProgressStage("Capturing face image…");
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo.base64) {
        Alert.alert("Face attendance failed", "Could not capture image.");
        return;
      }

      setProgressStage("Matching face to staff records…");
      const result = await searchFace(photo.base64, "staff");
      const staffId = result.subjectId ?? result.staffId;

      if (!result.matched || !staffId) {
        Alert.alert("Face attendance failed", "Face not recognized.");
        return;
      }

      if (isSelfService && staffId !== currentStaff?.id) {
        Alert.alert(
          "Face attendance failed",
          "The recognized face does not match your staff profile."
        );
        return;
      }

      setProgressStage("Checking staff profile and movement-book requirements…");
      const staffSnap = await getDoc(doc(db, "staff", staffId));
      if (!staffSnap.exists()) {
        Alert.alert("Face attendance failed", "The recognized face is not registered as staff.");
        return;
      }

      const movementReason = await getMovementReasonFor(attendanceMode);

      setProgressStage(`Recording staff check-${attendanceMode === "in" ? "in" : "out"}…`);
      if (isSelfService) {
        await handleStaffBiometricCheck({
          staffId,
          mode: attendanceMode,
          biometricVerified: true,
          method: "face",
          movementReason,
        });
      } else {
        await registerStaffAttendance({
          staffId,
          mode: attendanceMode,
          method: "face",
          biometric: true,
          movementReason,
          selfOnly: false,
        });
      }

      const similarity =
        typeof result.similarity === "number"
          ? ` (${result.similarity.toFixed(2)}% match)`
          : "";

      Alert.alert(
        "Attendance recorded",
        `Attendance recorded successfully using facial recognition${similarity}.`
      );
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Face attendance failed",
        error instanceof Error ? error.message : "Face attendance could not be completed."
      );
    } finally {
      setLoading(false);
      setProgressStage("");
    }
  };

  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />

      <View className="absolute top-24 left-4 right-4 rounded-2xl bg-slate-950/75 p-4">
        <Text className="text-center font-semibold text-white">Position your face in the frame</Text>
        <Text className="mt-1 text-center text-xs text-slate-200">Look directly at the camera and keep still. Then press “Capture face.”</Text>
      </View>

      <Pressable
        onPress={() => router.back()}
        disabled={loading}
        className="absolute top-12 left-4 bg-black/60 rounded-full p-3"
        hitSlop={8}
      >
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      {loading ? (
        <View className="absolute top-24 left-4 right-4 rounded-2xl border border-white/20 bg-slate-950/85 p-4" accessibilityLiveRegion="polite" accessibilityRole="progressbar">
          <View className="flex-row items-center">
            <ActivityIndicator color="#fff" />
            <Text className="ml-3 flex-1 font-semibold text-white">{progressStage || "Processing face attendance…"}</Text>
          </View>
          <Text className="mt-2 text-xs text-slate-200">Keep the app open. Attendance is confirmed only after the success alert.</Text>
        </View>
      ) : null}

      <View className="absolute bottom-10 w-full items-center">
        <Pressable onPress={handleCheckin} disabled={loading} className="bg-green-600 px-6 py-3 rounded-full">
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white">
              Capture face
            </Text>
          )}
        </Pressable>
      </View>
      {movementReasonPrompt}
    </View>
  );
}
