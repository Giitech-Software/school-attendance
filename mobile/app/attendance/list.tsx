// mobile/app/attendance/list.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList } from "react-native";
import { getAttendanceForDate } from "../../src/services/attendance"; // <-- updated import

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceList() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await getAttendanceForDate(todayISO());
      setRows(d);
    } catch (err: any) {
      console.error("getAttendanceForDate", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-xl font-semibold mb-4">Today's Attendance</Text>

      <FlatList
        data={rows}
        keyExtractor={(i, idx) => i.id ?? String(idx)}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3">
            <Text className="font-semibold text-dark">{item.studentName ?? item.studentId}</Text>
            <Text className="text-sm text-neutral mt-1">
              In: {item.checkInTime ?? "—"} • Out: {item.checkOutTime ?? "—"}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text className="text-center text-neutral mt-8">No attendance recorded today.</Text>}
      />
    </View>
  );
}
