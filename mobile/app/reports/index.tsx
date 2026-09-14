//app/reports/index.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
    Image,   // - add this
} from "react-native";
import { useRouter, useLocalSearchParams  } from "expo-router";
import { getAttendanceSummary } from "../../src/services/attendanceSummary";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { getStaffGlobalSummary, } from "../../src/services/staffAttendanceSummary";
import useCurrentUser from "../../src/hooks/useCurrentUser";
import { allowsStudentAndParentFeatures } from "../../src/services/tenantScope";
import AttendanceAuditPanel from "../../components/AttendanceAuditPanel";
import ImageCarousel from "../../components/ImageCarousel";
export default function ReportsDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
const [globalSummary, setGlobalSummary] = useState<any[]>([]);
const [previewLabel, setPreviewLabel] = useState("");
const { type } = useLocalSearchParams();   // - declare FIRST
const { userDoc, loading: userLoading } = useCurrentUser();
const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);
const personnelLabel = allowsSchoolFeatures ? "Staff" : userDoc?.tenantType === "company" ? "Employee" : "Personnel";

const [reportType, setReportType] = useState<"student" | "staff">("student");

// Sync route param - state
useEffect(() => {
  if (!allowsSchoolFeatures || type === "staff") {
    setReportType("staff");
  } else {
    setReportType("student");
  }
}, [allowsSchoolFeatures, type]);
  /* - */
function getPreviewRange(type: "student" | "staff") {
  const today = new Date();

  // - STAFF - Last 30 calendar days
  if (type === "staff") {
    const from = new Date();
    from.setDate(today.getDate() - 29);

    return {
      fromIso: from.toISOString().slice(0, 10),
      toIso: today.toISOString().slice(0, 10),
      label: "Last 30 days (preview)",
    };
  }

  // - STUDENTS - Last 5 working days
  const dates: Date[] = [];
  const current = new Date();

  while (dates.length < 5) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() - 1);
  }

  return {
    fromIso: dates[dates.length - 1].toISOString().slice(0, 10),
    toIso: dates[0].toISOString().slice(0, 10),
    label: "Last 5 school days (preview)",
  };
}
 useEffect(() => {
  (async () => {
    try {
      setLoading(true);

     const range = getPreviewRange(reportType);
const { fromIso, toIso } = range;
setPreviewLabel(range.label);

      if (reportType === "student") {
        const sum = await getAttendanceSummary({
          fromIso,
          toIso,
          includeStudentName: false,
        });
        setGlobalSummary(sum || []);
      } else {
        const sum = await getStaffGlobalSummary(fromIso, toIso);
        setGlobalSummary(sum || []);
      }
    } catch (e) {
      console.error("reports dashboard load", e);
      Alert.alert("Failed to load reports preview");
    } finally {
      setLoading(false);
    }
  })();
}, [reportType]);
  /* - */
  /* AGGREGATE TOTALS */
  /* - */
 const totals = useMemo(() => {
  let present = 0, absent = 0, late = 0;

  for (const r of globalSummary) {
    present += Number(r.presentCount ?? 0);
    absent += Number(r.absentCount ?? 0);
    late += Number(r.lateCount ?? 0);
  }

  const attended = present + late;
  const total = attended + absent;

  return {
    present,
    late,
    absent,
    attended, // - NEW
    pct: total === 0 ? 0 : (attended / total) * 100,
  };
}, [globalSummary]);

  /* - */
  /* TILE COMPONENT */
  /* - */
  const Tile = ({
    title,
    subtitle,
    color,
    onPress,
    hidden,
  }: {
    title: string;
    subtitle?: string;
    color: string;
    onPress?: () => void;
    hidden?: boolean;
  }) => hidden ? null : (
    <Pressable
      onPress={onPress}
      className="mb-3 min-h-[128px] w-[48.5%] justify-between rounded-2xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm"
      style={{ elevation: 2, borderLeftColor: color.includes("purple") ? "#A855F7" : color.includes("indigo") ? "#6366F1" : color.includes("teal") ? "#14B8A6" : color.includes("rose") ? "#F43F5E" : "#F97316" }}
    >
      <Text className="text-lg font-extrabold leading-6 text-slate-900">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 text-sm leading-5 text-slate-600">{subtitle}</Text>
      ) : null}
      <Text className={`mt-3 text-sm font-bold ${color.includes("purple") ? "text-purple-600" : color.includes("indigo") ? "text-indigo-600" : color.includes("teal") ? "text-teal-600" : color.includes("rose") ? "text-rose-600" : "text-orange-600"}`}>Open report  ›</Text>
    </Pressable>
  );

  /* - */
  /* LOADING STATE */
  /* - */
  if (loading) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" />
    </View>
  );
}

