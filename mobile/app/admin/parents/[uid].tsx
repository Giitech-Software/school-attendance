//mobile/app/admin/parents/[id].tsx
import React, { useEffect, useState, useMemo } from "react";
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
import useCurrentUser from "@/src/hooks/useCurrentUser";
import { listStudents } from "@/src/services/students";
import { getUserById } from "@/src/services/users";
import {
  assignWard,
  removeWard,
  getWardsForParent,
} from "@/src/services/wards";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/firebase";
import type { Student } from "@/src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";

type WardInfo = {
  wardId: string;
  parentUid: string;
  parentName: string;
};

export default function AdminParentWards() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { userDoc, loading: userDocLoading } = useCurrentUser();

  const [parent, setParent] = useState<any | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [wardMap, setWardMap] = useState<Map<string, string>>(new Map());
  const [globalWardMap, setGlobalWardMap] = useState<Map<string, WardInfo>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isAdmin = userDoc?.role === "admin";

  /* -------------------------------------------------- */
  /* ACCESS CONTROL                                     */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!isAdmin && !userDocLoading) {
      Alert.alert("Access denied");
      router.replace("/");
    }
  }, [isAdmin, userDocLoading, router]);

  /* -------------------------------------------------- */
  /* LOAD DATA                                          */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!uid) return;
    load();
  }, [uid]);

  async function load() {
    setLoading(true);
    try {
      const p = await getUserById(uid);
      setParent(p);

      const studs = await listStudents();
      setStudents(studs);

      // wards for THIS parent
      const wards = await getWardsForParent(uid);
      const localMap = new Map<string, string>();
      wards.forEach((w) => localMap.set(w.studentId, w.id));
      setWardMap(localMap);

      // 🔍 all wards (for conflict detection)
      const snap = await getDocs(collection(db, "wards"));
      const gMap = new Map<string, WardInfo>();

      for (const d of snap.docs) {
        const data = d.data();
        const parentDoc = await getUserById(data.parentUid);

        gMap.set(data.studentId, {
          wardId: d.id,
          parentUid: data.parentUid,
          parentName:
            parentDoc?.displayName ??
            parentDoc?.email ??
            "another parent",
        });
      }

      setGlobalWardMap(gMap);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Failed", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------------- */
  /* ASSIGN / MOVE / REMOVE                             */
  /* -------------------------------------------------- */
  async function toggleAssign(student: Student) {
    const localWardId = wardMap.get(student.id!);
    const globalWard = globalWardMap.get(student.id!);

    // 🟢 already assigned to THIS parent
    if (localWardId) {
      await removeWard(localWardId);

      setWardMap((m) => {
        const n = new Map(m);
        n.delete(student.id!);
        return n;
      });

     Alert.alert(
  "Ward Unassigned",
  `${student.name}${student.studentId ? ` (${student.studentId})` : ""} removed from ${
    parent?.displayName ?? parent?.email
  }`
);

      return;
    }

    // ⚠️ assigned to ANOTHER parent
    if (globalWard && globalWard.parentUid !== uid) {
    Alert.alert(
  "Already Assigned",
  `${student.name}${student.studentId ? ` (${student.studentId})` : ""} is already assigned to ${
    globalWard.parentName
  }.\n\nDo you want to move them to ${
    parent?.displayName ?? parent?.email
  }?`,

        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move",
            style: "destructive",
            onPress: () => forceAssign(student, globalWard.wardId),
          },
        ]
      );
      return;
    }

    // 🟢 clean assign
    await forceAssign(student);
  }

  async function forceAssign(student: Student, oldWardId?: string) {
    if (oldWardId) {
      await removeWard(oldWardId);
    }

    const doc = await assignWard(uid!, student.id!);

    setWardMap((m) => new Map(m).set(student.id!, doc.id));

    Alert.alert(
      "Ward Assigned",
      `${student.name ?? "Student"} assigned to ${
        parent?.displayName ?? parent?.email
      }`
    );
  }

  /* -------------------------------------------------- */
  /* FILTER                                             */
  /* -------------------------------------------------- */
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;

    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
s.studentId?.toLowerCase().includes(q) ||
s.rollNo?.toLowerCase().includes(q)

    );
  }, [students, search]);

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
      <View className="flex-row items-center mb-3">
        <Pressable onPress={() => router.back()} className="p-1 mr-2">
          <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
        </Pressable>
        <Text className="text-xl font-extrabold text-slate-900">
          Wards: {parent?.displayName ?? parent?.email}
        </Text>
      </View>

      <View className="bg-white rounded-xl px-3 py-2 mb-3">
       <AppInput
  value={search}
  onChangeText={setSearch}
  placeholder="Search student by name, id or roll number"
  className="text-base"
/>

      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(i) => i.id ?? ""}
        renderItem={({ item }) => {
          const assignedHere = wardMap.has(item.id!);
          const assignedElsewhere =
            globalWardMap.has(item.id!) &&
            !assignedHere;

          return (
            <View className="bg-white rounded-2xl p-4 mb-3">
              <View className="flex-row justify-between items-center">
                <View>
                 <Text className="font-semibold">
  {item.name}
  {item.studentId
    ? ` (${item.studentId})`
    : item.rollNo
    ? ` (${item.rollNo})`
    : ""}
</Text>

                  {assignedElsewhere && (
                    <Text className="text-xs text-amber-600 mt-1">
                      Assigned to{" "}
                      {globalWardMap.get(item.id!)?.parentName}
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
      />
    </View>
  );
}
