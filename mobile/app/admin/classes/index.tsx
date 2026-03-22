// mobile/app/admin/classes/index.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, Pressable, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
// adjust path if your services live elsewhere
import { listClasses, deleteClass } from "../../../src/services/classes";
import useCurrentUser from "../../../src/hooks/useCurrentUser";

export default function ClassesList() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // current user doc (authoritative for role)
  const { userDoc, loading: userDocLoading } = useCurrentUser();
  const isAdmin = Boolean(userDoc?.role === "admin");

  // helper for navigation to dynamic class route (string + cast to avoid router typing issues)

function goToEdit(id?: string) {
  if (!id) return;
  router.push(`/admin/classes/edit/${id}`);
}


  useFocusEffect( 
  React.useCallback(() => { 
    let active = true;

    (async () => {
      if (!active) return;
      await load();
    })();

    return () => {
      active = false;
    };
  }, [])
);


  async function load() {
    setLoading(true);
    try {
      const data = await listClasses();
      setItems(data);
    } catch (err: any) {
      console.error("listClasses", err);
      Alert.alert("Failed to load classes", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("Delete class", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(id);
          try {
            await deleteClass(id);
            setItems((s) => s.filter((x) => x.id !== id));
          } catch (err: any) {
            console.error("deleteClass", err);
            Alert.alert("Delete failed", err?.message ?? String(err));
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <View className="flex-row items-center justify-between mb-4">
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
   Classes
  </Text>
</View>
     

        {/* Only show Add to admins */}
        {isAdmin ? (
          <Pressable
  onPress={() => router.push("/admin/classes/create")}
  className="bg-primary py-2 px-3 rounded"
          >
            <Text className="text-white">Add</Text> 
          </Pressable>
        ) : (
          // keep spacing/layout consistent for non-admins 
          <View style={{ width: 70 }} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id ?? ""}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between">
            <View>
              <Text className="font-semibold text-dark">{item.name}</Text>
              <Text className="text-sm text-neutral mt-1">{item.description ?? "—"}</Text>
            </View>

            <View className="flex-row items-center space-x-2">
              {/* Edit: admin only */}
              {isAdmin ? (
                <Pressable onPress={() => goToEdit(item?.id)} className="p-2 rounded bg-white/20">

                  <MaterialIcons name="edit" size={20} color="#1E3A8A" />
                </Pressable>
              ) : null}

              {/* Delete: admin only */}
              {isAdmin ? (
                <Pressable onPress={() => handleDelete(item.id)} className="p-2 rounded bg-white/20">
                  <MaterialIcons name="delete" size={20} color="#EF4444" />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text className="text-center text-neutral mt-8">No classes yet.</Text>}
      />
    </View>
  );
}
