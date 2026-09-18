import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useCurrentStaff } from "../../src/hooks/useCurrentStaff";
import { updateOwnStaffProfilePhoto } from "../../src/services/staff";

export default function MyProfile() {
  const router = useRouter();
  const { staff, loading } = useCurrentStaff();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setCameraOpen(true);
  }

  async function capture() {
    if (!cameraRef.current || !staff?.id) return;
    setSaving(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.45, skipProcessing: true });
      if (!photo?.uri) throw new Error("Could not capture profile photo.");
      setPhotoUrl(photo.uri);
      setPendingUri(photo.uri);
      setCameraOpen(false);
      Alert.alert("Photo ready", "Review the photo and press Save profile picture.");
    } catch (error: any) {
      Alert.alert("Photo upload failed", error?.code === "storage/unauthorized" ? "You can only update your own profile picture." : "Could not update profile picture. Please try again.");
    } finally { setSaving(false); }
  }

  async function savePhoto() {
    if (!staff?.id || !pendingUri) return;
    setSaving(true);
    try {
      const updatedUrl = await updateOwnStaffProfilePhoto(staff.id, pendingUri);
      setPhotoUrl(`${updatedUrl}${updatedUrl.includes("?") ? "&" : "?"}v=${Date.now()}`);
      setPendingUri(null);
      Alert.alert("Profile updated", "Your profile picture was saved successfully.");
    } catch (error: any) { Alert.alert("Photo upload failed", "Could not save profile picture. Please try again."); }
    finally { setSaving(false); }
  }

  if (cameraOpen) return <View className="flex-1 bg-black"><CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" /><Pressable onPress={() => setCameraOpen(false)} className="absolute left-4 top-12 rounded-full bg-black/60 p-3"><Text className="font-semibold text-white">Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => void capture()} className="absolute bottom-10 self-center rounded-full bg-white px-7 py-4"><Text className="font-bold text-slate-900">{saving ? "Saving…" : "Capture photo"}</Text></Pressable></View>;
  if (loading) return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  if (!staff) return <View className="flex-1 items-center justify-center p-6"><Text className="text-center text-slate-700">Your staff profile is not linked. Ask an administrator to link it.</Text></View>;
  const displayedPhotoUrl = photoUrl ?? staff.profilePhotoUrl;
  return <View className="flex-1 bg-slate-100 p-4"><View className="mb-5 flex-row items-center"><Pressable onPress={() => router.back()} className="mr-2 p-1"><MaterialIcons name="arrow-back" size={26} color="#0f172a" /></Pressable><Text className="text-2xl font-extrabold text-slate-900">My Profile</Text></View><View className="items-center rounded-2xl bg-white p-3 pt-2"><Text className="mb-4 text-sm text-slate-600">View and update your profile picture.</Text>{displayedPhotoUrl ? <Image source={{ uri: displayedPhotoUrl }} className="h-72 w-72" /> : <View className="h-72 w-72 items-center justify-center bg-slate-200"><Text className="text-7xl font-bold text-slate-500">{staff.name?.charAt(0)?.toUpperCase()}</Text></View>}<Pressable onPress={() => void openCamera()} className="mt-5 rounded-xl bg-slate-900 px-5 py-3"><Text className="font-bold text-white">{displayedPhotoUrl ? "Take another photo" : "Capture photo"}</Text></Pressable>{pendingUri ? <Pressable onPress={() => void savePhoto()} disabled={saving} className="mt-3 rounded-xl bg-emerald-600 px-5 py-3"><Text className="font-bold text-white">{saving ? "Saving…" : "Save profile picture"}</Text></Pressable> : null}</View></View>;
}
