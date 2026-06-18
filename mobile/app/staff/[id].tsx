// mobile/app/staff/[id].tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import { getStaffById, upsertStaff } from "../../src/services/staff";
import type { Staff } from "../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";

export default function StaffDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const s = await getStaffById(id as string);
        setStaff(s);
      } catch (err: any) {
        console.error(err);
        Alert.alert("Failed to load staff", err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSave() {
    if (!staff) return;
    setSaving(true);
    try {
      await upsertStaff(staff);
      Alert.alert("Saved");
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!staff) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-4">
        <Text className="text-neutral">Staff not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-300 p-4">
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">Edit Staff</Text>
        </View>

        <Text className="text-sm text-neutral">Full name</Text>
        <TextInput
          value={staff.name}
          onChangeText={(t) => setStaff({ ...staff, name: t })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Staff ID</Text>
        <TextInput
          value={staff.staffId ?? ""}
          onChangeText={(t) => setStaff({ ...staff, staffId: t || undefined })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Email</Text>
        <TextInput
          value={staff.email ?? ""}
          onChangeText={(t) => setStaff({ ...staff, email: t })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Role</Text>
        <TextInput
          value={staff.role ?? ""}
          onChangeText={(t) => setStaff({ ...staff, role: t })}
          className="border p-3 rounded-xl mb-4 bg-white"
        />

        <Pressable
          onPress={handleSave}
          className="bg-primary py-3 rounded-xl"
          disabled={saving}
        >
          <Text className="text-white text-center">{saving ? "Saving…" : "Save"}</Text>
        </Pressable>

        {!staff.fingerprintId && (
  <>
    {/* Fingerprint */}
    <Pressable
      onPress={() => router.push(`/staff/enroll-biometric?id=${staff.id}`)}
      className="bg-blue-500 py-3 px-4 rounded-xl mt-4"
    >
      <Text className="text-white text-center font-medium">
        Enroll Biometric
      </Text>
    </Pressable>

    {/* Face */}
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/staff/register-face",
          params: { staffId: staff.id },
        })
      }
      className="bg-green-600 py-3 px-4 rounded-xl mt-4"
    >
      <Text className="text-white text-center font-medium">
        Register Face
      </Text>
    </Pressable>
  </>
)}
      </View>
    </KeyboardAwareScreen>
  );
}
