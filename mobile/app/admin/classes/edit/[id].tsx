import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getClassById,
  upsertClass,
  ClassRecord,
} from "../../../../src/services/classes";
import { listStaff } from "../../../../src/services/staff";
import type { Staff } from "../../../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../../../src/hooks/useRouteAuthorization";

export default function ClassEdit() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [original, setOriginal] = useState<ClassRecord | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedStaffUids, setAssignedStaffUids] = useState<string[]>([]);
  const [staffOptions, setStaffOptions] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔹 Load class
  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const cls = await getClassById(id);
        if (!cls) {
          Alert.alert("Not found", "Class does not exist");
          router.back();
          return;
        }

        setOriginal(cls);
        setName(cls.name);
        setDescription(cls.description ?? "");
        setAssignedStaffUids(cls.assignedStaffUids ?? []);
      } catch (err: any) {
        console.error("getClassById", err);
        Alert.alert("Failed to load", err?.message ?? String(err));
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const staff = await listStaff();
        if (mounted) setStaffOptions(staff.filter((s) => Boolean(s.userUid)));
      } catch (error) {
        console.warn("Failed to load staff options", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  function toggleAssignedStaff(uid?: string) {
    if (!uid) return;
    setAssignedStaffUids((current) =>
      current.includes(uid)
        ? current.filter((item) => item !== uid)
        : [...current, uid]
    );
  }

  // 🔹 Save updates
  async function handleSave() {
    if (!original) return;

    if (!name.trim()) {
      Alert.alert("Validation", "Name is required");
      return;
    }

    setSaving(true);
    try {
      await upsertClass({
        ...original,
        name: name.trim(),
        description: description.trim() || undefined,
        assignedStaffUids,
      });

      Alert.alert("Updated");
      router.back();
    } catch (err: any) {
      console.error("upsertClass", err);
      Alert.alert("Update failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 p-4">
     <View className="flex-row items-center mb-2">
  <Pressable
    onPress={() => router.back()}
    className="p-1 mr-2"
    hitSlop={8}
  >
    <MaterialIcons
      name="arrow-back"
      size={26}
      color="#0f172a"
    />
  </Pressable>

  <Text className="text-2xl font-extrabold text-slate-900">
    Edit Class
  </Text>
</View>

      <Text className="text-sm text-neutral">Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        className="border p-3 rounded mb-3 bg-white"
      />

      <Text className="text-sm text-neutral">Description (optional)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        className="border p-3 rounded mb-4 bg-white"
      />

      <Text className="text-sm text-neutral mb-1">Staff assigned to take attendance</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {staffOptions.length === 0 ? (
          <Text className="text-neutral">No linked staff profiles found.</Text>
        ) : (
          staffOptions.map((staff) => {
            const selected = Boolean(
              staff.userUid && assignedStaffUids.includes(staff.userUid)
            );
            return (
              <Pressable
                key={staff.id ?? staff.userUid}
                onPress={() => toggleAssignedStaff(staff.userUid)}
                className={`px-3 py-2 rounded-xl border ${
                  selected
                    ? "bg-primary border-primary"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text className={selected ? "text-white" : "text-dark"}>
                  {staff.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <Pressable
        onPress={handleSave}
        className="bg-primary py-3 rounded"
        disabled={saving}
      >
        <Text className="text-white text-center">
          {saving ? "Saving…" : "Update class"}
        </Text>
      </Pressable>
    </View>
  );
}
