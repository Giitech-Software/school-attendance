// app/reports/monthly-report.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { listClasses } from "../../src/services/classes";
import { listStudents } from "../../src/services/students";
import { computeAttendanceSummaryForStudent } from "../../src/services/attendanceSummary";
import { getMonthRange } from "../../src/utils/dateRanges";
import { exportMonthlyAttendancePdf } from "../../src/services/exports/exportMonthlyAttendancePdf";
import { MaterialIcons } from "@expo/vector-icons";
import { listTerms } from "../../src/services/terms";
import { intersectRanges } from "../../src/utils/dateRanges";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function MonthlyReport() {
  const router = useRouter();

  const today = new Date();
  const [year] = useState(today.getFullYear());
const [selectedMonth, setSelectedMonth] = useState<number | null>(null);


const baseMonth = useMemo(() => {
  if (selectedMonth === null) return null;
  return getMonthRange(year, selectedMonth);
}, [year, selectedMonth]);

const label = baseMonth?.label ?? "";




const [currentTerm, setCurrentTerm] = useState<any | null>(null);

const monthRange = useMemo(() => {
  if (!currentTerm || !baseMonth) return null;

  return intersectRanges(
    baseMonth.fromIso,
    baseMonth.toIso,
    currentTerm.startDate,
    currentTerm.endDate
  );
}, [baseMonth, currentTerm]);



  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<any[]>([]);
  const [exportingMonthlyPdf, setExportingMonthlyPdf] = useState(false);


  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [cls, studs] = await Promise.all([
          listClasses().catch(() => []),
          listStudents().catch(() => []),
        ]);
        setClasses(cls || []);
        setStudents(studs || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------- RESOLVE CURRENT TERM ---------------- */
useEffect(() => {
  (async () => {
    const terms = await listTerms().catch(() => []);
    const todayIso = new Date().toISOString().slice(0, 10);

    const term =
      terms.find((t) => t.isCurrent) ??
      terms.find(
        (t) => todayIso >= t.startDate && todayIso <= t.endDate
      ) ??
      null;

    setCurrentTerm(term);
  })(); 
}, []); 
 
  /* -------- FILTER STUDENTS BY CLASS -------- */
  const filteredStudents = useMemo(() => {
    if (!selectedClassKey) return students;
    return students.filter(
      (s) =>
        s.classId === selectedClassKey ||
        s.classDocId === selectedClassKey
    );
  }, [students, selectedClassKey]);

 /* -------- COMPUTE MONTH SUMMARY -------- */
useEffect(() => {
  (async () => {
    if (!monthRange || filteredStudents.length === 0) {
      setSummaries([]);
      return;
    }

    setComputing(true);

    const rows = await Promise.all(
  filteredStudents.map(async (s) => {
    const sum = await computeAttendanceSummaryForStudent(
      s.id,
      monthRange.fromIso,
      monthRange.toIso
    );

    return {
      ...sum,
      studentId: s.id, // still needed internally for routing
      studentName: s.name ?? s.displayName ?? "Unknown Student",
      displayId: s.studentId ?? s.rollNo ?? null, // <--- THIS FIXES THE DISPLAY
    };
  })
);



  
    rows.sort((a, b) => b.percentagePresent - a.percentagePresent);
    setSummaries(rows);
    setComputing(false);
  })();
}, [filteredStudents, monthRange]);


  if (loading) {
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
    <MaterialIcons
      name="arrow-back"
      size={26}
      color="#0f172a"
    />
  </Pressable>

  <Text className="text-2xl font-extrabold text-slate-900">
   Monthly Reports
  </Text>
</View>

      <Text className="text-sm text-slate-500 mt-1">{label}</Text>

      {/* -------- MONTH SELECT -------- */}
      <Text className="mt-6 mb-2 font-semibold">Select Month</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
  {MONTHS.map((m, i) => (
    <Pressable
      key={m}
      onPress={() => setSelectedMonth(i)}
      className={`p-4 mr-3 rounded-xl border ${
        selectedMonth === i
          ? "bg-blue-600 border-blue-600"
          : "bg-white"
      }`}
    >
      <Text
        className={`font-bold ${
          selectedMonth === i ? "text-white" : "text-slate-800"
        }`}
      >
        {m}
      </Text>
    </Pressable>
  ))}
</ScrollView>


      {/* -------- CLASS FILTER -------- */}
      <Text className="mt-6 mb-2 font-semibold">Filter by Class</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <Pressable
          onPress={() => setSelectedClassKey(null)}
          className={`px-4 py-2 mr-3 rounded-full ${
            selectedClassKey === null
              ? "bg-blue-600"
              : "bg-white border"
          }`}
        >
          <Text
            className={
              selectedClassKey === null
                ? "text-white font-semibold"
                : "text-slate-700"
            }
          >
            All Classes
          </Text>
        </Pressable>

        {classes.map((c) => {
          const key = c.classId ?? c.id;
          return (
            <Pressable
              key={key}
              onPress={() => setSelectedClassKey(key)}
              className={`px-4 py-2 mr-3 rounded-full ${
                selectedClassKey === key
                  ? "bg-blue-600"
                  : "bg-white border"
              }`}
            >
              <Text
                className={
                  selectedClassKey === key
                    ? "text-white font-semibold"
                    : "text-slate-700"
                }
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

<View className="mt-4">
 <Pressable
  disabled={selectedMonth === null || exportingMonthlyPdf}
  onPress={async () => {
    if (!monthRange) return;

    try {
      setExportingMonthlyPdf(true);
      await exportMonthlyAttendancePdf({
        fromIso: monthRange.fromIso,
        toIso: monthRange.toIso,
        label,
        classId: selectedClassKey ?? undefined,
      });
    } finally {
      setExportingMonthlyPdf(false);
    }
  }}
  className={`rounded-xl p-3 items-center justify-center ${
    selectedMonth !== null && !exportingMonthlyPdf
      ? "bg-blue-600"
      : "bg-slate-400"
  }`}
>
  {exportingMonthlyPdf ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <Text className="text-white font-semibold">Export PDF</Text>
  )}
</Pressable>

</View>



      {/* -------- RESULTS -------- */}
      <Text className="mt-6 mb-2 font-semibold">
        Students ({summaries.length})
      </Text>

<Text className="text-ml text-slate-700 mb-2">
  P = Present • L = Late • T = Attended • A = Absent
</Text>
      {computing ? (
        <ActivityIndicator />
      ) : summaries.length === 0 ? (
        <Text className="text-slate-500">
          No attendance data for this month.
        </Text>
      ) : (
        summaries.map((s) => (
          <Pressable
            key={s.studentId}
            onPress={() =>
  monthRange &&
  router.push({
    pathname: "/reports/student/[id]",
    params: {
      id: s.studentId,
      fromIso: monthRange.fromIso,
      toIso: monthRange.toIso,
      title: `${label} Report`,
    },
  })
}

            className="bg-white p-4 rounded-xl mb-3 shadow"
          >
           <Text className="font-semibold">
  {s.studentName}
  {s.displayId ? ` (${s.displayId})` : ""}
</Text>

<View className="flex-row justify-between mt-2">
  <Text className="text-emerald-600">
    P: {s.presentCount}
  </Text>

  <Text className="text-amber-600">
    L: {s.lateCount}
  </Text>

  <Text className="text-blue-600">
    T: {s.attendedSessions}
  </Text>

  <Text className="text-red-500">
    A: {s.absentCount}
  </Text>

  <Text className="text-slate-700">
    {s.percentagePresent.toFixed(1)}%
  </Text>
</View>

          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
