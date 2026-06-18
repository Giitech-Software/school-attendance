// mobile/app/staff/create.tsx

import React, { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import {
  createStaff,
  STAFF_ROLE_OPTIONS,
  type StaffRoleType,
} from "../../src/services/staff";
import { getUserByEmail, upsertUser } from "../../src/services/users";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";

type StaffIdMode = "auto" | "manual";

export default function StaffCreate() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();

  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [roleType, setRoleType] = useState<StaffRoleType>("teacher");
  const [staffIdMode, setStaffIdMode] = useState<StaffIdMode>("auto");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Validation", "Name and Email are required");
      return;
    }

    if (staffIdMode === "manual" && !staffId.trim()) {
      Alert.alert("Validation", "Enter a Staff ID or choose auto-generate.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const linkedUser = await getUserByEmail(normalizedEmail);
      const requestedStaffId =
        staffIdMode === "manual" ? staffId.trim() : undefined;

      const staff = await createStaff({
        name: name.trim(),
        staffId: requestedStaffId,
        email: normalizedEmail,
        role: roleType,
        roleType,
        userUid: linkedUser?.id,
      });

      if (linkedUser?.id) {
        await upsertUser({
          id: linkedUser.id,
          approved: true,
          ...(linkedUser.role === "admin" ? {} : { role: roleType as any }),
        });
      }

      Alert.alert(
        "Staff created",
        linkedUser
          ? `This staff profile has been linked to the matching user account. Staff ID: ${staff.staffId}`
          : `No matching user account was found for this email, so the staff profile was created without an app login link. Staff ID: ${staff.staffId}`
      );
      router.back();
    } catch (err: any) {
      console.error("createStaff error:", err);
      Alert.alert("Create failed", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  if (adminLoading || !adminReady) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-300 p-4">

        {/* Header */}
        <View className="flex-row items-center mb-4">
          <Pressable
            onPress={() => router.back()}
            className="p-1 mr-2"
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>

          <Text className="text-2xl font-extrabold text-slate-900">
            New Staff
          </Text>
        </View>

        {/* Name */}
        <Text className="text-sm text-neutral">Full name</Text>
        <AppInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Doe"
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        {/* Email */}
        <Text className="text-sm text-neutral">Email</Text>
        <AppInput
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. john@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        {/* Role */}
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
          onPress={handleCreate}
          className="bg-primary py-3 rounded-xl"
          disabled={loading}
          style={loading ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center">
            {loading ? "Creating..." : "Create Staff"}
          </Text>
        </Pressable>

      </View>
    </KeyboardAwareScreen>
  );
}
