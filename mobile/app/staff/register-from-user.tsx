// app/staff/register-from-user.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import AppInput from "@/components/AppInput";
import { MaterialIcons } from "@expo/vector-icons";

import { getUserById, upsertUser, AppUser } from "../../src/services/users";
import { createStaffFromUser } from "../../src/services/staff";

export default function RegisterStaffFromUser() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const [user, setUser] = useState<AppUser | null>(null);
  const [staffId, setStaffId] = useState("");
  const [roleType, setRoleType] = useState<"teacher" | "non_teaching_staff">(
    "teacher"
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ---------------- Load user ---------------- */
  useEffect(() => {
    if (!uid) return;

    (async () => {
      setLoading(true);
      try {
        const u = await getUserById(uid);
        if (!u) {
          Alert.alert("User not found");
          router.back();
          return;
        }
        setUser(u);
        // Autofill roleType from user doc if exists
        setRoleType(u.role === "non_teaching_staff" ? "non_teaching_staff" : "teacher");
      } catch (err: any) {
        console.error("getUserById error", err);
        Alert.alert("Failed to load user", err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  /* ---------------- Register staff ---------------- */
  async function handleRegister() {
    if (!user) return;
    if (!user.id) {
      Alert.alert("User ID missing");
      return;
    }

    if (!staffId.trim()) {
      Alert.alert("Validation", "Staff ID is required");
      return;
    }

    setSaving(true);
    try {
      // Create staff only if not already registered
      const assignedStaffId = await createStaffFromUser(
        user.id,
        user.displayName ?? "Unnamed Staff",
        user.email ?? "",
        roleType
      );

      // Update user doc to enable staff attendance and approval
      await upsertUser({
        id: user.id,
        canTakeStaffAttendance: true,
        approved: true,
        role: roleType,
      });

      Alert.alert(
        "Success",
        `Staff registered successfully with Staff ID: ${assignedStaffId}`
      );
      router.replace("/staff");
    } catch (err: any) {
      console.error("register staff error", err);
      Alert.alert("Registration failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- UI ---------------- */
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return null;

  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-300 p-4">
        {/* Header */}
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="p-1 mr-2">
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">
            Register Staff
          </Text>
        </View>

        {/* Name (read-only) */}
        <Text className="text-sm text-neutral">Full Name</Text>
        <View className="bg-white rounded-xl p-3 mb-3">
          <Text className="text-dark">{user.displayName ?? "—"}</Text>
        </View>

        {/* Email (read-only) */}
        <Text className="text-sm text-neutral">Email</Text>
        <View className="bg-white rounded-xl p-3 mb-3">
          <Text className="text-dark">{user.email ?? "—"}</Text>
        </View>

        {/* Role Selector */}
        <Text className="text-sm text-neutral mb-1">Staff Role</Text>
        <View className="flex-row gap-3 mb-4">
          <Pressable
            onPress={() => setRoleType("teacher")}
            className={`px-4 py-2 rounded-xl ${
              roleType === "teacher" ? "bg-primary" : "bg-white border"
            }`}
          >
            <Text
              className={`${roleType === "teacher" ? "text-white" : "text-dark"}`}
            >
              Teacher
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setRoleType("non_teaching_staff")}
            className={`px-4 py-2 rounded-xl ${
              roleType === "non_teaching_staff" ? "bg-primary" : "bg-white border"
            }`}
          >
            <Text
              className={`${
                roleType === "non_teaching_staff" ? "text-white" : "text-dark"
              }`}
            >
              Non-Teaching
            </Text>
          </Pressable>
        </View>

        {/* Staff ID */}
        <Text className="text-sm text-neutral">Staff ID</Text>
        <AppInput
          value={staffId}
          onChangeText={setStaffId}
          placeholder="e.g. TCH-014"
          className="border p-3 rounded-xl mb-4 bg-white"
        />

        {/* Submit */}
        <Pressable
          onPress={handleRegister}
          disabled={saving}
          className="bg-primary py-3 rounded-xl"
          style={saving ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center">
            {saving ? "Registering…" : "Register Staff"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScreen>
  );
}
