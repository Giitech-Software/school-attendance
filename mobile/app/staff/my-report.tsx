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
import useCurrentUser from "../../src/hooks/useCurrentUser";
import { allowsStudentAndParentFeatures } from "../../src/services/tenantScope";
import Svg, { Circle } from "react-native-svg";
import ImageCarousel from "../../components/ImageCarousel";

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
  const { userDoc } = useCurrentUser();
  const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [termSummary, setTermSummary] = useState<any>(null);
  const [yearSummary, setYearSummary] = useState<any>(null);
  const [termLabel, setTermLabel] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any | null>(null);
  const [reportMode, setReportMode] = useState<"last30" | "week" | "term" | "year">("last30");
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

        const year = new Date().getFullYear();
        const yearRecords = await getStaffAttendanceInRange(staffId, `${year}-01-01`, `${year}-12-31`);
        setYearSummary(buildStaffSummary(yearRecords));

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

  async function loadRange(mode: "term" | "year") {
    if (!staff?.id) return;
    const year = new Date().getFullYear();
    const fromIso = mode === "term" && termLabel ? termLabel.split(": ")[1]?.split(" to ")[0] : `${year}-01-01`;
    const toIso = mode === "term" && termLabel ? termLabel.split(" to ")[1] : `${year}-12-31`;
    if (!fromIso || !toIso) return;
    setReportMode(mode);
    setLoading(true);
    try {
      const rows = await getStaffAttendanceInRange(staff.id, fromIso, toIso);
      setSummary(buildStaffSummary(rows));
      setRecords([...rows].sort((a, b) => b.date.localeCompare(a.date)));
      setEmptyMessage(`No attendance records for the ${mode}.`);
    } finally { setLoading(false); }
  }

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
      <View className="-mx-4 mb-0 flex-row items-center bg-slate-900 px-4 py-3">
        <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
          <MaterialIcons name="arrow-back" size={26} color="#ffffff" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-white">My Report</Text>
      </View>
      <View className="-mx-4 -mt-0.5 m-0 p-0">
        <ImageCarousel images={[require("../../assets/images/reports-1.jpg"), require("../../assets/images/reports-2.jpg"), require("../../assets/images/reports-3.jpg"), require("../../assets/images/reports-4.jpg")]} height={220} />
      </View>

      <View className="bg-white rounded-2xl p-5 shadow mb-4">
        <Text className="text-lg font-bold text-slate-900">{staff.name}</Text>
        <Text className="text-slate-500 mt-1">
          {reportMode === "week" && selectedWeek
            ? `Week ${selectedWeek.weekNumber}: ${selectedWeek.startDate} to ${selectedWeek.endDate}`
            : reportMode === "term" ? termLabel ?? "Current term" : reportMode === "year" ? `Year ${new Date().getFullYear()}` : "Last 30 days"}
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

        {allowsSchoolFeatures && termLabel ? <Pressable onPress={() => loadRange("term")} className={`h-8 px-3 mr-2 rounded-lg border items-center justify-center ${reportMode === "term" ? "bg-blue-600 border-blue-600" : "bg-white border-slate-200"}`}><Text className={`text-xs font-bold ${reportMode === "term" ? "text-white" : "text-slate-800"}`}>Term</Text></Pressable> : null}
        <Pressable onPress={() => loadRange("year")} className={`h-8 px-3 mr-2 rounded-lg border items-center justify-center ${reportMode === "year" ? "bg-blue-600 border-blue-600" : "bg-white border-slate-200"}`}><Text className={`text-xs font-bold ${reportMode === "year" ? "text-white" : "text-slate-800"}`}>Year</Text></Pressable>

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

      <View className="bg-white rounded-2xl p-4 mb-4 shadow">
        <Text className="text-base font-extrabold text-slate-900 mb-3">Attendance distribution</Text>
        <View className="flex-row items-center">
          <AttendanceDonut summary={safeSummary} />
          <View className="ml-5 gap-2"><LegendDot color="#10B981" label={`Present: ${safeSummary.presentCount}`} /><LegendDot color="#F59E0B" label={`Late: ${safeSummary.lateCount}`} /><LegendDot color="#EF4444" label={`Absent: ${safeSummary.absentCount}`} /></View>
        </View>
      </View>

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

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <View className="flex-row items-start justify-between mb-3">
          <View><Text className="font-bold text-slate-900">Year Attendance</Text><Text className="text-xs text-slate-500 mt-1">Calendar year {new Date().getFullYear()}</Text></View>
          <Text className="bg-sky-50 text-sky-700 font-extrabold px-3 py-2 rounded-xl">{Number((yearSummary ?? {}).percentagePresent ?? 0).toFixed(1)}%</Text>
        </View>
        <View className="flex-row justify-between">
          {[["Present", (yearSummary ?? {}).presentCount ?? 0, "text-emerald-600"], ["Late", (yearSummary ?? {}).lateCount ?? 0, "text-amber-700"], ["Attended", (yearSummary ?? {}).attendedSessions ?? 0, "text-sky-700"], ["Absent", (yearSummary ?? {}).absentCount ?? 0, "text-red-600"]].map(([label, value, tone]) => <View key={label as string}><Text className="text-xs text-slate-500">{label}</Text><Text className={`text-lg font-bold ${tone}`}>{value}</Text></View>)}
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return <View className="flex-row items-center"><View style={{ backgroundColor: color }} className="h-3 w-3 rounded-full mr-2" /><Text className="text-sm font-semibold text-slate-700">{label}</Text></View>;
}

function AttendanceDonut({ summary }: { summary: any }) {
  const total = Math.max(1, (summary.presentCount ?? 0) + (summary.lateCount ?? 0) + (summary.absentCount ?? 0));
  const circumference = 2 * Math.PI * 42;
  const segments = [{ value: summary.presentCount ?? 0, color: "#10B981" }, { value: summary.lateCount ?? 0, color: "#F59E0B" }, { value: summary.absentCount ?? 0, color: "#EF4444" }];
  let offset = 0;
  return <Svg width="108" height="108" viewBox="0 0 108 108"><Circle cx="54" cy="54" r="42" stroke="#E2E8F0" strokeWidth="14" fill="none" />{segments.map((segment) => { const length = circumference * segment.value / total; const circle = <Circle key={segment.color} cx="54" cy="54" r="42" stroke={segment.color} strokeWidth="14" fill="none" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" transform="rotate(-90 54 54)" />; offset += length; return circle; })}</Svg>;
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
