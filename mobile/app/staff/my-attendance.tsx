import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useCurrentStaff } from "../../src/hooks/useCurrentStaff";
import { handleStaffBiometricCheck } from "../../src/services/staffBiometricHandler";

export default function MyStaffAttendance() {
  const router = useRouter();
  const { staff, loading } = useCurrentStaff();
  const [saving, setSaving] = useState(false);

  function openQrAttendance(mode: "in" | "out") {
    router.push({
      pathname: "/attendance/qr",
      params: {
        actor: "staff",
        mode,
        self: "1",
      },
    } as any);
  }

  async function handleDeviceBiometric(mode: "in" | "out") {
    if (!staff?.id) {
      Alert.alert("Staff profile missing", "Your account is not linked to a staff record.");
      return;
    }

    if (!staff.fingerprintId) {
      Alert.alert(
        "Biometric not enabled",
        "Please contact an administrator to enable device biometric attendance."
      );
      return;
    }

    setSaving(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !enrolled) {
        Alert.alert("Biometric unavailable", "No biometrics are enrolled on this device.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate ${staff.name}`,
      });

      if (!result.success) return;

      await handleStaffBiometricCheck({
        staffId: staff.id,
        mode,
        biometricVerified: true,
        method: "fingerprint",
      });

      Alert.alert(
        mode === "in" ? "Checked In" : "Checked Out",
        `${staff.name} ${mode === "in" ? "checked in" : "checked out"} successfully.`
      );
    } catch (error) {
      Alert.alert(
        "Attendance error",
        error instanceof Error ? error.message : "Could not record attendance."
      );
    } finally {
      setSaving(false);
    }
  }

  function openFaceAttendance(mode: "in" | "out") {
    router.push({
      pathname: "/staff/face-checkin",
      params: {
        mode,
        self: "1",
      },
    } as any);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  if (!staff) {
    return (
      <View className="flex-1 bg-slate-50 p-4">
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">My Attendance</Text>
        </View>

        <View className="flex-1 items-center justify-center px-2">
          <MaterialIcons name="badge" size={48} color="#64748B" />
          <Text className="text-lg font-semibold text-slate-800 mt-4">
            Staff profile not linked
          </Text>
          <Text className="text-center text-slate-500 mt-2">
            Ask an administrator to link your user account to a staff record.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-300" contentContainerStyle={{ padding: 16 }}>
      <View className="flex-row items-center mb-4">
        <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
          <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-slate-900">My Attendance</Text>
      </View>

      <View className="bg-white rounded-2xl p-5 shadow mb-4">
        <Text className="text-lg font-bold text-slate-900">{staff.name}</Text>
        <Text className="text-slate-500 mt-1">Staff ID: {staff.staffId ?? staff.id}</Text>
      </View>

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <View className="flex-row items-center mb-3">
          <MaterialCommunityIcons name="qrcode-scan" size={26} color="#1D4ED8" />
          <View className="ml-3 flex-1">
            <Text className="font-bold text-slate-900">QR Attendance</Text>
            <Text className="text-slate-500 text-sm">
              Scan the QR code linked to your staff profile.
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => openQrAttendance("in")}
            className="flex-1 bg-blue-600 rounded-xl py-3"
          >
            <Text className="text-white font-semibold text-center">Check-In</Text>
          </Pressable>
          <Pressable
            onPress={() => openQrAttendance("out")}
            className="flex-1 bg-amber-600 rounded-xl py-3"
          >
            <Text className="text-white font-semibold text-center">Check-Out</Text>
          </Pressable>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <View className="flex-row items-center mb-3">
          <MaterialCommunityIcons name="face-recognition" size={28} color="#047857" />
          <View className="ml-3 flex-1">
            <Text className="font-bold text-slate-900">Face Recognition</Text>
            <Text className="text-slate-500 text-sm">
              Verify your face with the front camera.
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => openFaceAttendance("in")}
            className="flex-1 bg-emerald-600 rounded-xl py-3"
          >
            <Text className="text-white font-semibold text-center">Check-In</Text>
          </Pressable>
          <Pressable
            onPress={() => openFaceAttendance("out")}
            className="flex-1 bg-amber-600 rounded-xl py-3"
          >
            <Text className="text-white font-semibold text-center">Check-Out</Text>
          </Pressable>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <View className="flex-row items-center mb-3">
          <MaterialCommunityIcons name="fingerprint" size={28} color="#4F46E5" />
          <View className="ml-3 flex-1">
            <Text className="font-bold text-slate-900">Device Biometric</Text>
            <Text className="text-slate-500 text-sm">
              Use fingerprint or device face unlock.
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => handleDeviceBiometric("in")}
            disabled={saving}
            className="flex-1 bg-indigo-600 rounded-xl py-3"
            style={saving ? { opacity: 0.7 } : undefined}
          >
            <Text className="text-white font-semibold text-center">Check-In</Text>
          </Pressable>
          <Pressable
            onPress={() => handleDeviceBiometric("out")}
            disabled={saving}
            className="flex-1 bg-amber-600 rounded-xl py-3"
            style={saving ? { opacity: 0.7 } : undefined}
          >
            <Text className="text-white font-semibold text-center">Check-Out</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => router.push("/staff/my-report" as any)}
        className="bg-white rounded-2xl p-5 shadow flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <MaterialIcons name="insights" size={26} color="#1E3A8A" />
          <Text className="font-semibold text-slate-900 ml-3">My Attendance Report</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color="#64748B" />
      </Pressable>

      {saving ? (
        <View className="mt-6 items-center">
          <ActivityIndicator />
        </View>
      ) : null}
    </ScrollView>
  );
}
