// app/staff/register-face.tsx

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
import { useLocalSearchParams, useRouter } from "expo-router";
import { indexFace } from "../../src/services/faceService";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import { MaterialIcons } from "@expo/vector-icons";

export default function RegisterFace() {
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);

  if (adminLoading || !adminReady) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
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

  const captureFace = async () => {
    if (!cameraRef.current || !staffId) return;

    try {
      setLoading(true);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        skipProcessing: true,
      });

      if (!photo.base64) {
        Alert.alert("Error", "Could not capture image");
        return;
      }

      const result = await indexFace(staffId, photo.base64);

      if (!result.success) {
      Alert.alert("Registration Failed", result.error || "Face may already be registered");
        return;
      }

      Alert.alert("Success", "Face registered successfully");

      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to register face"
      );
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

      <Pressable
        onPress={() => router.back()}
        className="absolute top-12 left-4 bg-black/60 rounded-full p-3"
        hitSlop={8}
      >
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      <View className="absolute bottom-10 w-full items-center">
        <Pressable
          onPress={captureFace}
          className="bg-blue-600 px-6 py-3 rounded-full"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white">Capture Face</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
