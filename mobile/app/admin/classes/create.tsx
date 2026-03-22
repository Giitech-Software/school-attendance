// mobile/app/classes/create.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { createClass } from "../../../src/services/classes"; // ensure createClass exists 
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";
import AppPicker from "@/components/AppPicker";

export default function ClassCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

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
      await createClass({ name: trimmed, classId, description: description.trim() || undefined });
      Alert.alert("Created");
      router.back();
    } catch (err: any) {
      console.error("createClass", err);
      Alert.alert("Create failed", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
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

      <Pressable onPress={handleSave} className="bg-primary py-3 rounded" disabled={loading}>
        <Text className="text-white text-center">{loading ? "Saving…" : "Create class"}</Text>
      </Pressable>
    </View>
  ); 
}
