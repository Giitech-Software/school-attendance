import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useCurrentStaff } from "../../src/hooks/useCurrentStaff";
import { updateOwnStaffProfilePhoto } from "../../src/services/staff";
import useCurrentUser from "../../src/hooks/useCurrentUser";
import { updateOwnUserProfilePhoto } from "../../src/services/users";
import { describeProfilePhotoUploadError } from "../../src/services/profilePhotoUpload";

export default function MyProfile() {
  const router = useRouter();
  const { staff, loading } = useCurrentStaff();
  const { userDoc, loading: userLoading } = useCurrentUser();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraPictureSize, setCameraPictureSize] = useState<string | undefined>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  async function configureProfileCamera() {
    if (cameraPictureSize || !cameraRef.current) return;
    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
      const candidates = sizes.flatMap((size) => {
        const match = /^(\d+)x(\d+)$/.exec(size);
        if (!match) return [];
        return [{ size, pixels: Number(match[1]) * Number(match[2]) }];
      });
      const eligible = candidates.filter((candidate) => candidate.pixels <= 1024 * 1024);
      const chosen = (eligible.length ? eligible : candidates).sort((a, b) =>
        eligible.length ? b.pixels - a.pixels : a.pixels - b.pixels
      )[0];
      if (chosen) setCameraPictureSize(chosen.size);
    } catch (error) {
      console.warn("Could not select a smaller profile-photo capture size", error);
    }
  }

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setCameraPictureSize(undefined);
    setCameraOpen(true);
  }

  async function capture() {
    if (!cameraRef.current || (!staff?.id && !userDoc?.uid)) return;
    setSaving(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.55, skipProcessing: true });
      if (!photo?.uri) throw new Error("Could not capture profile photo.");
      setPhotoUrl(photo.uri);
      setPendingUri(photo.uri);
      setCameraOpen(false);
      Alert.alert("Photo ready", "Review the photo and press Save profile picture.");
    } catch (error: any) {
      console.error("Profile photo capture failed", error);
      Alert.alert("Camera error", error?.message ?? "Could not capture a profile photo.");
    } finally {
      setSaving(false);
    }
  }

  async function savePhoto() {
    if (!pendingUri || (!staff?.id && !userDoc?.uid)) return;
    setSaving(true);
    try {
      const isAdminProfile = userDoc?.role === "admin" || userDoc?.role === "super_admin";
      const updatedUrl = isAdminProfile
        ? await updateOwnUserProfilePhoto(pendingUri)
        : staff?.id
          ? await updateOwnStaffProfilePhoto(staff.id, pendingUri)
          : await updateOwnUserProfilePhoto(pendingUri);
      setPhotoUrl(updatedUrl);
      setPendingUri(null);
      Alert.alert("Profile updated", "Your profile picture was saved successfully.");
    } catch (error: any) {
      console.error("Profile photo upload failed", {
        code: error?.code ?? null,
        message: error?.message ?? null,
        serverResponse: error?.customData?.serverResponse ?? error?.serverResponse ?? null,
        error,
      });
      Alert.alert("Photo upload failed", describeProfilePhotoUploadError(error));
    } finally {
      setSaving(false);
    }
  }

  if (cameraOpen) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="front"
          pictureSize={cameraPictureSize}
          onCameraReady={() => void configureProfileCamera()}
        />
        <Pressable onPress={() => setCameraOpen(false)} className="absolute left-4 top-12 rounded-full bg-black/60 p-3">
          <Text className="font-semibold text-white">Cancel</Text>
        </Pressable>
        <Pressable disabled={saving} onPress={() => void capture()} className="absolute bottom-10 self-center rounded-full bg-white px-7 py-4">
          <Text className="font-bold text-slate-900">{saving ? "Saving..." : "Capture photo"}</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || userLoading) return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  if (!staff && !userDoc) return <View className="flex-1 items-center justify-center p-6"><Text className="text-center text-slate-700">Your profile is unavailable. Sign in again and retry.</Text></View>;

  const isAdminProfile = userDoc?.role === "admin" || userDoc?.role === "super_admin";
  const displayedPhotoUrl = photoUrl ?? (isAdminProfile ? userDoc?.profilePhotoUrl : staff?.profilePhotoUrl ?? userDoc?.profilePhotoUrl);
  const displayName = staff?.name ?? userDoc?.displayName ?? "My profile";

  return (
    <View className="flex-1 bg-slate-100 p-4">
      <View className="mb-5 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-2 p-1"><MaterialIcons name="arrow-back" size={26} color="#0f172a" /></Pressable>
        <Text className="text-2xl font-extrabold text-slate-900">My Profile</Text>
      </View>
      <View className="items-center rounded-2xl bg-white p-3 pt-2">
        <Text className="mb-4 text-sm text-slate-600">View and update your profile picture.</Text>
        {displayedPhotoUrl ? <Image source={{ uri: displayedPhotoUrl }} className="h-72 w-72" /> : <View className="h-72 w-72 items-center justify-center bg-slate-200"><Text className="text-7xl font-bold text-slate-500">{displayName.charAt(0)?.toUpperCase()}</Text></View>}
        <Pressable onPress={() => void openCamera()} disabled={saving} className="mt-5 rounded-xl bg-slate-900 px-5 py-3">
          <Text className="font-bold text-white">{displayedPhotoUrl ? "Take another photo" : "Capture photo"}</Text>
        </Pressable>
        {pendingUri ? <Pressable onPress={() => void savePhoto()} disabled={saving} className="mt-3 rounded-xl bg-emerald-600 px-5 py-3"><Text className="font-bold text-white">{saving ? "Saving..." : "Save profile picture"}</Text></Pressable> : null}
      </View>
    </View>
  );
}
