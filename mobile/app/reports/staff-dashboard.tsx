//app/reports/staff-dashboard.tsx
import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ActivityIndicator, Pressable, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { getStaffGlobalSummary } from "../../src/services/staffAttendanceSummary";
import { todayISO } from "../../src/services/attendance";

export default function StaffReportsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Last 30 days for staff by default
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const data = await getStaffGlobalSummary(
          thirtyDaysAgo.toISOString().split('T')[0], 
          todayISO()
        );
        setSummary(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    return summary.reduce((acc, curr) => ({
      present: acc.present + curr.presentCount,
      late: acc.late + curr.lateCount,
      absent: acc.absent + curr.absentCount,
    }), { present: 0, late: 0, absent: 0 });
  }, [summary]);

  if (loading) return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" /></View>;

  return (
    <ScrollView className="flex-1 bg-slate-100">
      <View className="p-4 flex-row items-center bg-white border-b border-slate-200">
        <Pressable onPress={() => router.back()} className="mr-3">
          <MaterialIcons name="arrow-back" size={28} color="#1e293b" />
        </Pressable>
        <Text className="text-xl font-bold text-slate-800">Staff Attendance Analytics</Text>
      </View>

      <View className="p-4">
        {/* Stats Card */}
        <View className="bg-indigo-600 rounded-2xl p-6 shadow-lg mb-6">
          <Text className="text-indigo-100 text-sm font-medium">System-wide Staff Presence (Last 30 Days)</Text>
          <View className="flex-row justify-between mt-4">
            <View>
              <Text className="text-white text-2xl font-bold">{totals.present}</Text>
              <Text className="text-indigo-200 text-xs">On Time</Text>
            </View>
            <View>
              <Text className="text-white text-2xl font-bold">{totals.late}</Text>
              <Text className="text-indigo-200 text-xs">Late</Text>
            </View>
            <View>
              <Text className="text-white text-2xl font-bold">{totals.absent}</Text>
              <Text className="text-indigo-200 text-xs">Absences</Text>
            </View>
          </View>
        </View>

        <Text className="text-slate-500 font-bold mb-3 uppercase text-xs tracking-widest">Reports & Logs</Text>
        
        <Pressable 
            onPress={() => router.push("/reports/staff-daily")}
            className="bg-white p-5 rounded-xl flex-row items-center mb-3 shadow-sm"
        >
          <MaterialIcons name="today" size={24} color="#6366f1" />
          <View className="ml-4">
            <Text className="text-slate-800 font-bold">Daily Staff Logs</Text>
            <Text className="text-slate-400 text-xs">Detailed check-in/out times</Text>
          </View>
        </Pressable>

      </View>
    </ScrollView>
  );
}