// app/reports/weekly-report.tsx
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

import { listWeeks } from "../../src/services/weeks";
import { listClasses } from "../../src/services/classes";
import {
  getAttendanceSummary,
  computeClassSummary,
} from "../../src/services/attendanceSummary";
import { listStudents } from "../../src/services/students";
import { exportWeeklyAttendancePdf } from "../../src/services/exports/exportWeeklyAttendancePdf";
import { MaterialIcons } from "@expo/vector-icons";
import { listTerms } from "../../src/services/terms";


/**
 * Weekly report
 * - Uses auto-generated weeks
 * - All students OR filter by class
 * - Tap student → opens student detail with week range
 */

export default function WeeklyReport() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);
  const [studentRows, setStudentRows] = useState<any[]>([]);
  const [exportingWeeklyPdf, setExportingWeeklyPdf] = useState(false);

  /* ------------------------------------------------------------------ */
/* LOAD WEEKS + CLASSES + CURRENT TERM */
/* ------------------------------------------------------------------ */
useEffect(() => {
  (async () => {
    try {
      setLoading(true);

      // 1️⃣ fetch terms and classes
      const [terms, cls] = await Promise.all([
        listTerms().catch(() => []),
        listClasses().catch(() => []),
      ]);

      // 2️⃣ find current term
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
        setClasses(cls || []);
        setSelectedWeek(null);
        return;
      }

      // 3️⃣ fetch weeks only for current term
      const w = await listWeeks(currentTerm.id).catch(() => []);

      setWeeks(w || []);
      setClasses(cls || []);

      // 4️⃣ auto-select current week within this term
      const currentWeek =
  w.find((wk) => nowIso >= wk.startDate && nowIso <= wk.endDate) ??
  w[w.length - 1] ??
  null;

setSelectedWeek(null);


    } catch (e) {
      console.error("load weeks/classes", e);
      Alert.alert("Failed to load weeks or classes");
    } finally {
      setLoading(false);
    }
  })();
}, []);


  /* ------------------------------------------------------------------ */
  /* SORT WEEKS */
  /* ------------------------------------------------------------------ */
  const sortedWeeks = useMemo(() => {
    return [...weeks].sort(
      (a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
    );
  }, [weeks]);

  /* ------------------------------------------------------------------ */
  /* LOAD WEEKLY DATA */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
  if (!selectedWeek) {
    setStudentRows([]);
    return;
  }

  (async () => {
    try {
      setLoading(true);
      const fromIso = selectedWeek.startDate;
      const toIso = selectedWeek.endDate;

      let summaryWithNames: any[] = [];

      if (selectedClassKey) {
        // ✅ Fetch only this class with names
        summaryWithNames = await getAttendanceSummary({
          fromIso,
          toIso,
          classId: selectedClassKey,
          includeStudentName: true,
        });
      } else {
        // ✅ All classes
        summaryWithNames = await getAttendanceSummary({
          fromIso,
          toIso,
          includeStudentName: true,
        });
      }

      setStudentRows(summaryWithNames || []);
    } catch (e) {
      console.error("weekly load", e);
      Alert.alert("Failed to load weekly report");
      setStudentRows([]);
    } finally {
      setLoading(false);
    }
  })();
}, [selectedWeek, selectedClassKey]);


  /* ------------------------------------------------------------------ */
  /* LOADING STATE */
  /* ------------------------------------------------------------------ */
  if (loading && !selectedWeek) {
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
    <MaterialIcons
      name="arrow-back"
      size={26}
      color="#0f172a"
    />
  </Pressable>

  <Text className="text-2xl font-extrabold text-slate-900">
  Weekly Reports
  </Text>
</View>


      {/* WEEK SELECT */}
      <Text className="text-sm text-slate-600 mb-2">Select week</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
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

      {/* CLASS FILTER */}
      <Text className="text-sm text-slate-600 mt-5 mb-2">
        Filter by class
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <Pressable
          onPress={() => setSelectedClassKey(null)}
          className={`px-4 py-2 mr-2 rounded-full ${
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
            All classes
          </Text>
        </Pressable>

        {classes.map((c) => {
          const key = c.classId ?? c.id;
          return (
            <Pressable
              key={key}
              onPress={() => setSelectedClassKey(key)}
              className={`px-4 py-2 mr-2 rounded-full ${
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

      {/* -------- WEEKLY EXPORT (PDF ONLY) -------- */}
      <View className="mt-4">
        <Pressable
          disabled={!selectedWeek || exportingWeeklyPdf}
          onPress={async () => {
            try {
              setExportingWeeklyPdf(true);
              await exportWeeklyAttendancePdf({
                fromIso: selectedWeek.startDate,
                toIso: selectedWeek.endDate,
                label: `Week ${selectedWeek.weekNumber}`,
                classId: selectedClassKey ?? undefined,
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
            <Text className="text-white font-semibold">Export PDF</Text>
          )}
        </Pressable>
      </View>

      {/* STUDENTS */}
      <Text className="text-lg font-semibold mt-6 mb-2">
        Students ({studentRows.length})
      </Text>

<Text className="text-ml text-slate-700 mb-2">
  P = Present • L = Late • T = Attended • A = Absent
</Text>
      {studentRows.length === 0 ? (
        <Text className="text-slate-500">
          No data for selected week / class.
        </Text>
      ) : (
        studentRows.map((item) => (
          <Pressable
            key={item.studentId}
            onPress={() =>
              router.push({
                pathname: `/reports/student/[id]`,
                params: {
                  id: item.studentId,
                  fromIso: selectedWeek.startDate,
                  toIso: selectedWeek.endDate,
                  title: `Week ${selectedWeek.weekNumber} Report`,
                },
              })
            }
            className="bg-white p-4 rounded-xl mb-3 shadow"
          >
         <Text className="font-semibold">
  {item.studentName}
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
