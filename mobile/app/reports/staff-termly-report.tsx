// app/reports/staff-termly-report.tsx
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
import { getStaffGlobalSummary } from "../../src/services/staffAttendanceSummary";
import { exportTermStaffAttendancePdf } from "../../src/services/exports/exportTermStaffAttendancePdf";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import AttendanceTotalsCards from "../../components/AttendanceTotalsCards";

export default function StaffTermlyReport() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();

  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  /* LOAD TERMS */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const t = await listTerms().catch(() => []);
        setTerms(t || []);
      } catch (e) {
        Alert.alert("Failed to load terms");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* LOAD TERMLY STAFF DATA */
  useEffect(() => {
    (async () => {
      if (!selectedTerm) {
        setRows([]);
        return;
      }

      try {
        setLoading(true);

        const summary = await getStaffGlobalSummary(
          selectedTerm.startDate,
          selectedTerm.endDate
        );

        setRows(summary || []);
      } catch (e) {
        console.error("staff termly load", e);
        setRows([]);
        Alert.alert("Failed to load staff term report");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedTerm]);

  if (adminLoading || !adminReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-300 p-3">
      <View className="flex-row items-center mb-2">
        <Pressable onPress={() => router.back()} className="p-1 mr-2">
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="text-xl font-extrabold text-slate-900">
          Termly Staff Reports
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
              {t.startDate} - {t.endDate}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* EXPORT PDF */}
      <View className="mt-3">
        <Pressable
          disabled={!selectedTerm || exportingPdf}
          onPress={async () => {
            try {
              setExportingPdf(true);
              await exportTermStaffAttendancePdf({
                fromIso: selectedTerm.startDate,
                toIso: selectedTerm.endDate,
                label: selectedTerm.name,
              });
            } finally {
              setExportingPdf(false);
            }
          }}
          className={`rounded-lg px-3 py-2.5 items-center justify-center ${
            selectedTerm && !exportingPdf
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

      {/* STAFF LIST */}
      <Text className="text-lg font-semibold mt-3 mb-1.5">
        Staff ({rows.length})
      </Text>

      {rows.length > 0 ? <AttendanceTotalsCards rows={rows} label="Staff" /> : null}
<Text className="text-ml text-slate-700 mb-2">
        P = Present - L = Late - T = Attended - A = Absent
      </Text>

      {rows.length === 0 ? (
        <Text className="text-slate-500">
          No data for selected term.
        </Text>
      ) : (
        rows.map((item) => (
          <Pressable
            key={item.staffId}
            onPress={() =>
              router.push({
                pathname: "/reports/staff/[id]",
                params: {
                  id: item.staffId,
                  fromIso: selectedTerm.startDate,
                  toIso: selectedTerm.endDate,
                  title: `${selectedTerm.name} Report`,
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
