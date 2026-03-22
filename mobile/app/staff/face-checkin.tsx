//mobile/app/staff/face-checkin.tsx
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { searchFace } from "../../src/services/faceService";

export default function FaceCheckin() {
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

  const handleCheckin = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);

      // 📸 Capture new photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });

      if (!photo.base64) {
        Alert.alert("Error", "Could not capture image");
        return;
      }

      // 🔍 Send to Firebase → Rekognition
      const result = await searchFace(photo.base64);

      if (!result.matched) {
        Alert.alert("Access Denied", "Face not recognized");
        return;
      }

      Alert.alert(
        "Success",
        `Matched (${result.similarity.toFixed(2)}%)`
      );

      // ✅ Attendance already marked server-side
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Face verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="front"
      />

      <View className="absolute bottom-10 w-full items-center">
        <Pressable
          onPress={handleCheckin}
          className="bg-green-600 px-6 py-3 rounded-full"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white">Face Check-in</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}