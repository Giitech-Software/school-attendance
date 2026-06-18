import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";
import { listClasses, type ClassRecord } from "../../src/services/classes";
import { listStudents, upsertStudent } from "../../src/services/students";
import type { Student } from "../../src/services/types";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";

function classKey(cls?: ClassRecord | null) {
  return cls?.classId ?? cls?.id ?? "";
}

function isStudentInClass(student: Student, cls?: ClassRecord | null) {
  if (!cls) return false;
  return student.classDocId === cls.id || student.classId === cls.classId;
}

export default function PromoteStudents() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sourceClassId, setSourceClassId] = useState<string | null>(null);
  const [targetClassId, setTargetClassId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [classRows, studentRows] = await Promise.all([
          listClasses().catch(() => []),
          listStudents().catch(() => []),
        ]);

        if (!active) return;

        setClasses(classRows);
        setStudents(studentRows);

        if (classRows.length > 0) {
          setSourceClassId(classKey(classRows[0]));
          setTargetClassId(classKey(classRows[1] ?? classRows[0]));
        }
      } catch (error) {
        console.error("load promotion data", error);
        Alert.alert("Failed to load promotion data");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const sourceClass = useMemo(
    () => classes.find((cls) => classKey(cls) === sourceClassId) ?? null,
    [classes, sourceClassId]
  );

  const targetClass = useMemo(
    () => classes.find((cls) => classKey(cls) === targetClassId) ?? null,
    [classes, targetClassId]
  );

  const sourceStudents = useMemo(
    () =>
      students
        .filter((student) => student.isActive !== false && isStudentInClass(student, sourceClass))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [sourceClass, students]
  );

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sourceStudents;

    return sourceStudents.filter(
      (student) =>
        student.name?.toLowerCase().includes(query) ||
        student.studentId?.toLowerCase().includes(query) ||
        student.rollNo?.toLowerCase().includes(query)
    );
  }, [search, sourceStudents]);

  useEffect(() => {
    setSelectedStudentIds(new Set(sourceStudents.map((student) => student.id)));
  }, [sourceStudents]);

  function chooseSource(cls: ClassRecord) {
    const key = classKey(cls);
    setSourceClassId(key);
    if (targetClassId === key) {
      const nextTarget = classes.find((item) => classKey(item) !== key);
      setTargetClassId(nextTarget ? classKey(nextTarget) : null);
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedStudentIds(new Set(sourceStudents.map((student) => student.id)));
  }

  function clearSelection() {
    setSelectedStudentIds(new Set());
  }

  async function promoteSelected() {
    if (!sourceClass || !targetClass) {
      Alert.alert("Select classes", "Choose both a source class and a destination class.");
      return;
    }

    if (sourceClass.id === targetClass.id) {
      Alert.alert("Choose different classes", "Source and destination classes must be different.");
      return;
    }

    const selected = sourceStudents.filter((student) => selectedStudentIds.has(student.id));
    if (selected.length === 0) {
      Alert.alert("No students selected", "Select at least one student to promote.");
      return;
    }

    Alert.alert(
      "Promote students",
      `Move ${selected.length} student${selected.length === 1 ? "" : "s"} from ${sourceClass.name} to ${targetClass.name}? Attendance history will not be changed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Promote",
          onPress: async () => {
            setPromoting(true);
            const errors: string[] = [];
            const promotedIds = new Set<string>();

            try {
              for (const student of selected) {
                try {
                  await upsertStudent({
                    id: student.id,
                    classId: targetClass.classId,
                    classDocId: targetClass.id,
                    isActive: true,
                  });
                  promotedIds.add(student.id);
                } catch (error) {
                  errors.push(
                    `${student.name ?? student.studentId ?? student.id}: ${
                      error instanceof Error ? error.message : "failed"
                    }`
                  );
                }
              }

              setStudents((current) =>
                current.map((student) =>
                  promotedIds.has(student.id)
                    ? {
                        ...student,
                        classId: targetClass.classId,
                        classDocId: targetClass.id,
                        isActive: true,
                      }
                    : student
                )
              );

              if (errors.length > 0) {
                Alert.alert("Promotion finished with skips", errors.slice(0, 6).join("\n"));
              } else {
                Alert.alert("Promotion complete", `Promoted ${selected.length} students.`);
              }
            } finally {
              setPromoting(false);
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

  return (
    <View className="flex-1 bg-slate-300">
      <View className="bg-[#0B1C33] px-4 pt-3 pb-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#ffffff" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-white">
            Promote Students
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text className="font-semibold text-slate-900 mb-2">From class</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {classes.map((cls) => {
            const selected = classKey(cls) === sourceClassId;
            return (
              <Pressable
                key={cls.id}
                onPress={() => chooseSource(cls)}
                className={`px-4 py-2 mr-2 rounded-full ${selected ? "bg-blue-600" : "bg-white border border-slate-200"}`}
              >
                <Text className={selected ? "text-white font-semibold" : "text-slate-700"}>
                  {cls.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text className="font-semibold text-slate-900 mb-2">To class</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {classes.map((cls) => {
            const selected = classKey(cls) === targetClassId;
            const disabled = classKey(cls) === sourceClassId;
            return (
              <Pressable
                key={cls.id}
                disabled={disabled}
                onPress={() => setTargetClassId(classKey(cls))}
                className={`px-4 py-2 mr-2 rounded-full ${selected ? "bg-emerald-600" : "bg-white border border-slate-200"}`}
                style={disabled ? { opacity: 0.45 } : undefined}
              >
                <Text className={selected ? "text-white font-semibold" : "text-slate-700"}>
                  {cls.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4">
          <Text className="font-semibold text-slate-900">
            {sourceClass?.name ?? "No class selected"} to {targetClass?.name ?? "No destination selected"}
          </Text>
          <Text className="text-sm text-slate-600 mt-1">
            Selected {selectedStudentIds.size} of {sourceStudents.length} current students.
          </Text>
          <Text className="text-xs text-slate-500 mt-2">
            Promotion changes the current class only. Existing attendance records keep their original class.
          </Text>
        </View>

        <AppInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search students..."
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <View className="flex-row mb-3">
          <Pressable onPress={selectAllVisible} className="bg-slate-700 px-4 py-2 rounded-xl mr-2">
            <Text className="text-white font-medium">Select all</Text>
          </Pressable>
          <Pressable onPress={clearSelection} className="bg-white px-4 py-2 rounded-xl border border-slate-200">
            <Text className="text-slate-700 font-medium">Clear</Text>
          </Pressable>
        </View>

        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const selected = selectedStudentIds.has(item.id);
            return (
              <Pressable
                onPress={() => toggleStudent(item.id)}
                className="bg-white rounded-xl p-4 mb-3 flex-row items-center justify-between"
              >
                <View className="flex-1 pr-3">
                  <Text className="font-semibold text-slate-900">{item.name}</Text>
                  <Text className="text-xs text-slate-500 mt-1">
                    {item.studentId ?? "No student ID"}
                    {item.rollNo ? ` | Roll ${item.rollNo}` : ""}
                  </Text>
                </View>
                <MaterialIcons
                  name={selected ? "check-circle" : "radio-button-unchecked"}
                  size={24}
                  color={selected ? "#16A34A" : "#94A3B8"}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text className="text-center text-slate-500 mt-6">
              No active students found in this class.
            </Text>
          }
        />

        <Pressable
          onPress={promoteSelected}
          disabled={promoting || selectedStudentIds.size === 0 || !targetClass}
          className="bg-emerald-600 py-3 rounded-xl mt-2"
          style={
            promoting || selectedStudentIds.size === 0 || !targetClass
              ? { opacity: 0.6 }
              : undefined
          }
        >
          {promoting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-center font-semibold">
              Promote Selected Students
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
