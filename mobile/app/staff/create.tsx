// mobile/app/staff/create.tsx

import React, { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import { createStaff } from "../../src/services/staff";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";

export default function StaffCreate() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Validation", "Name and Email are required");
      return;
    }

    setLoading(true);

    try {
      await createStaff({
        name: name.trim(),
        staffId: staffId.trim() || undefined,
        email: email.trim(),
        role: role.trim() || undefined,
      });

      Alert.alert("Staff created");
      router.back();
    } catch (err: any) {
      console.error("createStaff error:", err);
      Alert.alert("Create failed", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
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

        {/* Staff ID */}
        <Text className="text-sm text-neutral">Staff ID</Text>
        <AppInput
          value={staffId}
          onChangeText={setStaffId}
          placeholder="e.g. ST-001"
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
        <Text className="text-sm text-neutral">Role</Text>
        <AppInput
          value={role}
          onChangeText={setRole}
          placeholder="e.g. Teacher"
          className="border p-3 rounded-xl mb-4 bg-white"
        />

        {/* Submit */}
        <Pressable
          onPress={handleCreate}
          className="bg-primary py-3 rounded-xl"
          disabled={loading}
          style={loading ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center">
            {loading ? "Creating…" : "Create Staff"}
          </Text>
        </Pressable>

      </View>
    </KeyboardAwareScreen>
  );
}