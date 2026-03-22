// mobile/app/students/enroll-biometric.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { getStudentById, upsertStudent } from "../../src/services/students";
import { biometricKeyForStudent } from "../../src/services/secureKeys";
import { MaterialIcons } from "@expo/vector-icons";
import { getStudentLabel } from "../../src/utils/studentLabel";



function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- FIX: SecureStore key helper (no invalid characters) ---
function secureKeyForStudent(studentId: string) {
  const safe = (studentId ?? "")
    .toString()
    .replace(/[^A-Za-z0-9._-]/g, "_"); // replace any bad characters
  return `biometricId_${safe}`;
}

export default function EnrollBiometric() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const idParam = Array.isArray(params.id) ? params.id[0] : (params.id as string | undefined);
  const studentId = idParam ?? null;

  const [student, setStudent] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [enrolling, setEnrolling] = useState<boolean>(false);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let mounted = true;

    (async () => {
      try {
        const s = await getStudentById(studentId);
        if (mounted) setStudent(s);
      } catch (err) {
        console.error("getStudentById error:", err);
        Alert.alert("Error", "Failed to load student.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [studentId]);

  async function handleEnroll() {
    if (!studentId || !student) {
      Alert.alert("Missing student", "No student selected for enrollment.");
      return;
    }

    setEnrolling(true);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert("No biometric hardware", "This device does not support biometric authentication.");
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        Alert.alert("No biometrics enrolled", "Please enroll fingerprints/face on this device first.");
        return;
      }

      const auth = await LocalAuthentication.authenticateAsync({
       promptMessage: `Confirm to enroll ${getStudentLabel(student)}`,

        cancelLabel: "Cancel",
      });

      if (!auth.success) {
        Alert.alert("Authentication required", "Biometric authentication was not completed.");
        return;
      }

      // Generate a unique biometric token
      const biometricId = generateUuid();

      // Save to Firestore
      await upsertStudent({
        id: studentId,
        fingerprintId: biometricId,
      } as any);

      // --- FIX: Use the safe key ---
      // 1) Save per-student biometricId
const key = biometricKeyForStudent(studentId);
await SecureStore.setItemAsync(key, biometricId);


// 2) Update biometric index (list of all enrolled students on this device)
const rawIndex = await SecureStore.getItemAsync("biometric_index");
let indexList: string[] = [];

if (rawIndex) {
  try {
    indexList = JSON.parse(rawIndex);
  } catch {
    indexList = [];
  }
}

if (!indexList.includes(studentId)) {
  indexList.push(studentId);
  await SecureStore.setItemAsync("biometric_index", JSON.stringify(indexList));
}


      Alert.alert(
        "Enrolled",
        `${student.name ?? "Student"} enrolled for biometric check-in.`
      );

    } catch (err: any) {
      console.error("Enroll biometric error:", err);
      Alert.alert("Error", err?.message ?? "Failed to enroll biometric.");
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!studentId) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-4">
        <Text className="text-center text-neutral">No student specified.</Text>
      </View>
    );
  }

  if (!student) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-4">
        <Text className="text-center text-neutral">Student not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} className="flex-1 bg-slate-300">
      <View className="bg-white rounded-2xl p-4 mb-4 shadow">
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
   Enroll Biometric
  </Text>
</View>
        <Text className="text-m text-neutral mb-3">Student</Text>
      <Text className="font-semibold text-dark">
  {student.name} ({student.studentId ?? student.rollNo ?? "—"})
</Text>

      </View>

      <View className="bg-white rounded-2xl p-4 mb-4 shadow">
        <Text className="text-m text-neutral mb-3">
          This enrollment links the device to the student's biometric mapping. It stores a private token on the student
          and a secure entry on this device. No raw biometric data is stored.
        </Text>

        <Pressable
          onPress={handleEnroll}
          className="bg-primary py-3 px-4 rounded"
          disabled={enrolling}
          style={enrolling ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center">
            {enrolling ? "Enrolling…" : "Enroll fingerprint / biometric"}
          </Text>
        </Pressable>

        <View style={{ height: 12 }} />

        <Pressable
          onPress={() => router.back()}
          className="border py-3 px-4 rounded"
        >
          <Text className="text-center text-neutral">Back</Text>
        </Pressable>
      </View>

      <View className="mt-4 items-center">
        <Text className="text-s text-neutral">
          Enrollment is per-device. To enroll another device, repeat this process on that device.
        </Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
