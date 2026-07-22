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
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import AttendanceTotalsCards from "../../components/AttendanceTotalsCards";

import { listWeeks } from "../../src/services/weeks";
import { listTerms } from "../../src/services/terms";
import { getStaffGlobalSummary } from "../../src/services/staffAttendanceSummary";
import { exportWeeklyStaffAttendance } from "../../src/services/exports/exportWeeklyStaffAttendance";
import useCurrentUser from "../../src/hooks/useCurrentUser";
import { allowsStudentAndParentFeatures } from "../../src/services/tenantScope";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCalendarWeeks(count = 8) {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(today.getDate() + diffToMonday);

  return Array.from({ length: count }, (_, index) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      id: `calendar-${isoDate(start)}`,
      weekNumber: count - index,
      startDate: isoDate(start),
      endDate: isoDate(end),
    };
  }).reverse();
}

export default function StaffWeeklyReport() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const { userDoc } = useCurrentUser();
  const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);

  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any | null>(null);
  const [staffRows, setStaffRows] = useState<any[]>([]);
  const [exportingWeeklyPdf, setExportingWeeklyPdf] = useState(false);

  /* LOAD WEEKS */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        if (!allowsSchoolFeatures) {
          const calendarWeeks = getCalendarWeeks();
          setWeeks(calendarWeeks);
          setSelectedWeek(calendarWeeks[calendarWeeks.length - 1] ?? null);
          return;
        }

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
  }, [allowsSchoolFeatures]);

  const sortedWeeks = useMemo(() => {
    return [...weeks].sort((a, b) => String(a.startDate ?? "").localeCompare(String(b.startDate ?? "")));
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

  if (adminLoading || !adminReady || (loading && !selectedWeek)) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-300 p-3">
      <View className="flex-row items-center mb-2">
        <Pressable
          onPress={() => router.back()}
          className="p-1 mr-2"
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>

        <Text className="text-xl font-extrabold text-slate-900">
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
            className={`px-3 py-2 mr-2 rounded-lg border ${
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
              {w.startDate} - {w.endDate}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* EXPORT BUTTON */}
      <View className="mt-3">
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
          className={`rounded-lg px-3 py-2.5 items-center justify-center ${
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
      <Text className="text-lg font-semibold mt-3 mb-1.5">
        Staff ({staffRows.length})
      </Text>

      {staffRows.length > 0 ? <AttendanceTotalsCards rows={staffRows} label="Staff" /> : null}
<Text className="text-ml text-slate-700 mb-2">
        P = Present - L = Late - T = Attended - A = Absent
      </Text>

      {loading ? (
        <ActivityIndicator className="mt-4" />
      ) : staffRows.length === 0 ? (
        <Text className="text-slate-500 mt-3">
          No weekly attendance records found.
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
                  fromIso: selectedWeek.startDate,
                  toIso: selectedWeek.endDate,
                  title: `Week ${selectedWeek.weekNumber} Report`,
                },
              })
            }
            className="bg-white px-3 py-2 rounded-md mb-2 shadow"
          >
            <Text className="font-semibold">
              {item.staffName}
              {item.displayId ? ` (${item.displayId})` : ""}
            </Text>

            <View className="flex-row justify-between mt-1.5">
              <Text className="text-emerald-600">P: {item.presentCount}</Text>
              <Text className="text-amber-600">L: {item.lateCount}</Text>
              <Text className="text-sky-700">T: {item.attendedSessions}</Text>
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