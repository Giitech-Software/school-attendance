// mobile/app/users/[id].tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getUserById, upsertUser, AppUser } from "../../src/services/users";
import { auth } from "../../app/firebase";
import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AppPicker from "@/components/AppPicker";

const USER_ROLES = [
  "parent",
  "teacher",
  "non_teaching_staff",
  "general_staff",
  "admin",
] as const;

export default function UserDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // admin state (determined by reading current user's /users/{uid} doc)
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const u = await getUserById(id as string);
        setUser(u);
      } catch (err: any) {
        console.error("getUserById", err);
        Alert.alert("Failed", err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const meUid = auth.currentUser?.uid;
        if (!meUid) {
          setCurrentUserIsAdmin(false);
          return;
        }
        const meDoc = await getUserById(meUid); // reuse service to read current user's doc
        setCurrentUserIsAdmin(Boolean(meDoc?.role === "admin"));
      } catch (e) {
        console.warn("Failed to read current user doc", e);
        setCurrentUserIsAdmin(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await upsertUser(user);
      Alert.alert("Saved");
      router.back();
    } catch (err: any) {
      console.error("upsertUser", err);
      Alert.alert("Save failed", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

 async function handlePromoteToAdmin() {
  if (!user?.id) return;
  Alert.alert(
    "Promote to admin",
    `Are you sure you want to give admin role to ${user.displayName ?? user.email}?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Promote",
        style: "destructive",
        onPress: async () => {
          setPromoting(true);
          try {
            await upsertUser({
              ...user,
              role: "admin",
            });

            // Update local state so UI shows role immediately
            setUser((prev) => prev ? { ...prev, role: "admin" } : prev);

            Alert.alert(
              "Success",
              "User promoted to admin. They must re-login to refresh their profile."
            );
          } catch (err: any) {
            console.error("promote error", err);
            Alert.alert("Promotion failed", err?.message ?? String(err));
          } finally {
            setPromoting(false);
          }
        },
      },
    ]
  );
}


  if (loading) return (<View className="flex-1 items-center justify-center bg-slate-50"><ActivityIndicator/></View>);

  if (!user) return (<View className="flex-1 items-center justify-center bg-slate-50 p-4"><Text className="text-neutral">User not found.</Text></View>);

  return (
    <View className="flex-1 bg-slate-50 p-4">
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
    Edit User
  </Text>
</View>

      <Text className="text-sm text-neutral">Display name</Text>
<TextInput
  value={user.displayName ?? ""}
  onChangeText={(t) => setUser({ ...user, displayName: t })}
  className="border p-3 rounded mb-3 bg-white"
/>

{currentUserIsAdmin && user && (
  <>
    {/* Role Picker */}
    <Text className="text-sm text-neutral mb-1">Role</Text>
    <View className="border rounded mb-4 bg-white overflow-hidden">
      <AppPicker
        selectedValue={user.role ?? "teacher"}
        onValueChange={(value) => setUser({ ...user, role: value })}
      >
        <Picker.Item label="Parent" value="parent" />
        <Picker.Item label="Teacher" value="teacher" />
        <Picker.Item label="Non-Teaching Staff" value="non_teaching_staff" />
        <Picker.Item label="General Staff" value="general_staff" />
        <Picker.Item label="Administrator" value="admin" />
      </AppPicker>
    </View>

    {/* Approval Toggle */}
    <Text className="text-ml text-neutral-600 mb-1 mt-2">Approval</Text>
    <View className="flex-row items-center mb-4">
      <Pressable
        onPress={() =>
          setUser((prev) =>
            prev ? { ...prev, approved: !prev.approved } : prev
          )
        }
        className={`px-4 py-2 rounded ${
          user.approved ? "bg-green-600" : "bg-red-600"
        }`}
      >
        <Text className="text-white">
          {user.approved ? "Approved" : "Not Approved"}
        </Text>
      </Pressable>
    </View>

    {/* Promote to Admin */}
    {user.role !== "admin" && (
      <Pressable
        onPress={handlePromoteToAdmin}
        className="mt-3 bg-red py-3 rounded"
        disabled={promoting}
      >
        <View className="bg-green-300 rounded-lg px-4 py-2">
          <Text className="text-white text-center font-medium">
            {promoting ? "Promoting…" : "Promote to Admin"}
          </Text>
        </View>
      </Pressable>
    )}
  </>
)}

{/* Save button */}
<Pressable
  onPress={handleSave}
  className="bg-primary py-3 rounded"
  disabled={saving}
>
  <Text className="text-white text-center">{saving ? "Saving…" : "Save"}</Text>
</Pressable>
    </View>
  );
}
