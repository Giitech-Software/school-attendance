import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { listTerms, deleteTerm } from "../../src/services/terms";
import { MaterialIcons } from "@expo/vector-icons";

export default function TermsList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const d = await listTerms();
      setItems(d || []);
    } catch (err: any) {
      console.error("listTerms", err);
      Alert.alert("Failed to load terms", err?.message ?? String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /** 🔁 Auto-refresh whenever screen gains focus */
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  function confirmDelete(id: string, name: string) {
    Alert.alert(
      "Delete term",
      `Are you sure you want to delete "${name}"?\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(id),
        },
      ]
    );
  }

  async function handleDelete(id: string) {
    try {
      await deleteTerm(id);
      setItems((s) => s.filter((x) => x.id !== id));
    } catch (err: any) {
      Alert.alert("Delete failed", err?.message ?? String(err));
    }
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
      {/* HEADER */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-1 mr-2">
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">
            Terms
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/terms/create")}
          className="bg-primary px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-semibold">Add term</Text>
        </Pressable>
      </View>

      {/* LIST */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 shadow flex-row justify-between items-center">
            <View>
              <Text className="font-semibold text-slate-800">
                {item.name}
              </Text>
              <Text className="text-sm text-slate-500 mt-1">
                {item.startDate} → {item.endDate}
              </Text>
            </View>

            <View className="flex-row space-x-3">
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/terms/[id]",
                    params: { id: item.id },
                  })
                }
                className="px-3 py-1 rounded bg-slate-100"
              >
                <Text className="text-slate-700">Edit</Text>
              </Pressable>

              <Pressable
                onPress={() => confirmDelete(item.id, item.name)}
                className="px-3 py-1 rounded bg-red-100"
              >
                <Text className="text-red">Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-center text-slate-500 mt-10">
            No terms yet.
          </Text>
        }
      />
    </View>
  );
}
