import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import { createStudent } from "../../src/services/students";
import { listClasses, type ClassRecord } from "../../src/services/classes";
import { MaterialIcons } from "@expo/vector-icons";
import AppInput from "@/components/AppInput";

export default function StudentCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [loading, setLoading] = useState(false);

  // classes dropdown
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
const [studentId, setStudentId] = useState("");


  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const c = await listClasses();
        if (!mounted) return;
        setClasses(c);
      } catch (err) {
        console.error("listClasses error:", err);
      } finally {
        if (mounted) setClassesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert("Validation", "Name is required");
      return;
    }

    setLoading(true);
    try {
     await createStudent({
  name: name.trim(),
  classId: classId.trim() || undefined,
  rollNo: rollNo.trim() || undefined,

  // ✅ OPTIONAL manual studentId
  studentId: studentId.trim() || undefined,
} as any);

      Alert.alert("Student created");
      router.back();
    } catch (err: any) {
      console.error("createStudent error", err);
      Alert.alert("Create failed", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  function renderClassItem({ item }: { item: ClassRecord }) {
    const selected = item.classId === classId;
    return (
      <Pressable
        onPress={() => {
          setClassId(item.classId ?? item.id ?? "");
          setShowDropdown(false);
        }}
        className={`px-4 py-3 ${selected ? "bg-primary/10" : ""}`}
      >
        <Text className={selected ? "text-primary" : "text-dark"}>
          {item.name} {item.classId ? `(${item.classId})` : ""}
        </Text>
      </Pressable>
    );
  }

  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-300 p-4">
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
    New Student
  </Text>
</View>
      
        <Text className="text-sm text-neutral">Full name</Text>
       <AppInput
  value={name}
  onChangeText={setName}
  placeholder="e.g. Adwoa Aggrey"
  className="border p-3 rounded-xl mb-3 bg-white"
/>


        <Text className="text-sm text-neutral">Class</Text>

        {classesLoading ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : classes.length > 0 ? (
          <>
            <Pressable
              onPress={() => setShowDropdown(true)}
              className="border p-3 rounded-xl mb-3 bg-white flex-row justify-between items-center"
            >
              <Text className={classId ? "text-dark" : "text-neutral"}>
                {classId
                  ? classes.find((c) => c.classId === classId)?.name ??
                    classId
                  : "Select class"}
              </Text>
              <Text className="text-xs text-neutral">Select</Text>
            </Pressable>
          </>
        ) : (
          <TextInput
            value={classId}
            onChangeText={setClassId}
            className="border p-3 rounded-xl mb-3 bg-white"
            placeholder="e.g. Grade 1A"
          />
        )}
<Text className="text-sm text-neutral">
  Student ID
</Text>
<AppInput
  value={studentId}
  onChangeText={setStudentId}
  placeholder="e.g. STU-045 (leave empty to auto-generate)"
  className="border p-3 rounded-xl mb-3 bg-white"
/>
 

        <Text className="text-sm text-neutral">Roll no (optional)</Text>
        <AppInput
  value={rollNo}
  onChangeText={setRollNo}
  placeholder="e.g. 12"
  className="border p-3 rounded-xl mb-4 bg-white"
/>

        <Pressable
          onPress={handleCreate}
          className="bg-primary py-3 rounded-xl"
          disabled={loading}
          style={loading ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center">
            {loading ? "Creating…" : "Create student"}
          </Text>
        </Pressable>
      </View>

      {/* ---------- CLASS SELECT MODAL ---------- */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable
          className="flex-1 bg-black/30 justify-center px-6"
          onPress={() => setShowDropdown(false)}
        >
          <Pressable className="bg-white rounded-xl max-h-[70%]">
            <FlatList
              data={classes}
              keyExtractor={(item) => item.id}
              renderItem={renderClassItem}
              keyboardShouldPersistTaps="handled"
            />

            <Pressable
              onPress={() => {
                setClassId("");
                setShowDropdown(false);
              }}
              className="px-4 py-3 border-t"
            >
              <Text className="text-sm text-neutral">Clear selection</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal> 
    </KeyboardAwareScreen>
  );
}
