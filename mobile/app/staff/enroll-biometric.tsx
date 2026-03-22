// mobile/app/staff/enroll-biometric.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

import * as LocalAuthentication from "expo-local-authentication";

import { getStaffById, upsertStaff } from "../../src/services/staff";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";

export default function EnrollBiometric() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>(); 

  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const s = await getStaffById(id);
        if (!s) {
          Alert.alert("Staff not found");
          router.back();
          return;
        }
        setStaff(s);
      } catch (err: any) {
        console.error("getStaffById error", err);
        Alert.alert("Failed to load staff", err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleEnroll = async () => {
  if (!staff) return;

 // 🔐 Enterprise rule: face must exist first
if (!staff?.faceId || staff.faceId.trim() === "") {
  Alert.alert(
    "Face Required",
    "You must register a face before enrolling fingerprint."
  );

  router.push(`/staff/register-face?staffId=${staff.id}`);
  return;
}

    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      Alert.alert("Device not compatible with biometric authentication");
      return;
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      Alert.alert("No biometric data found on this device. Please set it up in device settings.");
      return;
    }

    setEnrolling(true);
    try {
    const result = await LocalAuthentication.authenticateAsync({
  promptMessage: `Enroll ${staff.name}`,
  disableDeviceFallback: true,
});  

      if (result.success) {
        // Generate a pseudo biometricId for simplicity
        const biometricId = `BIO-${Date.now()}`;

       await upsertStaff({
  ...staff,
  fingerprintId: biometricId,
  biometricEnabled: true,
  fingerprintEnrolledAt: new Date().toISOString(),
  fingerprintEnrolledBy: "admin",
});
        Alert.alert("Enrollment successful ✅");
        router.back();
      } else {
        Alert.alert("Enrollment failed ❌", "Biometric authentication was not completed");
      }
    } catch (err: any) {
      console.error("enroll error", err);
      Alert.alert("Enrollment error", err?.message ?? String(err));
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!staff) return null;

  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-300 p-4">
        <Text className="text-2xl font-bold mb-4">{staff.name}</Text>
        <Text className="mb-6">Staff ID: {staff.staffId}</Text>

        {staff.fingerprintId ? (
          <Text className="text-green-700 font-semibold mb-4">
            Already enrolled ✅
          </Text>
        ) : (
          <Pressable
            onPress={handleEnroll}
            disabled={enrolling}
            className="bg-primary py-3 rounded-xl"
            style={enrolling ? { opacity: 0.7 } : undefined}
          >
            <Text className="text-white text-center">
              {enrolling ? "Enrolling…" : "Enroll Biometric"}
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAwareScreen>
  );
}
