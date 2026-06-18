// mobile/app/classes/create.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { createClass } from "../../../src/services/classes"; // ensure createClass exists 
import { listStaff } from "../../../src/services/staff";
import type { Staff } from "../../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";
import AppPicker from "@/components/AppPicker";
import { useRequireAdmin } from "../../../src/hooks/useRouteAuthorization";

export default function ClassCreate() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedStaffUids, setAssignedStaffUids] = useState<string[]>([]);
  const [staffOptions, setStaffOptions] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
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

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Validation", "Name is required");
      return;
    }
    setLoading(true);
    try {
      const trimmed = name.trim();
      const classId =
        trimmed
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9\-]/g, "")
          .substring(0, 30) || `class-${Date.now()}`;

      // include description when creating
      await createClass({
        name: trimmed,
        classId,
        assignedStaffUids,
        description: description.trim() || undefined,
      });
      Alert.alert("Created");
      router.back();
    } catch (err: any) {
      console.error("createClass", err);
      Alert.alert("Create failed", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  if (adminLoading || !adminReady) {
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
    New Class
  </Text>
</View>
      
      <Text className="text-sm text-neutral">Name</Text>
<AppInput
  value={name}
  onChangeText={setName}
  className="border p-3 rounded mb-3 bg-white"
  placeholder="e.g. Grade 1A"
/>

<Text className="text-sm text-neutral">Description (optional)</Text>
<AppInput
  value={description}
  onChangeText={setDescription}
  className="border p-3 rounded mb-4 bg-white"
  placeholder="Short description"
  multiline
/>

<Text className="text-sm text-neutral mb-1">Staff assigned to take attendance</Text>
<View className="flex-row flex-wrap gap-2 mb-4">
  {staffOptions.length === 0 ? (
    <Text className="text-neutral">No linked staff profiles found.</Text>
  ) : (
    staffOptions.map((staff) => {
      const selected = Boolean(staff.userUid && assignedStaffUids.includes(staff.userUid));
      return (
        <Pressable
          key={staff.id ?? staff.userUid}
          onPress={() => toggleAssignedStaff(staff.userUid)}
          className={`px-3 py-2 rounded-xl border ${
            selected ? "bg-primary border-primary" : "bg-white border-slate-200"
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

      <Pressable onPress={handleSave} className="bg-primary py-3 rounded" disabled={loading}>
        <Text className="text-white text-center">{loading ? "Saving…" : "Create class"}</Text>
      </Pressable>
    </View>
  ); 
}
