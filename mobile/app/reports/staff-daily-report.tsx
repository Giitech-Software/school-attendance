// mobile/app/reports/staff-daily.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";import { getStaffGlobalSummary } from "../../src/services/staffAttendanceSummary";
import { exportDailyStaffAttendance } from "../../src/services/exports/exportDailyStaffAttendance";
import { MaterialIcons } from "@expo/vector-icons";

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */
function getLastNSchoolDays(n: number) {
  const out: string[] = [];
  let cursor = new Date();

  while (out.length < n) {
    const d = cursor.getDay();
    if (d >= 1 && d <= 5) {
      out.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return out.reverse();
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */
export default function StaffDailyReport() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [staffRows, setStaffRows] = useState<any[]>([]);

  /* ------------------------------------------------------------------ */
  /* LOAD DAYS */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    setDays(getLastNSchoolDays(5));
  }, []);

  /* ------------------------------------------------------------------ */
  /* LOAD DAILY STAFF ATTENDANCE */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      if (!selectedDay) {
  setStaffRows([]);
  setLoading(false);
  return;
}
      try {
        setLoading(true);

const rows = await getStaffGlobalSummary(selectedDay, selectedDay);


        setStaffRows(rows || []);
      } catch (e) {
        console.error("staff daily load", e);
        setStaffRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDay]);

  /* ------------------------------------------------------------------ */
  /* LOADING */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  /* ------------------------------------------------------------------ */
  /* UI */
  /* ------------------------------------------------------------------ */
  return (
    <ScrollView className="flex-1 bg-slate-300 p-4">
      <View className="flex-row items-center mb-2">
        <Pressable
          onPress={() => router.back()}
          className="p-1 mr-2"
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
        </Pressable>

        <Text className="text-2xl font-extrabold text-slate-900">
          Daily Staff Attendance
        </Text>
      </View>

      {/* -------------------- DAY SELECT -------------------- */}
      <Text className="text-sm text-slate-600 mb-2">Select day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((d) => (
          <Pressable
            key={d}
            onPress={() => setSelectedDay(d)}
            className={`p-4 mr-3 rounded-xl border ${
              selectedDay === d ? "bg-blue-600 border-blue-600" : "bg-white"
            }`}
          >
            <Text
              className={`font-bold ${
                selectedDay === d ? "text-white" : "text-slate-800"
              }`}
            >
              {new Date(d).toLocaleDateString()}
            </Text>
            <Text
              className={`text-xs ${
                selectedDay === d ? "text-white/80" : "text-slate-500"
              }`}
            >
              {d}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* -------- DAILY EXPORT (PDF ONLY) -------- */}
      <View className="mt-4 mb-4">
        <Pressable
          disabled={!selectedDay || exportingPdf}
          onPress={async () => {
            if (!selectedDay) return;
            try {
              setExportingPdf(true);
              await exportDailyStaffAttendance({
                dateIso: selectedDay,
              });
            } catch {
              Alert.alert("Export failed", "Unable to export PDF");
            } finally {
              setExportingPdf(false);
            }
          }}
          className={`px-4 py-3 rounded-xl items-center justify-center ${
            selectedDay && !exportingPdf ? "bg-blue-600" : "bg-slate-400"
          }`}
        >
          {exportingPdf ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Export PDF</Text>
          )}
        </Pressable>
      </View>

      {/* -------------------- STAFF ROWS -------------------- */}
      <Text className="text-lg font-semibold mt-6 mb-2">
        Staff ({staffRows.length})
      </Text>

      <Text className="text-ml text-slate-700 mb-2">
        P = Present • L = Late • A = Absent
      </Text>

      {staffRows.length === 0 ? (
        <Text className="text-slate-500">
          No attendance records for this day.
        </Text>
      ) : (
        staffRows.map((item) => (
          <Pressable
            key={item.staffId}
            onPress={() =>
              router.push({
                pathname: "/reports/staff/[id]",
                params: {
                  id: item.staffId,
                  fromIso: selectedDay!,
                  toIso: selectedDay!,
                  title: `Daily Report – ${selectedDay}`,
                },
              })
            }
            className="bg-white p-4 rounded-xl mb-3 shadow"
          >
            <Text className="font-semibold">
  {item.staffName} 
  {item.displayId ? ` (${item.displayId})` : ""}
</Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-emerald-600">P: {item.presentCount}</Text>
              <Text className="text-amber-600">L: {item.lateCount}</Text>
              <Text className="text-red-500">A: {item.absentCount}</Text>
              <Text className="text-slate-700">
                {item.percentagePresent.toFixed(1)}%
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
