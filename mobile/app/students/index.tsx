// mobile/app/students/index.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";
import { deleteStudent, listStudents } from "../../src/services/students";
import type { Student } from "../../src/services/types";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";

export default function StudentsList() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      (async () => {
        if (active) await load();
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      const data = await listStudents();
      setStudents(data);
    } catch (err: any) {
      console.error("listStudents error", err);
      Alert.alert("Failed to load students", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name?: string) {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete student "${name ?? "this student"}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            try {
              await deleteStudent(id);
              setStudents((current) => current.filter((student) => student.id !== id));
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

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  const filteredStudents = students.filter((student) => {
    const query = search.toLowerCase();

    return (
      student.name?.toLowerCase().includes(query) ||
      student.studentId?.toLowerCase().includes(query) ||
      student.rollNo?.toLowerCase().includes(query) ||
      student.classId?.toLowerCase().includes(query)
    );
  });

  return (
    <View className="flex-1 bg-slate-300 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center mb-2">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>

          <Text className="text-2xl font-extrabold text-slate-900">
            Students ({search ? `${filteredStudents.length} of ${students.length}` : students.length})
          </Text>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push("/students/bulk-import" as any)}
            className="bg-slate-700 py-2 px-3 rounded-xl"
          >
            <Text className="text-white font-medium">Import</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/students/create")}
            className="bg-primary py-2 px-3 rounded-xl"
          >
            <Text className="text-white font-medium">Add</Text>
          </Pressable>
        </View>
      </View>

      <AppInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search students..."
        className="border p-3 rounded-xl mb-3 bg-white"
      />

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id!}
        renderItem={({ item }) => {
          const isDeleting = deletingId === item.id;

          return (
            <View className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-semibold text-dark">{item.name}</Text>
                <Text className="text-sm text-neutral mt-1">
                  Class: {item.classId ?? "-"}
                </Text>
                <Text className="text-xs text-neutral mt-1">
                  ID: {item.studentId ?? "Auto"}
                  {item.rollNo ? ` | Roll ${item.rollNo}` : ""}
                </Text>
                <Text className="text-xs mt-1">
                  {item.fingerprintId
                    ? "Biometric enrolled"
                    : "Biometric not enrolled"}
                </Text>
              </View>

              <View className="flex-row items-center space-x-2">
                <Link href={`/students/${item.id}`} asChild>
                  <Pressable className="p-2 rounded bg-white/20">
                    <MaterialIcons name="edit" size={20} color="#1E3A8A" />
                  </Pressable>
                </Link>

                <Pressable
                  onPress={() => handleDelete(item.id!, item.name)}
                  disabled={isDeleting}
                  className="p-2 rounded bg-white/20"
                  style={isDeleting ? { opacity: 0.5 } : undefined}
                >
                  <MaterialIcons name="delete" size={20} color="#EF4444" />
                </Pressable>

                {!item.fingerprintId ? (
                  <Pressable
                    onPress={() => router.push(`/students/enroll-biometric?id=${item.id}`)}
                    className="px-2 py-1 rounded bg-blue-500"
                  >
                    <Text className="text-white text-xs">Enroll</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text className="text-center text-neutral mt-8">No students yet.</Text>
        }
      />
    </View>
  );
}
