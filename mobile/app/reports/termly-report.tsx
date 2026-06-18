// app/reports/termly-report.tsx
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
import { listTerms } from "../../src/services/terms";
import { listClasses } from "../../src/services/classes";
import { getAttendanceSummary } from "../../src/services/attendanceSummary";
import { exportTermAttendancePdf } from "../../src/services/exports/exportTermAttendancePdf";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";

/**
 * Termly report
 * - Term → Class → Students
 * - PDF export only
 */

export default function TermlyReport() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();

  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<any | null>(null);

  /**
   * selectedClassKey = attendance.classId (short key)
   * null = all classes
   */
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [exportingTermPdf, setExportingTermPdf] = useState(false);

  /* ------------------------------------------------------------------ */
  /* LOAD TERMS + CLASSES */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [t, c] = await Promise.all([
          listTerms().catch(() => []),
          listClasses().catch(() => []),
        ]);
        setTerms(t || []);
        setClasses(c || []);
      } catch (e) {
        console.error("load terms/classes", e);
        Alert.alert("Failed to load terms or classes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* LOAD TERMLY DATA */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      if (!selectedTerm) {
        setRows([]);
        return;
      }

      try {
        setLoading(true);

        const fromIso = selectedTerm.startDate;
        const toIso = selectedTerm.endDate;

        const list = await getAttendanceSummary({
          fromIso,
          toIso,
          classId: selectedClassKey ?? undefined,
          includeStudentName: true,
        });

        setRows(list || []);
      } catch (e) {
        console.error("termly load", e);
        setRows([]);
        Alert.alert("Failed to load termly report");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedTerm, selectedClassKey]);

  if (adminLoading || !adminReady || loading) {
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
    <ScrollView className="flex-1 bg-slate-300 p-3">
     <View className="flex-row items-center mb-2">
  <Pressable
    onPress={() => router.back()}
    className="p-1 mr-2"
    hitSlop={8}
  >
    <MaterialIcons
      name="arrow-back"
      size={24}
      color="#0f172a"
    />
  </Pressable>

  <Text className="text-xl font-extrabold text-slate-900">
    Termly Reports
  </Text>
</View>

      {/* TERM SELECT */}
      <Text className="text-sm text-slate-600 mb-2">Select term</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {terms.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setSelectedTerm(t)}
            className={`px-3 py-2 mr-2 rounded-lg border ${
              selectedTerm?.id === t.id
                ? "bg-blue-600 border-blue-600"
                : "bg-white"
            }`}
          >
            <Text
              className={`font-bold ${
                selectedTerm?.id === t.id
                  ? "text-white"
                  : "text-slate-800"
              }`}
            >
              {t.name}
            </Text>
            <Text
              className={`text-xs ${
                selectedTerm?.id === t.id
                  ? "text-white/80"
                  : "text-slate-500"
              }`}
            >
              {t.startDate} → {t.endDate}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* CLASS FILTER */}
      <Text className="text-sm text-slate-600 mt-3 mb-1.5">
        Filter by class
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Pressable
          onPress={() => setSelectedClassKey(null)}
          className={`px-3 py-1.5 mr-2 rounded-full ${
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
              className={`px-3 py-1.5 mr-2 rounded-full ${
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

      {/* -------- TERM EXPORT (PDF ONLY) -------- */}
      <View className="mt-3">
        <Pressable
          disabled={!selectedTerm || exportingTermPdf}
          onPress={async () => {
            try {
              setExportingTermPdf(true);
              await exportTermAttendancePdf({
                termId: selectedTerm.id,
                classId: selectedClassKey ?? undefined,
              });
            } finally {
              setExportingTermPdf(false);
            }
          }}
          className={`rounded-lg px-3 py-2.5 items-center justify-center ${
            selectedTerm && !exportingTermPdf
              ? "bg-blue-600"
              : "bg-slate-400"
          }`}
        >
          {exportingTermPdf ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Export PDF</Text>
          )}
        </Pressable>
      </View>

      {/* STUDENTS */}
      <Text className="text-lg font-semibold mt-3 mb-1.5">
        Students ({rows.length})
      </Text>
<Text className="text-ml text-slate-700 mb-2">
  P = Present • L = Late • T = Attended • A = Absent
</Text>

      {rows.length === 0 ? (
        <Text className="text-slate-500">
          No data for selected term / class.
        </Text>
      ) : (
        rows.map((item) => (
          <Pressable
            key={item.studentId}
            onPress={() =>
              router.push({
                pathname: "/reports/student/[id]",
                params: {
                  id: item.studentId,
                  fromIso: selectedTerm.startDate,
                  toIso: selectedTerm.endDate,
                  title: `${selectedTerm.name} Report`,
                },
              })
            }
            className="bg-white px-3 py-2 rounded-md mb-2 shadow"
          >
            <Text className="font-semibold">
  {item.studentName}
  {item.displayId ? ` (${item.displayId})` : ""}
</Text>


            <View className="flex-row justify-between mt-1.5">
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


