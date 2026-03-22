// mobile/app/students/face-checkin.tsx

import React, { useRef, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { searchFace } from "../../src/services/faceService";
import { registerAttendanceUnified } from "../../src/services/attendance";

export default function StudentFaceCheckin({ classId }: { classId: string }) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);

  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center">
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