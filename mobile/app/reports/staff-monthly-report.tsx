// app/reports/staff-monthly-report.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { getStaffGlobalSummary } from "../../src/services/staffAttendanceSummary";
import { exportMonthlyStaffAttendance } from "../../src/services/exports/exportMonthlyStaffAttendance";

/* Generate last 12 months */
function getMonthsForYear(year: number) {
  const months = [];

  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);

    months.push({
      label: d.toLocaleString("default", { month: "short", year: "numeric" }),
      year: year,
      month: m,
    });
  }

  return months;
}
export default function StaffMonthlyReport() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<
    { label: string; year: number; month: number }[]
  >([]);
  const [selectedMonth, setSelectedMonth] = useState<any | null>(null);
  const [staffRows, setStaffRows] = useState<any[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  /* Load months */
 useEffect(() => {
  const now = new Date();
  setMonths(getMonthsForYear(now.getFullYear()));
  setLoading(false);
}, []);

  /* Load monthly staff summary */
  useEffect(() => {
    if (!selectedMonth) {
      setStaffRows([]);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const { year, month } = selectedMonth;

        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0);

        const fromIso = from.toISOString().slice(0, 10);
        const toIso = to.toISOString().slice(0, 10);

        const summary = await getStaffGlobalSummary(fromIso, toIso);

        setStaffRows(summary || []);
      } catch (e) {
        console.error("monthly load", e);
        Alert.alert("Failed to load monthly report");
        setStaffRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedMonth]);

  if (loading && !selectedMonth) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

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
          Monthly Staff Reports
        </Text>
      </View>

      {/* MONTH SELECT */}
      <Text className="text-sm text-slate-600 mb-2">Select month</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        {months.map((m) => (
          <Pressable
            key={`${m.year}-${m.month}`}
            onPress={() => setSelectedMonth(m)}
            className={`p-4 mr-3 rounded-xl border ${
              selectedMonth?.year === m.year &&
              selectedMonth?.month === m.month
                ? "bg-blue-600 border-blue-600"
                : "bg-white"
            }`}
          >
            <Text
              className={`font-bold ${
                selectedMonth?.year === m.year &&
                selectedMonth?.month === m.month
                  ? "text-white"
                  : "text-slate-800"
              }`}
            >
              {m.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* EXPORT PDF */}
      <View className="mt-4">
        <Pressable
          disabled={!selectedMonth || exportingPdf}
          onPress={async () => {
            if (!selectedMonth) return;

            try {
              setExportingPdf(true);

              const { year, month } = selectedMonth;

              const from = new Date(year, month, 1);
              const to = new Date(year, month + 1, 0);

              const fromIso = from.toISOString().slice(0, 10);
              const toIso = to.toISOString().slice(0, 10);

              await exportMonthlyStaffAttendance({
                fromIso,
                toIso,
                label: selectedMonth.label,
              });
            } catch {
              Alert.alert("Export failed", "Unable to export PDF");
            } finally {
              setExportingPdf(false);
            }
          }}
          className={`rounded-xl p-3 items-center justify-center ${
            selectedMonth && !exportingPdf
              ? "bg-blue-600"
              : "bg-slate-400"
          }`}
        >
          {exportingPdf ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-semibold">
              Export PDF
            </Text>
          )}
        </Pressable>
      </View>

      {/* STAFF CARDS */}
      <Text className="text-lg font-semibold mt-6 mb-2">
        Staff ({staffRows.length})
      </Text>

      <Text className="text-sm text-slate-700 mb-2">
        P = Present • L = Late • T = Attended • A = Absent
      </Text>

      {staffRows.length === 0 ? (
        <Text className="text-slate-500">
          No data for selected month.
        </Text>
      ) : (
        staffRows.map((item) => (
          <Pressable
            key={item.staffId}
            onPress={() =>
              router.push({
                pathname: `/reports/staff/[id]`,
                params: {
                  id: item.staffId,
                  fromIso: new Date(
                    selectedMonth.year,
                    selectedMonth.month,
                    1
                  )
                    .toISOString()
                    .slice(0, 10),
                  toIso: new Date(
                    selectedMonth.year,
                    selectedMonth.month + 1,
                    0
                  )
                    .toISOString()
                    .slice(0, 10),
                  title: `Monthly Report – ${selectedMonth.label}`,
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
              <Text className="text-emerald-600">
                P: {item.presentCount}
              </Text>
              <Text className="text-amber-600">
                L: {item.lateCount}
              </Text>
              <Text className="text-blue-600">
                T: {item.attendedSessions}
              </Text>
              <Text className="text-red-500">
                A: {item.absentCount}
              </Text>
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