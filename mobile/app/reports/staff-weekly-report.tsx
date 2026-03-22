// app/reports/staff-weekly-report.tsx

import React, { useEffect, useMemo, useState } from "react";
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

import { listWeeks } from "../../src/services/weeks";
import { listTerms } from "../../src/services/terms";
import { getStaffGlobalSummary } from "../../src/services/staffAttendanceSummary";
import { exportWeeklyStaffAttendance } from "../../src/services/exports/exportWeeklyStaffAttendance";

export default function StaffWeeklyReport() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any | null>(null);
  const [staffRows, setStaffRows] = useState<any[]>([]);
  const [exportingWeeklyPdf, setExportingWeeklyPdf] = useState(false);

  /* LOAD WEEKS + CURRENT TERM */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const terms = await listTerms().catch(() => []);
        const nowIso = new Date().toISOString().slice(0, 10);

        const currentTerm =
          terms.find((t) => t.isCurrent) ??
          terms.find((t) => nowIso >= t.startDate && nowIso <= t.endDate) ??
          null;

        if (!currentTerm) {
          Alert.alert(
            "No active term",
            "Please mark a term as current to view weekly reports."
          );
          setWeeks([]);
          setSelectedWeek(null);
          return;
        }

        const w = await listWeeks(currentTerm.id).catch(() => []);
        setWeeks(w || []);
        setSelectedWeek(null);
      } catch (e) {
        Alert.alert("Failed to load weeks");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedWeeks = useMemo(() => {
    return [...weeks].sort(
      (a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
    );
  }, [weeks]);

  /* LOAD STAFF WEEK DATA */
  useEffect(() => {
    if (!selectedWeek) {
      setStaffRows([]);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const rows = await getStaffGlobalSummary(
          selectedWeek.startDate,
          selectedWeek.endDate
        );

        setStaffRows(rows || []);
      } catch {
        Alert.alert("Failed to load weekly staff report");
        setStaffRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedWeek]);

  if (loading && !selectedWeek) {
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
          Weekly Staff Reports
        </Text>
      </View>

      {/* WEEK SELECT */}
      <Text className="text-sm text-slate-600 mb-2">
        Select week
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        {sortedWeeks.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => setSelectedWeek(w)}
            className={`p-4 mr-3 rounded-xl border ${
              selectedWeek?.id === w.id
                ? "bg-blue-600 border-blue-600"
                : "bg-white"
            }`}
          >
            <Text
              className={`font-bold ${
                selectedWeek?.id === w.id
                  ? "text-white"
                  : "text-slate-800"
              }`}
            >
              Week {w.weekNumber}
            </Text>

            <Text
              className={`text-xs ${
                selectedWeek?.id === w.id
                  ? "text-white/80"
                  : "text-slate-500"
              }`}
            >
              {w.startDate} → {w.endDate}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* EXPORT BUTTON */}
      <View className="mt-4">
        <Pressable
          disabled={!selectedWeek || exportingWeeklyPdf}
          onPress={async () => {
            try {
              setExportingWeeklyPdf(true);

              await exportWeeklyStaffAttendance({
                fromIso: selectedWeek.startDate,
                toIso: selectedWeek.endDate,
                label: `Week ${selectedWeek.weekNumber}`,
              });
            } finally {
              setExportingWeeklyPdf(false);
            }
          }}
          className={`rounded-xl p-3 items-center justify-center ${
            selectedWeek && !exportingWeeklyPdf
              ? "bg-blue-600"
              : "bg-slate-400"
          }`}
        >
          {exportingWeeklyPdf ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-semibold">
              Export PDF
            </Text>
          )}
        </Pressable>
      </View>

      {/* STAFF LIST */}
      <Text className="text-lg font-semibold mt-6 mb-2">
        Staff ({staffRows.length})
      </Text>

      <Text className="text-ml text-slate-700 mb-2">
        P = Present • L = Late • T = Attended • A = Absent
      </Text>

      {staffRows.length === 0 ? (
        <Text className="text-slate-500">
          No data for selected week.
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
                  fromIso: selectedWeek.startDate,
                  toIso: selectedWeek.endDate,
                  title: `Week ${selectedWeek.weekNumber} Report`,
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