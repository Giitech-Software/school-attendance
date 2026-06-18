// mobile/app/students/face-checkin.tsx

import React, { useRef, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { searchFace } from "../../src/services/faceService";
import { registerAttendanceUnified } from "../../src/services/attendance";
import { useRequireAttendanceAccess } from "../../src/hooks/useRouteAuthorization";
import { MaterialIcons } from "@expo/vector-icons";

export default function StudentFaceCheckin({ classId }: { classId: string }) {
  const router = useRouter();
  const {
    loading: authorizationLoading,
    ready: authorizationReady,
  } = useRequireAttendanceAccess("student");
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);

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
    if (!cameraRef.current) return;

    try {
      setLoading(true);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });

      if (!photo.base64) {
        Alert.alert("Error", "Could not capture image");
        return;
      }

      // Verify student face
      const result = await searchFace(photo.base64, "student");

      if (!result.matched || !result.subjectId) {
        Alert.alert("Access Denied", "Face not recognized");
        return;
      }

      // Register attendance immediately
      await registerAttendanceUnified({
        studentId: result.subjectId,
        classId,
        mode: "in",
        method: "face",
        biometric: true,
      });

      Alert.alert("Check-in Successful", `Face matched (${result.similarity.toFixed(2)}%)`);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err?.message || "Face check-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
      <Pressable
        onPress={() => router.back()}
        className="absolute top-12 left-4 bg-black/60 rounded-full p-3"
        hitSlop={8}
      >
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </Pressable>
      <View className="absolute bottom-10 w-full items-center">
        <Pressable
          onPress={handleFaceCheckin}
          disabled={loading}
          className="bg-green-600 px-6 py-3 rounded-full"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Face Check-in</Text>}
        </Pressable>
      </View>
    </View>
  );
}