// - ROLE PROTECTION STARTS HERE

if (userLoading) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}

if (userDoc?.role !== "admin" && userDoc?.role !== "super_admin") {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-bold text-red-600">
        Access Denied
      </Text>
      <Text className="text-sm font-medium text-slate-700 mt-1.5">
        You do not have permission to view reports.
      </Text>
    </View>
  );
}

  /* - */
  /* UI */
  /* - */
  return (

    <ScrollView
      className="flex-1 bg-slate-100"
      contentContainerStyle={{ padding: 16 }}

    >
     <View className="-mx-4 overflow-hidden rounded-none bg-white">
       <View className="flex-row items-center border-b border-slate-700 bg-slate-900 px-4 py-3">
         <Pressable onPress={() => router.back()} className="mr-2 rounded-lg border border-white/20 p-1" hitSlop={8}>
           <MaterialIcons name="arrow-back" size={22} color="#ffffff" />
         </Pressable>
         <View>
           <Text className="text-xl font-extrabold text-white">Reports</Text>
           <Text className="mt-1 text-xs font-medium text-white/70">Quick previews - tap a tile to open detailed reports.</Text>
         </View>
       </View>
     <ImageCarousel images={[require("../../assets/images/reports-1.jpg"), require("../../assets/images/reports-2.jpg"), require("../../assets/images/reports-3.jpg"), require("../../assets/images/reports-4.jpg")]} height={300} />
     </View>

<View className="flex-row mb-3">
  {allowsSchoolFeatures ? (
  <Pressable
    onPress={() => setReportType("student")}
    className={`flex-1 py-2 rounded-l-xl ${
      reportType === "student" ? "bg-blue-600" : "bg-slate-200"
    }`}
  >
    <Text
      className={`text-center font-semibold ${
        reportType === "student" ? "text-white" : "text-slate-700"
      }`}
    >
      Student Reports
    </Text>
  </Pressable>
  ) : null}

  <Pressable
    onPress={() => setReportType("staff")}
    className={`flex-1 py-2 rounded-r-xl ${
      reportType === "staff" ? "bg-blue-600" : "bg-slate-200"
    }`}
  >
    <Text
      className={`text-center font-semibold ${
        reportType === "staff" ? "text-white" : "text-slate-700"
      }`}
    >
      {personnelLabel} Reports
    </Text>
  </Pressable>
</View>

      <View className="mt-1.5 flex-row flex-wrap justify-between">
        <Tile
          title="Daily Attendance"
          subtitle={reportType === "student" ? "Preview by day - Last 5 school days" : `Preview by day - ${personnelLabel.toLowerCase()}`}
          color="bg-purple-500"
         onPress={() =>
  router.push(
    reportType === "student"
      ? "/reports/daily-report"
      : "/reports/staff-daily-report"
  )
}

        />
        <Tile
          title="Weekly Reports"
          hidden={reportType === "student" && !allowsSchoolFeatures}
          subtitle={reportType === "student" ? "Attendance grouped by school week" : "Staff attendance grouped by week"}
          color="bg-indigo-500"
       onPress={() =>
  router.push(
    reportType === "student"
      ? "/reports/weekly-report"
      : "/reports/staff-weekly-report"
  )
}

        />
        <Tile
          title="Monthly Reports"
          subtitle="Attendance grouped by calendar month"
          color="bg-teal-500"
         onPress={() =>
  router.push(
    reportType === "student"
      ? "/reports/monthly-report"
      : "/reports/staff-monthly-report"
  )
}

        />
        <Tile
          title="Termly Reports"
          hidden={!allowsSchoolFeatures}
          subtitle="Summaries by term"
          color="bg-rose-500"
         onPress={() =>
  router.push(
    reportType === "student"
      ? "/reports/termly-report"
      : "/reports/staff-termly-report"
  )
}

        />
      </View>
        <Tile
          title="Yearly Reports"
          subtitle="Full-year attendance summaries"
          color="bg-orange-500"
          onPress={() =>
            router.push(
              reportType === "student"
                ? "/reports/yearly-report"
                : "/reports/staff-yearly-report"
            )
          }
        />

      {/* - PREVIEW SUMMARY - */}
     <AttendanceAuditPanel />
     <View className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <Text className="text-lg font-extrabold text-slate-700">
  {previewLabel}
</Text>

  <View className="mt-4 flex-row items-center rounded-2xl bg-slate-50 p-4">
    <View className="relative h-[132px] w-[132px] items-center justify-center">
      <Svg width={132} height={132} viewBox="0 0 132 132">
        <Circle cx="66" cy="66" r="50" stroke="#e2e8f0" strokeWidth="16" fill="none" />
        <Circle cx="66" cy="66" r="50" stroke="#10b981" strokeWidth="16" fill="none" strokeDasharray={`${Math.max(0, totals.present) * 3.14159} 1000`} strokeDashoffset="0" rotation="-90" origin="66, 66" />
        <Circle cx="66" cy="66" r="50" stroke="#f59e0b" strokeWidth="16" fill="none" strokeDasharray={`${Math.max(0, totals.late) * 3.14159} 1000`} strokeDashoffset={`${-Math.max(0, totals.present) * 3.14159}`} rotation="-90" origin="66, 66" />
        <Circle cx="66" cy="66" r="50" stroke="#ef4444" strokeWidth="16" fill="none" strokeDasharray={`${Math.max(0, totals.absent) * 3.14159} 1000`} strokeDashoffset={`${-(Math.max(0, totals.present) + Math.max(0, totals.late)) * 3.14159}`} rotation="-90" origin="66, 66" />
      </Svg>
      <View className="absolute items-center"><Text className="text-xl font-black text-slate-900">{totals.pct.toFixed(0)}%</Text><Text className="text-[10px] font-bold uppercase text-slate-500">attended</Text></View>
    </View>
    <View className="ml-4 flex-1 gap-2">
      {[['Present', totals.present, 'bg-emerald-500'], ['Late', totals.late, 'bg-amber-500'], ['Absent', totals.absent, 'bg-red-500']].map(([label, value, color]) => <View key={String(label)} className="flex-row items-center justify-between"><View className="flex-row items-center"><View className={`mr-2 h-2.5 w-2.5 rounded-full ${color}`} /><Text className="text-xs font-bold text-slate-600">{label}</Text></View><Text className="text-sm font-black text-slate-900">{String(value)}</Text></View>)}
    </View>
  </View>

  <View className="mt-3 flex-row flex-wrap justify-between">
    <View className="mb-3 w-[48%] rounded-xl border border-emerald-100 border-l-4 bg-emerald-50 p-3">
      <Text className="text-base font-semibold text-slate-500">Present</Text>
      <Text className="mt-1 text-2xl font-extrabold text-emerald-600">
        {totals.present}
      </Text>
    </View>

 {/* - NEW - LATE SUMMARY */}
    <View className="mb-3 w-[48%] rounded-xl border border-amber-100 border-l-4 bg-amber-50 p-3">
      <Text className="text-base font-semibold text-slate-500">Late</Text>
      <Text className="mt-1 text-2xl font-extrabold text-amber-600">
        {totals.late}
      </Text>
    </View>
<View className="mb-3 w-[48%] rounded-xl border border-sky-100 border-l-4 bg-sky-50 p-3">
  <Text className="text-base font-semibold text-slate-500">Attended</Text>
  <Text className="mt-1 text-2xl font-extrabold text-sky-600">
    {totals.attended}
  </Text>
</View>

    <View className="mb-3 w-[48%] rounded-xl border border-red-100 border-l-4 bg-red-50 p-3">
      <Text className="text-base font-semibold text-slate-500">Absent</Text>
      <Text className="mt-1 text-2xl font-extrabold text-red-500">
        {totals.absent}
      </Text>
    </View>



    <View className="w-full rounded-xl border border-slate-200 border-l-4 border-l-slate-500 bg-slate-50 p-3">
      <Text className="text-base font-semibold text-slate-500">Attendance %</Text>
                                    <Text className="mt-1 text-2xl font-extrabold text-slate-900">
                                      {totals.pct.toFixed(1)}%
                                    </Text>
                                  </View>
                                </View>
                              </View>
                                  </ScrollView>
                                );
                              }
