//a
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
import { listClasses } from "../../src/services/classes";
import { getAttendanceSummary } from "../../src/services/attendanceSummary";
import { exportDailyAttendancePdf } from "../../src/services/exports/exportDailyAttendancePdf";
import { MaterialIcons } from "@expo/vector-icons";
/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

/** Get last N school days (Mon–Fri) */
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

export default function DailyReport() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<string[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  /**
   * selectedClassKey = attendance.classId (short key)
   * null = all classes
   */
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);

  const [studentRows, setStudentRows] = useState<any[]>([]);

  /* ------------------------------------------------------------------ */
  /* LOAD DAYS + CLASSES */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    setDays(getLastNSchoolDays(5));

    (async () => {
      try {
        setLoading(true);
        const cls = await listClasses().catch(() => []);
        setClasses(cls || []);
      } catch (e) {
        console.error("load classes", e);
        Alert.alert("Failed to load classes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* LOAD DAILY DATA */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      if (!selectedDay) {
        setStudentRows([]);
        return;
      }

      try {
        setLoading(true);

        const rows = await getAttendanceSummary({
          fromIso: selectedDay,
          toIso: selectedDay,
          classId: selectedClassKey ?? undefined,
          includeStudentName: true,
        });

        setStudentRows(rows || []);
      } catch (e) {
        console.error("daily load", e);
        setStudentRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDay, selectedClassKey]);

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
    <MaterialIcons
      name="arrow-back"
      size={26}
      color="#0f172a"
    />
  </Pressable>

  <Text className="text-2xl font-extrabold text-slate-900">
  Daily Attendance
  </Text>
</View>


      {/* -------------------- DAY SELECT -------------------- */}
      <Text className="text-sm text-slate-600 mb-2">
        Select day
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((d) => (
          <Pressable
            key={d}
            onPress={() => setSelectedDay(d)}
            className={`p-4 mr-3 rounded-xl border ${
              selectedDay === d
                ? "bg-blue-600 border-blue-600"
                : "bg-white"
            }`}
          >
            <Text
              className={`font-bold ${
                selectedDay === d
                  ? "text-white"
                  : "text-slate-800"
              }`}
            >
              {new Date(d).toLocaleDateString()}
            </Text>
            <Text
              className={`text-xs ${
                selectedDay === d
                  ? "text-white/80"
                  : "text-slate-500"
              }`}
            >
              {d}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* -------------------- CLASS FILTER -------------------- */}
      <Text className="text-sm text-slate-600 mt-5 mb-2">
        Filter by class
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

      {/* -------- DAILY EXPORT (PDF ONLY) -------- */}
      <View className="mt-4 mb-4">
        <Pressable
          disabled={!selectedDay || exportingPdf}
          onPress={async () => {
            try {
              setExportingPdf(true);
              await exportDailyAttendancePdf({
                dateIso: selectedDay!,
                classId: selectedClassKey,
              });
            } catch {
              Alert.alert("Export failed", "Unable to export PDF");
            } finally {
              setExportingPdf(false);
            }
          }}
          className={`px-4 py-3 rounded-xl items-center justify-center ${
            selectedDay && !exportingPdf
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

      {/* -------------------- STUDENTS -------------------- */}
      <Text className="text-lg font-semibold mt-6 mb-2">
        Students ({studentRows.length})
      </Text>

<Text className="text-ml text-slate-700 mb-2">
  P = Present • L = Late • A = Absent
</Text>
      {studentRows.length === 0 ? (
        <Text className="text-slate-500">
          No attendance records for this day.
        </Text>
      ) : (
        studentRows.map((item) => (
          <Pressable
            key={item.studentId}
            onPress={() =>
              router.push({
                pathname: "/reports/student/[id]",
                params: {
                  id: item.studentId,
                  fromIso: selectedDay!,
                  toIso: selectedDay!,
                  title: `Daily Report – ${selectedDay}`,
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