import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import { listAdminLogs, type AdminLog } from "../../src/services/adminLogs";

function formatLogTime(log: AdminLog) {
  const value = log.createdAt;
  const date =
    value && typeof value.toDate === "function" ? value.toDate() : null;

  if (!date) return "Pending sync";

  return date.toLocaleString();
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderLog({ item }: { item: AdminLog }) {
  return (
    <View className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-bold text-slate-900">
            {formatAction(item.action)}
          </Text>
          <Text className="text-slate-700 mt-1">{item.description}</Text>
        </View>

        <View className="bg-slate-100 rounded-full px-3 py-1">
          <Text className="text-xs font-semibold text-slate-700">
            {item.targetType}
          </Text>
        </View>
      </View>

      <View className="border-t border-slate-100 mt-3 pt-3">
        <Text className="text-xs text-slate-500">
          {formatLogTime(item)}
        </Text>
        <Text className="text-xs text-slate-500 mt-1">
          By {item.actorName ?? item.actorUid}
          {item.actorRole ? ` (${item.actorRole})` : ""}
        </Text>
        {item.targetId ? (
          <Text className="text-xs text-slate-400 mt-1">
            Target: {item.targetId}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ActivityLogs() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [logs, setLogs] = React.useState<AdminLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadLogs = React.useCallback(async () => {
    const items = await listAdminLogs(150);
    setLogs(items);
  }, []);

  React.useEffect(() => {
    if (!adminReady) return;

    let mounted = true;
    setLoading(true);

    loadLogs()
      .catch((error) => {
        console.error("listAdminLogs", error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [adminReady, loadLogs]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
  }

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
        <Text className="text-slate-500 mt-3">Loading activity logs...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-[#0B1C33] px-5 pt-4 pb-4">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="p-1 mr-3"
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={26} color="#ffffff" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-extrabold text-white">
              Activity Logs
            </Text>
            <Text className="text-blue-200 mt-1">
              Recent user and admin actions
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLog}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <MaterialIcons name="history" size={38} color="#94A3B8" />
            <Text className="text-slate-500 mt-3">No activity yet.</Text>
          </View>
        }
      />
    </View>
  );
}
