// mobile/app/staff/index.tsx
import React, { useState } from "react";
import { View, Text, FlatList, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { listStaff, deleteStaff } from "../../src/services/staff";
import type { Staff } from "../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";

export default function StaffList() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
const [search, setSearch] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        if (!active) return;
        await loadStaff();
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  async function loadStaff() {
    setLoading(true);
    try {
      const data = await listStaff();
      setStaffList(data);
    } catch (err: any) {
      console.error("listStaff error:", err);
      Alert.alert("Failed to load staff", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name?: string) {
    Alert.alert(
      "⚠️ Confirm Delete",
      `Are you sure you want to delete "${name ?? "this staff"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "DELETE",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            try {
              await deleteStaff(id);
              setStaffList((cur) => cur.filter((s) => s.id !== id));
            } catch (err: any) {
              console.error("deleteStaff error", err);
              Alert.alert("Delete failed", err?.message ?? String(err));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
const filteredStaff = staffList.filter((s) => {
  const q = search.toLowerCase();

  return (
    s.name?.toLowerCase().includes(q) ||
    s.staffId?.toLowerCase().includes(q) ||
    s.email?.toLowerCase().includes(q)
  );
});
  return (
    <View className="flex-1 bg-slate-300 p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">
  Staff ({search ? `${filteredStaff.length} of ${staffList.length}` : staffList.length})
</Text>
        </View>

        <Pressable
          onPress={() => router.push("/staff/create")}
          className="bg-primary py-2 px-3 rounded-xl"
        >
          <Text className="text-white font-medium">Add</Text>
        </Pressable>
      </View>
<AppInput
  value={search}
  onChangeText={setSearch}
  placeholder="Search staff..."
  className="border p-3 rounded-xl mb-3 bg-white"
/>
      {/* Staff List */}
      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => item.id!}
        renderItem={({ item }) => {
          // Biometric status
         const face = !!item.faceId;
          const fingerprint = !!item.fingerprintId;

          // Card color based on enrollment
          let cardColor = "#fee2e2"; // red
          let borderColor = "#ef4444";

          if (face && fingerprint) {
            cardColor = "#dcfce7"; // green
            borderColor = "#16a34a";
          } else if (face || fingerprint) {
            cardColor = "#fef9c3"; // yellow
            borderColor = "#ca8a04";
          }

          return (
            <View
              className="rounded-2xl p-4 mb-3 flex-row items-center justify-between"
              style={{
                backgroundColor: cardColor,
                borderWidth: 1,
                borderColor: borderColor,
              }}
            >
              {/* Staff Info */}
              <View>
                <Text className="font-semibold text-dark text-base">🧑 {item.name}</Text>
                <Text className="text-sm text-neutral">ID: {item.staffId}</Text>

                {/* Biometric Status */}
                <View className="flex-row mt-2 space-x-4">
                  {/* Face */}
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="face"
                      size={18}
                      color={face ? "#16A34A" : "#9CA3AF"}
                    />
                    <Text className="ml-1 text-xs">Face</Text>
                  </View>

                  {/* Fingerprint */}
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="fingerprint"
                      size={18}
                      color={fingerprint ? "#2563EB" : "#9CA3AF"}
                    />
                    <Text className="ml-1 text-xs">Fingerprint</Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View className="flex-row items-center space-x-2">
                {/* Edit */}
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/staff/[id]",
                      params: { id: item.id! },
                    })
                  }
                  className="p-2"
                >
                  <MaterialIcons name="edit" size={20} color="#1E3A8A" />
                </Pressable>

                {/* Delete */}
                <Pressable
                  onPress={() => handleDelete(item.id!, item.name)}
                  className="p-2"
                >
                  <MaterialIcons name="delete" size={20} color="#EF4444" />
                </Pressable>

                {/* Face Enroll / Update */}
                <Pressable
                  onPress={() =>
                    router.push(`/staff/register-face?staffId=${item.id}`)
                  }
                  className="p-2"
                >
                  <MaterialIcons
                    name="face-retouching-natural"
                    size={20}
                  color={face ? "#16A34A" : "#9333EA"}
                  />
                </Pressable>

                {/* Fingerprint Register / Update */}
<Pressable
  onPress={() =>
    router.push(`/staff/enroll-biometric?id=${item.id}`)
  }
  className="p-2"
>
  <MaterialIcons
    name="fingerprint"
    size={20}
    color={fingerprint ? "#16A34A" : "#2563EB"}
  />
</Pressable>
    </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text className="text-center text-neutral mt-8">No staff found.</Text>
        }
      />
    </View>
  );
}