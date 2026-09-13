// mobile/app/students/[id].tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import { getStudentById, uploadStudentProfilePhoto, upsertStudent } from "../../src/services/students";
import type { Student } from "../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";




export default function StudentDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const s = await getStudentById(id as string);
        setStudent(s);
      } catch (err: any) {
        console.error("getStudentById error", err);
        Alert.alert("Failed to load student", err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSave() {
    if (!student) return;
    setSaving(true);
    try {
      await upsertStudent(student);
      Alert.alert("Saved");
      router.back();
    } catch (err: any) {
      console.error("upsertStudent error", err);
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function captureProfilePhoto() {
    if (!student?.id || !cameraRef.current) return;
    setPhotoSaving(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.45, skipProcessing: true });
      if (!photo?.uri) throw new Error("Could not capture profile photo.");
      const profilePhotoUrl = await uploadStudentProfilePhoto(student.id, photo.uri);
      await upsertStudent({ ...student, profilePhotoUrl });
      setStudent({ ...student, profilePhotoUrl }); setCameraOpen(false);
    } catch (err: any) { Alert.alert("Photo upload failed", err?.message ?? "Could not save profile photo."); }
    finally { setPhotoSaving(false); }
  }

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!student) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-4">
        <Text className="text-neutral">Student not found.</Text>
      </View>
    );
  }

  if (cameraOpen) return <View className="flex-1 bg-black"><CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" /><Pressable onPress={() => setCameraOpen(false)} className="absolute top-12 left-4 rounded-full bg-black/60 p-3"><Text className="text-white">Cancel</Text></Pressable><Pressable onPress={captureProfilePhoto} disabled={photoSaving} className="absolute bottom-10 self-center rounded-full bg-white px-6 py-4"><Text className="font-bold text-slate-900">{photoSaving ? "Saving..." : "Capture photo"}</Text></Pressable></View>;

  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-100 p-4">
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
Edit Student
  </Text>
</View>

        <Text className="text-sm text-neutral">Full name</Text>
        <TextInput
          value={student.name}
          onChangeText={(t) => setStudent({ ...student, name: t })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Profile photo</Text>
        {student.profilePhotoUrl ? <Image source={{ uri: student.profilePhotoUrl }} className="mb-2 h-16 w-16 rounded-full" /> : null}
        <Pressable onPress={async () => { if (!permission?.granted) { const result = await requestPermission(); if (!result.granted) return; } setCameraOpen(true); }} className="mb-3 rounded-xl bg-slate-800 p-3"><Text className="text-center font-semibold text-white">{student.profilePhotoUrl ? "Update profile photo" : "Capture profile photo"}</Text></Pressable>
<Text className="text-sm text-neutral">Student ID</Text>
<TextInput
  value={student.studentId ?? ""}
  onChangeText={(t) =>
    setStudent({
      ...student,
      studentId: t.trim() || undefined, // ✅ critical
    })
  }
  placeholder="Leave empty to keep or auto-generate"
  className="border p-3 rounded-xl mb-3 bg-white"
/>

        <Text className="text-sm text-neutral">Class</Text>
        <TextInput
          value={student.classId ?? ""}
          onChangeText={(t) => setStudent({ ...student, classId: t })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Roll no (optional)</Text>
        <TextInput
          value={student.rollNo ?? ""}
          onChangeText={(t) => setStudent({ ...student, rollNo: t })}
          className="border p-3 rounded-xl mb-4 bg-white"
        />

        <Pressable
          onPress={handleSave}
          className="bg-primary py-3 rounded-xl"
          disabled={saving}
        >
          <Text className="text-white text-center">
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.push(`/students/enroll-biometric?id=${student.id}`)
          }
          className="bg-primary py-3 px-4 rounded-xl mt-4"
        >
          <Text className="text-white text-center font-medium">
            Enroll Biometric
          </Text>
        </Pressable>

      </View>
    </KeyboardAwareScreen>
  );
}
