// mobile/app/students/index.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, FlatList, Alert } from "react-native";
import { Link, useRouter, useFocusEffect } from "expo-router";
import { listStudents, deleteStudent } from "../../src/services/students";
import type { Student } from "../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";

export default function StudentsList() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
const [search, setSearch] = useState("");

 useFocusEffect(
  React.useCallback(() => {
    let active = true;

    (async () => {
      if (!active) return;
      await load();
    })();

    return () => {
      active = false;
    };
  }, [])
);

  async function load() {
    setLoading(true);
    try {
      const s = await listStudents();
      setStudents(s);
    } catch (err: any) {
      console.error("listStudents error", err);
      Alert.alert("Failed to load students", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

 async function handleDelete(id: string, name?: string) {
  Alert.alert(
    "⚠️ Confirm Delete",
    `Are you SURE you want to DELETE student "${name ?? 'this student'}"?\n\nThis action CANNOT be undone!`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "DELETE",
        style: "destructive",
        onPress: async () => {
          setDeletingId(id);
          try {
            await deleteStudent(id);
            setStudents((cur) => cur.filter((c) => c.id !== id));
          } catch (err: any) {
            console.error("deleteStudent error", err);
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
const filteredStudents = students.filter((s) => {
  const q = search.toLowerCase();

  return (
    s.name?.toLowerCase().includes(q) ||
    s.studentId?.toLowerCase().includes(q) ||
    s.classId?.toLowerCase().includes(q)
  );
});
  return (
    <View className="flex-1 bg-slate-300 p-4">
      <View className="flex-row items-center justify-between mb-4">
 
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
  Students ({search ? `${filteredStudents.length} of ${students.length}` : students.length})
</Text>
</View>

  <Pressable
    onPress={() => router.push("/students/create")}
    className="bg-primary py-2 px-3 rounded"
  >
    <Text className="text-white">Add</Text>
  </Pressable>
</View>
<AppInput
  value={search}
  onChangeText={setSearch}
  placeholder="Search students..."
  className="border p-3 rounded-xl mb-3 bg-white"
/>
      <FlatList
        data={filteredStudents}
        keyExtractor={(i) => i.id!}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between">
            <View>
              <Text className="font-semibold text-dark">{item.name}</Text>
              <Text className="text-sm text-neutral mt-1">{item.classId ?? "—"}</Text>
              <Text className="text-xs mt-1">
                {item.fingerprintId ? "Biometric enrolled ✅" : "Biometric not enrolled ❌"}
              </Text>
            </View>

            <View className="flex-row items-center space-x-2">
              {/* EDIT BUTTON */}
              <Link href={`/students/${item.id}`} asChild>
                <Pressable className="p-2 rounded bg-white/20">
                  <MaterialIcons name="edit" size={20} color="#1E3A8A" />
                </Pressable>
              </Link>

              {/* DELETE BUTTON */}
              <Pressable
  onPress={() => handleDelete(item.id!, item.name)}
  className="p-2 rounded bg-white/20"
>
  <MaterialIcons name="delete" size={20} color="#EF4444" />
</Pressable>


              {/* ENROLL BIOMETRIC BUTTON */}
              {!item.fingerprintId && (
                <Pressable
                  onPress={() => router.push(`/students/enroll-biometric?id=${item.id}`)}
                  className="px-2 py-1 rounded bg-blue-500"
                >
                  <Text className="text-white text-xs">Enroll</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-center text-neutral mt-8">No students yet.</Text>
        }
      />
    </View>
  );
}
