import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import { getStaffGlobalSummary } from "../../src/services/staffAttendanceSummary";
import AttendanceTotalsCards from "../../components/AttendanceTotalsCards";

function yearRange(year: number) {
  return { fromIso: `${year}-01-01`, toIso: `${year}-12-31`, label: String(year) };
}

export default function StaffYearlyReport() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4];
  }, []);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const range = yearRange(selectedYear);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getStaffGlobalSummary(range.fromIso, range.toIso);
        setRows(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [range.fromIso, range.toIso]);

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-300 p-3">
      <View className="flex-row items-center mb-2">
        <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="text-xl font-extrabold text-slate-900">Yearly Staff Reports</Text>
      </View>

      <Text className="text-sm text-slate-600 mb-2">Select year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {years.map((year) => (
          <Pressable key={year} onPress={() => setSelectedYear(year)} className={`px-3 py-2 mr-2 rounded-lg border ${selectedYear === year ? "bg-blue-600 border-blue-600" : "bg-white"}`}>
            <Text className={`font-bold ${selectedYear === year ? "text-white" : "text-slate-800"}`}>{year}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text className="text-lg font-semibold mt-3 mb-1.5">Staff ({rows.length})</Text>
      {rows.length > 0 ? <AttendanceTotalsCards rows={rows} label="Staff" /> : null}
      <Text className="text-ml text-slate-700 mb-2">P = Present - L = Late - T = Attended - A = Absent</Text>

      {rows.length === 0 ? (
        <Text className="text-slate-500">No data for selected year.</Text>
      ) : (
        rows.map((item) => (
          <Pressable key={item.staffId} onPress={() => router.push({ pathname: "/reports/staff/[id]", params: { id: item.staffId, fromIso: range.fromIso, toIso: range.toIso, title: `${range.label} Report` } })} className="bg-white px-3 py-2 rounded-md mb-2 shadow">
            <Text className="font-semibold">{item.staffName}{item.displayId ? ` (${item.displayId})` : ""}</Text>
            <View className="flex-row justify-between mt-1.5">
              <Text className="text-emerald-600">P: {item.presentCount}</Text>
              <Text className="text-amber-600">L: {item.lateCount}</Text>
              <Text className="text-blue-600">T: {item.attendedSessions}</Text>
              <Text className="text-red-500">A: {item.absentCount}</Text>
              <Text className="text-slate-700">{item.percentagePresent.toFixed(1)}%</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
