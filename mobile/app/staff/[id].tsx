// mobile/app/staff/[id].tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import { getStaffById, uploadStaffProfilePhoto, upsertStaff } from "../../src/services/staff";
import type { Staff } from "../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import { listStaffGroups, type StaffGroup } from "../../src/services/staffGroups";
import useCurrentUser from "../../src/hooks/useCurrentUser";

export default function StaffDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const { userDoc: currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  useEffect(() => { listStaffGroups().then(setGroups).catch(console.error); }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const s = await getStaffById(id as string);
        setStaff(s);
      } catch (err: any) {
        console.error(err);
        Alert.alert("Failed to load staff", err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSave() {
    if (!staff) return;
    setSaving(true);
    try {
      await upsertStaff(staff);
      Alert.alert("Saved");
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function captureProfilePhoto() {
    if (!staff?.id || !cameraRef.current) return;
    setPhotoUploading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.45, skipProcessing: true });
      if (!photo?.uri) throw new Error("Could not capture profile photo.");
      const profilePhotoUrl = await uploadStaffProfilePhoto(staff.id, photo.uri);
      await upsertStaff({ ...staff, profilePhotoUrl });
      setStaff({ ...staff, profilePhotoUrl });
      setCameraOpen(false);
    } catch (err: any) { Alert.alert("Photo upload failed", err?.message ?? "Could not save profile photo."); }
    finally { setPhotoUploading(false); }
  }

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!staff) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-4">
        <Text className="text-neutral">Staff not found.</Text>
      </View>
    );
  }

  if (cameraOpen) return <View className="flex-1 bg-black"><CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" /><Pressable onPress={() => setCameraOpen(false)} className="absolute top-12 left-4 rounded-full bg-black/60 p-3"><Text className="text-white">Cancel</Text></Pressable><Pressable onPress={captureProfilePhoto} disabled={photoUploading} className="absolute bottom-10 self-center rounded-full bg-white px-6 py-4"><Text className="font-bold text-slate-900">{photoUploading ? "Saving..." : "Capture photo"}</Text></Pressable></View>;

  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-100 p-4">
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">Edit Staff</Text>
        </View>

        <Text className="text-sm text-neutral">Full name</Text>
        <TextInput
          value={staff.name}
          onChangeText={(t) => setStaff({ ...staff, name: t })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Staff ID</Text>
        <TextInput
          value={staff.staffId ?? ""}
          onChangeText={(t) => setStaff({ ...staff, staffId: t || undefined })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Profile photo</Text>
        {staff.profilePhotoUrl ? <Image source={{ uri: staff.profilePhotoUrl }} className="mb-2 h-16 w-16 rounded-full" /> : null}
        <Pressable onPress={async () => { if (!permission?.granted) { const result = await requestPermission(); if (!result.granted) return; } setCameraOpen(true); }} className="mb-3 rounded-xl bg-slate-800 p-3"><Text className="text-center font-semibold text-white">{staff.profilePhotoUrl ? "Update profile photo" : "Capture profile photo"}</Text></Pressable>

        {isSuperAdmin ? <>
          <Text className="text-sm text-neutral">Linked User UID</Text>
          <TextInput
            value={staff.userUid ?? "Not linked"}
            editable={false}
            selectTextOnFocus
            className="border p-3 rounded-xl mb-3 bg-slate-50 text-slate-600"
          />
        </> : null}

        <Text className="text-sm text-neutral">Email</Text>
        <TextInput
          value={staff.email ?? ""}
          onChangeText={(t) => setStaff({ ...staff, email: t })}
          className="border p-3 rounded-xl mb-3 bg-white"
        />

        <Text className="text-sm text-neutral">Role</Text>
        <TextInput
          value={staff.role ?? ""}
          onChangeText={(t) => setStaff({ ...staff, role: t })}
          className="border p-3 rounded-xl mb-4 bg-white"
        />

        <Text className="text-sm text-neutral">Staff group</Text>
        <View className="flex-row flex-wrap gap-2 mb-4"><Pressable onPress={() => setStaff({ ...staff, staffGroupId: undefined })} className={`px-3 py-2 rounded-xl ${!staff.staffGroupId ? "bg-primary" : "bg-white border"}`}><Text className={!staff.staffGroupId ? "text-white" : "text-dark"}>Unassigned</Text></Pressable>{groups.map(g => <Pressable key={g.id} onPress={() => setStaff({ ...staff, staffGroupId: g.id })} className={`px-3 py-2 rounded-xl ${staff.staffGroupId === g.id ? "bg-primary" : "bg-white border"}`}><Text className={staff.staffGroupId === g.id ? "text-white" : "text-dark"}>{g.name}</Text></Pressable>)}</View>

        <Pressable
          onPress={handleSave}
          className="bg-primary py-3 rounded-xl"
          disabled={saving}
        >
          <Text className="text-white text-center">{saving ? "Saving…" : "Save"}</Text>
        </Pressable>

        {!staff.fingerprintId && (
  <>
    {/* Fingerprint */}
    <Pressable
      onPress={() => router.push(`/staff/enroll-biometric?id=${staff.id}`)}
      className="bg-blue-500 py-3 px-4 rounded-xl mt-4"
    >
      <Text className="text-white text-center font-medium">
        Enroll Biometric
      </Text>
    </Pressable>

    {/* Face */}
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/staff/register-face",
          params: { staffId: staff.id },
        })
      }
      className="bg-green-600 py-3 px-4 rounded-xl mt-4"
    >
      <Text className="text-white text-center font-medium">
        Register Face
      </Text>
    </Pressable>
  </>
)}
      </View>
    </KeyboardAwareScreen>
  );
}
