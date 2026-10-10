// mobile/app/students/face-checkin.tsx

import React, { useRef, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { searchFace } from "../../src/services/faceService";
import { registerAttendanceUnified } from "../../src/services/attendance";
import { getAttendanceSettings } from "../../src/services/attendanceSettings";
import { getMovementReasonRequirement } from "../../src/services/movementPolicy";
import { useRequireAttendanceAccess } from "../../src/hooks/useRouteAuthorization";
import { MaterialIcons } from "@expo/vector-icons";
import { useMovementReasonPrompt } from "../../components/MovementReasonPrompt";

export default function StudentFaceCheckin({ classId }: { classId: string }) {
  const router = useRouter();
  const {
    loading: authorizationLoading,
    ready: authorizationReady,
  } = useRequireAttendanceAccess("student");
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const { promptMovementReason, movementReasonPrompt } = useMovementReasonPrompt();

  async function getLateReasonIfNeeded() {
    const settings = await getAttendanceSettings();
    const requirement = getMovementReasonRequirement({ settings, mode: "in" });
    if (!requirement) return undefined;
    const reason = await promptMovementReason(requirement);
    if (!reason) throw new Error("A movement book entry is required to complete this attendance action.");
    return reason;
  }

  if (authorizationLoading || !authorizationReady) {
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

  const handleFaceCheckin = async () => {
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

      // Verify student face
      setProgressStage("Matching face to student records…");
      const result = await searchFace(photo.base64, "student");

      if (!result.matched || !result.subjectId) {
        Alert.alert("Face attendance failed", "Face not recognized.");
        return;
      }

      setProgressStage("Checking movement-book requirements…");
      const movementReason = await getLateReasonIfNeeded();

      // Register attendance immediately
      setProgressStage("Recording student check-in…");
      await registerAttendanceUnified({
        studentId: result.subjectId,
        classId,
        mode: "in",
        method: "face",
        biometric: true,
        movementReason,
      });

      Alert.alert("Attendance recorded", `Attendance recorded successfully using facial recognition (${result.similarity.toFixed(2)}% match).`);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Face attendance failed", err?.message || "Face attendance could not be completed.");
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
        <Pressable
          onPress={handleFaceCheckin}
          disabled={loading}
          className="bg-green-600 px-6 py-3 rounded-full"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Capture face</Text>}
        </Pressable>
      </View>
      {movementReasonPrompt}
    </View>
  );
}
