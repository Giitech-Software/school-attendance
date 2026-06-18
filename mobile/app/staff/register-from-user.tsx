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
import {
  createStaffFromUser,
  STAFF_ROLE_OPTIONS,
  type StaffRoleType,
} from "../../src/services/staff";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";

type StaffIdMode = "auto" | "manual";

export default function RegisterStaffFromUser() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();

  const [user, setUser] = useState<AppUser | null>(null);
  const [staffId, setStaffId] = useState("");
  const [roleType, setRoleType] = useState<StaffRoleType>("teacher");
  const [staffIdMode, setStaffIdMode] = useState<StaffIdMode>("auto");
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
        setRoleType(
          STAFF_ROLE_OPTIONS.some((option) => option.value === u.role)
            ? (u.role as StaffRoleType)
            : "teacher"
        );
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

    if (staffIdMode === "manual" && !staffId.trim()) {
      Alert.alert("Validation", "Enter a Staff ID or choose auto-generate.");
      return;
    }

    setSaving(true);
    try {
      const requestedStaffId =
        staffIdMode === "manual" ? staffId.trim() : undefined;

      // Create staff only if not already registered
      const assignedStaffId = await createStaffFromUser(
        user.id,
        user.displayName ?? "Unnamed Staff",
        user.email ?? "",
        roleType,
        requestedStaffId
      );

      // Link staff profile and approve the user. Keep admins as admins while
      // storing their staff role on the staff profile.
      await upsertUser({
        id: user.id,
        approved: true,
        ...(user.role === "admin" ? {} : { role: roleType }),
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
  if (adminLoading || !adminReady || loading) {
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
            Link Staff Profile
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
        <View className="flex-row flex-wrap gap-3 mb-4">
          {STAFF_ROLE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setRoleType(option.value)}
              className={`px-4 py-2 rounded-xl ${
                roleType === option.value ? "bg-primary" : "bg-white border"
              }`}
            >
              <Text
                className={`${
                  roleType === option.value ? "text-white" : "text-dark"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Staff ID */}
        <Text className="text-sm text-neutral mb-1">Staff ID</Text>
        <View className="flex-row gap-3 mb-3">
          <Pressable
            onPress={() => setStaffIdMode("auto")}
            className={`flex-1 px-4 py-3 rounded-xl ${
              staffIdMode === "auto" ? "bg-primary" : "bg-white border"
            }`}
          >
            <Text
              className={`text-center ${
                staffIdMode === "auto" ? "text-white" : "text-dark"
              }`}
            >
              Auto-create
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStaffIdMode("manual")}
            className={`flex-1 px-4 py-3 rounded-xl ${
              staffIdMode === "manual" ? "bg-primary" : "bg-white border"
            }`}
          >
            <Text
              className={`text-center ${
                staffIdMode === "manual" ? "text-white" : "text-dark"
              }`}
            >
              Add staff ID
            </Text>
          </Pressable>
        </View>

        {staffIdMode === "manual" ? (
          <AppInput
            value={staffId}
            onChangeText={setStaffId}
            placeholder={
              roleType === "teacher" ? "e.g. TCH-0001" : "e.g. NST-0001"
            }
            autoCapitalize="characters"
            className="border p-3 rounded-xl mb-4 bg-white"
          />
        ) : (
          <View className="bg-white rounded-xl p-3 mb-4 border border-slate-200">
            <Text className="text-dark">
              Leave empty. A Staff ID will be created automatically.
            </Text>
          </View>
        )}

        {/* Submit */}
        <Pressable
          onPress={handleRegister}
          disabled={saving}
          className="bg-primary py-3 rounded-xl"
          style={saving ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center">
            {saving ? "Linking..." : "Link Staff Profile"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScreen>
  );
}
