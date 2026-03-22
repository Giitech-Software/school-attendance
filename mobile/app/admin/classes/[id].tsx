// mobile/app/admin/classes/[id].tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import useCurrentUser from "../../../src/hooks/useCurrentUser";
import { getClassById, listClasses } from "../../../src/services/classes";
import { listStudents, upsertStudent } from "../../../src/services/students";
import type { Student } from "../../../src/services/types";

export default function AdminClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); // class doc id
  const router = useRouter();
  const { userDoc, loading: userDocLoading } = useCurrentUser();

  const [cls, setCls] = useState<any | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const isAdmin = userDoc?.role === "admin";

  /* -------------------------------------------------- */
  /* ACCESS CONTROL                                     */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!userDocLoading && !isAdmin) {
      Alert.alert("Access denied", "Admin access required");
      router.replace("/");
    }
  }, [isAdmin, userDocLoading, router]);

  /* -------------------------------------------------- */
  /* LOAD DATA                                          */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const clsDoc = await getClassById(id);
      setCls(clsDoc);

      const studs = await listStudents();
      setStudents(studs);

      // build classDocId → className map
      const allClasses = await listClasses();
      const map: Record<string, string> = {};
      allClasses.forEach((c: any) => {
        map[c.id] = c.name;
      });
      setClassMap(map);
    } catch (err: any) {
      console.error("load class detail", err);
      Alert.alert("Failed", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------------- */
  /* ASSIGN / UNASSIGN                                  */
  /* -------------------------------------------------- */
  async function toggleAssign(student: Student) {
    if (!cls) return;

    const assignedHere = student.classDocId === id;
    const assignedElsewhere =
      student.classDocId && student.classDocId !== id;

    if (assignedElsewhere) {
      const otherClassName =
      getClassName(student.classDocId);


      Alert.alert(
        "Already assigned",
        `${student.name ?? "Student"} is already assigned to "${otherClassName}".\n\nDo you want to move them to "${cls.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move",
            style: "destructive",
            onPress: () => forceAssign(student),
          },
        ]
      );
      return;
    }

    // normal toggle
    await forceAssign(student, assignedHere);
  }

  async function forceAssign(student: Student, unassign = false) {
    try {
      await upsertStudent({
  id: student.id,
  classDocId: unassign ? undefined : id,
  classId: unassign ? undefined : cls.classId,
  isActive: unassign ? false : true,
});


      setStudents((prev) =>
        prev.map((st) =>
          st.id === student.id
            ? {
                ...st,
                classDocId: unassign ? undefined : id,
                classId: unassign ? undefined : cls.classId,
              }
            : st
        )
      );
    } catch (err: any) {
      console.error("assign error:", err);
      Alert.alert("Failed", err?.message ?? String(err));
    }
  }

  /* -------------------------------------------------- */
  /* FILTER                                             */
  /* -------------------------------------------------- */
 const filteredStudents = students.filter((s) => {
  if (s.isActive === false) return false;

  const q = search.trim().toLowerCase();
  if (!q) return true;

  return (
    s.name?.toLowerCase().includes(q) ||
    s.studentId?.toLowerCase().includes(q) ||
    (!s.studentId && s.rollNo?.toLowerCase().includes(q))
  );
});

function getClassName(classDocId?: string) {
  if (!classDocId) return "another class";
  return classMap[classDocId] ?? "another class";
}

  /* -------------------------------------------------- */
  /* RENDER                                             */
  /* -------------------------------------------------- */
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-300 p-4">
      {/* HEADER */}
      <View className="flex-row items-center mb-2">
        <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
          <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
        </Pressable>

        <Text className="text-xl font-extrabold text-slate-900">
          Class: {cls?.name ?? id}
        </Text>
      </View>

      <Text className="text-sm text-neutral mb-4">
        {cls?.description ?? ""}
      </Text>

      <Text className="font-semibold mb-2">Assign students</Text>

      {/* SEARCH */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search students..."
        placeholderTextColor="#6B7280"
        className="bg-white rounded-xl px-4 py-3 mb-3 text-dark"
      />

      {/* LIST */}
      <FlatList
        data={filteredStudents}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => {
          const assignedHere = item.classDocId === id;
          const assignedElsewhere =
            item.classDocId && item.classDocId !== id;

          return (
            <View className="bg-white rounded-2xl p-4 mb-3">
              <View className="flex-row items-center justify-between">
                <View>
                <Text className="font-semibold text-dark">
  {item.name}
  {item.studentId
    ? ` (${item.studentId})`
    : item.rollNo
    ? ` (${item.rollNo})`
    : ""}
</Text>


                 {assignedElsewhere && (
  <Text className="text-xs text-amber-600 mt-1">
    Assigned to {getClassName(item.classDocId)}
  </Text>
)}

                </View>

                <Pressable
                  onPress={() => toggleAssign(item)}
                  className={`px-4 py-2 rounded ${
                    assignedHere
                      ? "bg-primary"
                      : assignedElsewhere
                      ? "bg-amber-100"
                      : "bg-white"
                  }`}
                  style={
                    assignedHere
                      ? undefined
                      : { borderWidth: 1, borderColor: "#E5E7EB" }
                  }
                >
                  <Text
                    className={
                      assignedHere
                        ? "text-white"
                        : assignedElsewhere
                        ? "text-amber-700"
                        : "text-dark"
                    }
                  >
                    {assignedHere
                      ? "Assigned"
                      : assignedElsewhere
                      ? "Move"
                      : "Assign"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text className="text-center text-neutral mt-8">
            No students yet.
          </Text>
        }
      />
    </View>
  );
}
