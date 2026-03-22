// mobile/app/terms/create.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { createTerm } from "../../src/services/terms";
import type { Term } from "../../src/services/types";
import { autoGenerateWeeksForTerm } from "../../src/services/weeks";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";

export default function TermCreate() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  function isWeekend(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

  async function handleSave() {
  if (!name.trim() || !startDate || !endDate) {
  Alert.alert("Validation", "Name, start date and end date are required.");
  return;
}

// ⚠️ ADD HERE
if (isWeekend(startDate) || isWeekend(endDate)) {
  Alert.alert(
    "Weekend dates",
    "The term start or end date falls on a weekend. Weeks will still be generated from Monday to Friday.",
    [{ text: "Continue" }]
  );
}

setSaving(true);


  setSaving(true);
  try {
    // 1️⃣ create term and get its ID
    const termRef = await createTerm({
      name: name.trim(),
      startDate,
      endDate,
    } as Term);

    // 2️⃣ auto-generate weeks from term dates
    await autoGenerateWeeksForTerm(
      termRef.id,
      startDate,
      endDate
    );

    Alert.alert("Term created");
    router.back();
  } catch (err: any) {
    console.error("createTerm", err);
    Alert.alert("Create failed", err?.message ?? String(err));
  } finally {
    setSaving(false);
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
   New Term
  </Text>
</View>

     <Text className="text-sm text-neutral">Name</Text>
<AppInput
  value={name}
  onChangeText={setName}
  className="border p-3 rounded mb-3 bg-white"
  placeholder="e.g. Term 2"
/>

<Text className="text-sm text-neutral">Start date (YYYY-MM-DD)</Text>
<AppInput
  value={startDate}
  onChangeText={setStartDate}
  className="border p-3 rounded mb-3 bg-white"
  placeholder="2025-01-10"
  keyboardType="numeric"
/>

<Text className="text-sm text-neutral">End date (YYYY-MM-DD)</Text>
<AppInput
  value={endDate}
  onChangeText={setEndDate}
  className="border p-3 rounded mb-4 bg-white"
  placeholder="2025-04-10"
  keyboardType="numeric"
/>


      <Pressable
        onPress={handleSave}
        disabled={saving}
        className={`py-3 rounded ${saving ? "bg-slate-400" : "bg-primary"}`}
      >
        <Text className="text-white text-center text-xl font-semibold">
          {saving ? "Saving…" : "Create term"}
        </Text>
      </Pressable>
    </View>
  );
}
