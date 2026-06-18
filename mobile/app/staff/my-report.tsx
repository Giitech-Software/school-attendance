import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useCurrentStaff } from "../../src/hooks/useCurrentStaff";
import { getStaffAttendanceInRange } from "../../src/services/staffAttendanceSummary";
import { listTerms } from "../../src/services/terms";
import { listWeeks } from "../../src/services/weeks";

function getLast30Days() {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 29);

  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: today.toISOString().slice(0, 10),
  };
}

export default function MyStaffReport() {
  const router = useRouter();
  const { staff, loading: staffLoading } = useCurrentStaff();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [termSummary, setTermSummary] = useState<any>(null);
  const [termLabel, setTermLabel] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any | null>(null);
  const [reportMode, setReportMode] = useState<"last30" | "week">("last30");
  const [emptyMessage, setEmptyMessage] = useState(
    "No attendance records in the last 30 days."
  );

  useEffect(() => {
    if (staffLoading) return;

    if (!staff?.id) {
      setLoading(false);
      return;
    }

    const staffId = staff.id;

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
          setWeeks([]);
          setSelectedWeek(null);
          setTermSummary(null);
          setTermLabel(null);
        } else {
          setTermLabel(
            `${currentTerm.name}: ${currentTerm.startDate} to ${currentTerm.endDate}`
          );
          const termWeeks = await listWeeks(currentTerm.id).catch(() => []);
          const sortedWeeks = [...termWeeks].sort(
            (a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
          );

          setWeeks(sortedWeeks);
          setSelectedWeek(
            sortedWeeks.find(
              (week) => nowIso >= week.startDate && nowIso <= week.endDate
            ) ??
              sortedWeeks[0] ??
              null
          );

          const termRecords = await getStaffAttendanceInRange(
            staffId,
            currentTerm.startDate,
            currentTerm.endDate
          );
          setTermSummary(buildStaffSummary(termRecords));
        }

        const range = getLast30Days();
        const staffRecords = await getStaffAttendanceInRange(
          staffId,
          range.fromIso,
          range.toIso
        );

        setSummary(buildStaffSummary(staffRecords));
        setRecords(
          [...staffRecords].sort((a, b) => b.date.localeCompare(a.date))
        );
        setEmptyMessage("No attendance records in the last 30 days.");
      } catch (error) {
        console.error("my staff report", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [staff?.id, staffLoading]);

  useEffect(() => {
    if (!staff?.id || reportMode !== "week" || !selectedWeek) return;

    const staffId = staff.id;

    (async () => {
      try {
        setLoading(true);
        const staffRecords = await getStaffAttendanceInRange(
          staffId,
          selectedWeek.startDate,
          selectedWeek.endDate
        );

        setSummary(buildStaffSummary(staffRecords));
        setRecords(
          [...staffRecords].sort((a, b) => b.date.localeCompare(a.date))
        );
        setEmptyMessage("No attendance records for selected week.");
      } catch (error) {
        console.error("my staff report week", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedWeek?.id, reportMode]);

  if (staffLoading || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  if (!staff) {
    return (
      <View className="flex-1 bg-slate-50 p-4">
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">My Report</Text>
        </View>

        <View className="flex-1 items-center justify-center px-2">
          <MaterialIcons name="badge" size={48} color="#64748B" />
          <Text className="text-lg font-semibold text-slate-800 mt-4">
            Staff profile not linked
          </Text>
          <Text className="text-center text-slate-500 mt-2">
            Ask an administrator to link your account to a staff record.
          </Text>
        </View>
      </View>
    );
  }

  const safeSummary = summary ?? {
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    attendedSessions: 0,
    percentagePresent: 0,
  };
  const safeTermSummary = termSummary ?? {
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    attendedSessions: 0,
    percentagePresent: 0,
  };
  const attendedCount =
    safeSummary.attendedSessions ??
    (safeSummary.presentCount ?? 0) + (safeSummary.lateCount ?? 0);
  const termAttendedCount =
    safeTermSummary.attendedSessions ??
    (safeTermSummary.presentCount ?? 0) + (safeTermSummary.lateCount ?? 0);

  return (
    <View className="flex-1 bg-slate-300 p-4">
      <View className="flex-row items-center mb-4">
        <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
          <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-slate-900">My Report</Text>
      </View>

      <View className="bg-white rounded-2xl p-5 shadow mb-4">
        <Text className="text-lg font-bold text-slate-900">{staff.name}</Text>
        <Text className="text-slate-500 mt-1">
          {reportMode === "week" && selectedWeek
            ? `Week ${selectedWeek.weekNumber}: ${selectedWeek.startDate} to ${selectedWeek.endDate}`
            : "Last 30 days"}
        </Text>
      </View>

      <Text className="text-sm text-slate-700 mb-2">Report period</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
        contentContainerStyle={{ alignItems: "center" }}
        style={{ flexGrow: 0, height: 32 }}
      >
        <Pressable
          onPress={async () => {
            if (!staff?.id) return;

            try {
              setReportMode("last30");
              setLoading(true);
              const range = getLast30Days();
              const staffRecords = await getStaffAttendanceInRange(
                staff.id,
                range.fromIso,
                range.toIso
              );

              setSummary(buildStaffSummary(staffRecords));
              setRecords(
                [...staffRecords].sort((a, b) => b.date.localeCompare(a.date))
              );
              setEmptyMessage("No attendance records in the last 30 days.");
            } catch (error) {
              console.error("my staff report last 30 days", error);
            } finally {
              setLoading(false);
            }
          }}
          className={`h-8 px-3 mr-2 rounded-lg border items-center justify-center ${
            reportMode === "last30"
              ? "bg-blue-600 border-blue-600"
              : "bg-white border-slate-200"
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              reportMode === "last30" ? "text-white" : "text-slate-800"
            }`}
          >
            Last 30 days
          </Text>
        </Pressable>

        {weeks.map((week) => (
          <Pressable
            key={week.id}
            onPress={() => {
              setSelectedWeek(week);
              setReportMode("week");
            }}
            className={`h-8 px-3 mr-2 rounded-lg border items-center justify-center ${
              reportMode === "week" && selectedWeek?.id === week.id
                ? "bg-blue-600 border-blue-600"
                : "bg-white border-slate-200"
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                reportMode === "week" && selectedWeek?.id === week.id
                  ? "text-white"
                  : "text-slate-800"
              }`}
            >
              Week {week.weekNumber}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-slate-500">Present</Text>
            <Text className="text-xl font-bold text-emerald-600">{safeSummary.presentCount}</Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Late</Text>
            <Text className="text-xl font-bold text-amber-700">{safeSummary.lateCount}</Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Attended</Text>
            <Text className="text-xl font-bold text-sky-700">{attendedCount}</Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Absent</Text>
            <Text className="text-xl font-bold text-red-600">{safeSummary.absentCount}</Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Attendance</Text>
            <Text className="text-xl font-bold text-slate-900">
              {Number(safeSummary.percentagePresent ?? 0).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1 pr-3">
            <Text className="font-bold text-slate-900">Term Attendance</Text>
            <Text className="text-xs text-slate-500 mt-1">
              {termLabel ?? "No current term has been set."}
            </Text>
          </View>
          <View className="bg-emerald-50 px-3 py-2 rounded-xl">
            <Text className="text-emerald-700 font-extrabold">
              {Number(safeTermSummary.percentagePresent ?? 0).toFixed(1)}%
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-slate-500">Present</Text>
            <Text className="text-lg font-bold text-emerald-600">
              {safeTermSummary.presentCount}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Late</Text>
            <Text className="text-lg font-bold text-amber-700">
              {safeTermSummary.lateCount}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Attended</Text>
            <Text className="text-lg font-bold text-sky-700">
              {termAttendedCount}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Absent</Text>
            <Text className="text-lg font-bold text-red-600">
              {safeTermSummary.absentCount}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Attendance</Text>
            <Text className="text-lg font-bold text-slate-900">
              {Number(safeTermSummary.percentagePresent ?? 0).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      <Text className="font-semibold text-slate-900 mb-2">Timeline</Text>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id ?? item.date}
        ListEmptyComponent={
          <Text className="text-center text-slate-500 mt-8">
            {emptyMessage}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 mb-3 flex-row justify-between">
            <View>
              <Text className="font-semibold text-slate-800">
                {new Date(item.date).toLocaleDateString()}
              </Text>
              <Text className="text-xs text-slate-500 mt-1">
                In:{" "}
                {item.checkInTime
                  ? new Date(item.checkInTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </Text>
              <Text className="text-xs text-slate-500">
                Out:{" "}
                {item.checkOutTime
                  ? new Date(item.checkOutTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-bold text-slate-900">
                {item.status ?? (item.checkInTime ? "present" : "absent")}
              </Text>
              <Text className="text-xs text-slate-500 mt-1">
                {item.method ?? "manual"}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function buildStaffSummary(records: any[]) {
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  records.forEach((record) => {
    const status = record.status ?? (record.checkInTime ? "present" : "absent");

    if (status === "late") lateCount += 1;
    else if (status === "absent") absentCount += 1;
    else presentCount += 1;
  });

  const attendedSessions = presentCount + lateCount;
  const totalDays = attendedSessions + absentCount;
  const score = presentCount + lateCount * 0.5;
  const percentagePresent =
    totalDays === 0 ? 0 : Number(((score / totalDays) * 100).toFixed(2));

  return {
    presentCount,
    lateCount,
    absentCount,
    attendedSessions,
    totalDays,
    percentagePresent,
  };
}
