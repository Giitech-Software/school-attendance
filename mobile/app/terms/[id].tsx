// mobile/app/terms/[id].tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { listTerms, updateTerm, deleteTerm } from "../../src/services/terms";
import type { Term } from "../../src/services/types";
import { autoGenerateWeeksForTerm } from "../../src/services/weeks";
import { MaterialIcons } from "@expo/vector-icons";
export default function TermEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [term, setTerm] = useState<Term | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
const originalDatesRef = React.useRef({
  startDate: "",
  endDate: "",
});
function isWeekend(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

  useEffect(() => {
    (async () => {
      try {
        const terms = await listTerms();
        const found = terms.find((t: Term) => t.id === id);
        if (!found) {
          Alert.alert("Not found", "Term not found");
          router.back();
          return;
        }
       setTerm(found);
originalDatesRef.current = {
  startDate: found.startDate,
  endDate: found.endDate,
};

      } catch (e) {
        Alert.alert("Error", "Failed to load term");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleUpdate() {
  if (!term) return;

  if (!term.name.trim() || !term.startDate || !term.endDate) {
    Alert.alert("Validation", "All fields are required.");
    return;
  }
// ⚠️ Weekend warning (non-blocking)
if (isWeekend(term.startDate) || isWeekend(term.endDate)) {
  Alert.alert(
    "Weekend dates",
    "The term start or end date falls on a weekend. Weeks will still be generated from Monday to Friday.",
    [{ text: "Continue" }]
  );
}

  const datesChanged =
    term.startDate !== originalDatesRef.current.startDate ||
    term.endDate !== originalDatesRef.current.endDate;

  setSaving(true);
  try {
    await updateTerm(term.id!, {
      name: term.name.trim(),
      startDate: term.startDate,
      endDate: term.endDate,
    });

    if (datesChanged) {
      await autoGenerateWeeksForTerm(
        term.id!,
        term.startDate,
        term.endDate
      );
    }

    Alert.alert(
      "Updated",
      datesChanged
        ? "Term updated and weeks regenerated"
        : "Term updated successfully"
    );

    router.back();
  } catch (err: any) {
    Alert.alert("Update failed", err?.message ?? String(err));
  } finally {
    setSaving(false);
  }
}

  async function handleDelete() {
    Alert.alert("Delete term", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTerm(term!.id!);
            Alert.alert("Deleted");
            router.replace("/terms");
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message ?? String(err));
          }
        },
      },
    ]);
  }
async function handleGenerateWeeks() {
  if (isWeekend(term!.startDate) || isWeekend(term!.endDate)) {
  Alert.alert(
    "Note",
    "This term includes weekend dates. Generated weeks will still follow Monday–Friday."
  );
}

  Alert.alert(
    "Generate weeks",
    "This will automatically create all weeks for this term. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Generate",
        onPress: async () => {
          try {
            const count = await autoGenerateWeeksForTerm(
              term!.id!,
              term!.startDate,
              term!.endDate
            );
            Alert.alert("Success", `${count} weeks created`);
          } catch (err: any) {
            Alert.alert(
              "Failed",
              err?.message ?? "Weeks already exist for this term"
            );
          }
        },
      },
    ]
  );
}

  if (loading || !term) {
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
    Edit Term
  </Text>
</View>
    
      <Text className="text-sm text-neutral">Name</Text>
      <TextInput
        value={term.name}
        onChangeText={(v) => setTerm({ ...term, name: v })}
        className="border p-3 rounded mb-3 bg-white"
      />

      <Text className="text-sm text-neutral">Start date (YYYY-MM-DD)</Text>
      <TextInput
        value={term.startDate}
        onChangeText={(v) => setTerm({ ...term, startDate: v })}
        className="border p-3 rounded mb-3 bg-white"
      />

      <Text className="text-sm text-neutral">End date (YYYY-MM-DD)</Text>
      <TextInput
        value={term.endDate}
        onChangeText={(v) => setTerm({ ...term, endDate: v })}
        className="border p-3 rounded mb-4 bg-white"
      />

      <Pressable
        onPress={handleUpdate}
        disabled={saving}
        className={`py-3 rounded ${saving ? "bg-slate-400" : "bg-primary"}`}
      >
        <Text className="text-white text-center font-semibold">
          {saving ? "Saving…" : "Save changes"}
        </Text>
      </Pressable>
<Pressable
  onPress={handleGenerateWeeks}
  className="mt-4 py-3 rounded bg-indigo-600"
>
  <Text className="text-white text-center font-semibold">
    Auto-generate weeks
  </Text>
</Pressable>

      <Pressable
        onPress={handleDelete}
        className="mt-4 py-3 rounded bg-red-600"
      >
        <Text className="text-blue text-center font-semibold">
          Delete term
        </Text>
      </Pressable>
    </View>
  );
}
