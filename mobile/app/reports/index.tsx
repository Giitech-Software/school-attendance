//app/reports/index.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
    Image,   // ✅ add this
} from "react-native";
import { useRouter, useLocalSearchParams  } from "expo-router";
import { getAttendanceSummary } from "../../src/services/attendanceSummary";
import { MaterialIcons } from "@expo/vector-icons";
import { getStaffGlobalSummary, } from "../../src/services/staffAttendanceSummary";
import useCurrentUser from "../../src/hooks/useCurrentUser";
export default function ReportsDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
const [globalSummary, setGlobalSummary] = useState<any[]>([]);
const [previewLabel, setPreviewLabel] = useState("");
const { type } = useLocalSearchParams();   // ✅ declare FIRST
const { userDoc, loading: userLoading } = useCurrentUser();

const [reportType, setReportType] = useState<"student" | "staff">("student");

// Sync route param → state
useEffect(() => {
  if (type === "staff") {
    setReportType("staff");
  } else {
    setReportType("student");
  }
}, [type]);
  /* ------------------------------------------------------------------ */
function getPreviewRange(type: "student" | "staff") {
  const today = new Date();

  // ✅ STAFF → Last 30 calendar days
  if (type === "staff") {
    const from = new Date();
    from.setDate(today.getDate() - 29);

    return {
      fromIso: from.toISOString().slice(0, 10),
      toIso: today.toISOString().slice(0, 10),
      label: "Last 30 days (preview)",
    };
  }

  // ✅ STUDENTS → Last 5 working days
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
  /* ------------------------------------------------------------------ */
  /* AGGREGATE TOTALS */
  /* ------------------------------------------------------------------ */
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
    attended, // ✅ NEW
    pct: total === 0 ? 0 : (attended / total) * 100,
  };
}, [globalSummary]);

  /* ------------------------------------------------------------------ */
  /* TILE COMPONENT */
  /* ------------------------------------------------------------------ */
  const Tile = ({
    title,
    subtitle,
    color,
    onPress,
  }: {
    title: string;
    subtitle?: string;
    color: string;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className={`mb-6 p-5 rounded-2xl shadow-lg w-full ${color}`}
      style={{ elevation: 4 }}
    >
      <Text className="text-lg font-extrabold text-white">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-white/80 mt-2">{subtitle}</Text>
      ) : null}
    </Pressable>
  );

  /* ------------------------------------------------------------------ */
  /* LOADING STATE */
  /* ------------------------------------------------------------------ */
  if (loading) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" />
    </View>
  );
}

// 🔐 ROLE PROTECTION STARTS HERE

if (userLoading) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}

if (userDoc?.role !== "admin") {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-bold text-red-600">
        Access Denied
      </Text>
      <Text className="text-sm text-slate-500 mt-2">
        You do not have permission to view reports.
      </Text>
    </View>
  );
}

  /* ------------------------------------------------------------------ */
  /* UI */
  /* ------------------------------------------------------------------ */
  return (

    <ScrollView
      className="flex-1 bg-slate-300"
      contentContainerStyle={{ padding: 16 }}
      
    >
     <View className="flex-row items-center mb-2">
  <Pressable
    onPress={() => router.back()}
    className="p-1 mr-2"
    hitSlop={8}
  >
    <MaterialIcons
      name="arrow-back"
      size={26}
      color="#0f172a"
    />
  </Pressable>


  <Text className="text-2xl font-extrabold text-slate-900">
    Reports
  </Text>
</View>
{/* Hero Image */}
<View className="bg-white -mx-4">
  <Image
    source={require("../../assets/images/attendance-report.jpg")}
    style={{ width: "100%", height: 140 }}
    resizeMode="stretch"
  />
</View>
<Text className="text-ml font-bold text-slate-800 py-4">
  Quick previews — tap a tile to open detailed reports
</Text>

<View className="flex-row mb-4">
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
      Staff Reports
    </Text>
  </Pressable>
</View>

      <View className="mt-2">
        <Tile
          title="Daily Attendance"
          subtitle="Preview by day • Last 5 school days"
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
          subtitle="Attendance grouped by school week"
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

      {/* -------------------- PREVIEW SUMMARY -------------------- */}
     <View className="mt-6 p-4 bg-white rounded-xl shadow-sm">
 <Text className="text-sm font-semibold text-slate-700">
  {previewLabel}
</Text>

  <View className="mt-3 flex-row justify-between">
    <View>
      <Text className="text-xs text-slate-500">Present</Text>
      <Text className="text-lg font-bold text-emerald-600">
        {totals.present}
      </Text>
    </View>

 {/* ✅ NEW — LATE SUMMARY */}
    <View>
      <Text className="text-xs text-slate-500">Late</Text>
      <Text className="text-lg font-bold text-amber-600">
        {totals.late}
      </Text>
    </View> 
<View>
  <Text className="text-xs text-slate-500">Attended</Text>
  <Text className="text-lg font-bold text-sky-600">
    {totals.attended}
  </Text>
</View>

    <View>
      <Text className="text-xs text-slate-500">Absent</Text>
      <Text className="text-lg font-bold text-red-500">
        {totals.absent}
      </Text>
    </View>

   

    <View>
      <Text className="text-xs text-slate-500">Attendance %</Text>
                                    <Text className="text-lg font-bold text-slate-900">
                                      {totals.pct.toFixed(1)}%
                                    </Text>
                                  </View>
                                </View>
                              </View>
                                  </ScrollView>
                                );
                              }
