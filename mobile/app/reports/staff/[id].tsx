import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { MaterialIcons } from "@expo/vector-icons";

import {
  getStaffGlobalSummary,
  getStaffAttendanceInRange,
} from "../../../src/services/staffAttendanceSummary";

import { exportStaffAttendancePdf } from "../../../src/services/exports/exportStaffAttendancePdf";

/* ------------------------------------------------------------------ */
/* UTIL: Last 5 Work Days */
/* ------------------------------------------------------------------ */
function getLast5WorkDays() {
  const arr: string[] = [];
  let cursor = new Date();

  while (arr.length < 5) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      arr.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return arr.reverse();
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */
export default function StaffDetail() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const staffId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fromIsoParam = params.fromIso as string | undefined;
  const toIsoParam = params.toIso as string | undefined;
  const titleParam = params.title as string | undefined;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [staffName, setStaffName] = useState<string>("");

  const [range, setRange] = useState<{
    fromIso: string;
    toIso: string;
  } | null>(null);

  /* ------------------------------------------------------------------ */
  /* LOAD DATA */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!staffId) return;

    (async () => {
      try {
        setLoading(true);

        /* -------- staff name -------- */
        const snap = await getDoc(doc(db, "staff", staffId));

        if (snap.exists()) {
          const data = snap.data();
          const displayName = data.name ?? "Staff";
          const displayId = data.staffId ?? "";

          setStaffName(
            displayId ? `${displayName} (${displayId})` : displayName
          );
        } else {
          setStaffName("Staff");
        }

        /* -------- date range -------- */
        let fromIso = fromIsoParam;
        let toIso = toIsoParam;

        if (!fromIso || !toIso) {
          const last5 = getLast5WorkDays();
          fromIso = last5[0];
          toIso = last5[last5.length - 1];
        }

        setRange({ fromIso, toIso });

        /* -------- summary -------- */
        const summaries = await getStaffGlobalSummary(fromIso!, toIso!);
        const s = summaries.find((x: any) => x.staffId === staffId);
        setSummary(s ?? null);

        /* -------- daily timeline -------- */
        const records = await getStaffAttendanceInRange(
          staffId,
          fromIso!,
          toIso!
        );

        setDaily(
          [...records].sort((a: any, b: any) =>
            a.date.localeCompare(b.date)
          )
        );
      } catch (e) {
        console.error("staff detail", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [staffId, fromIsoParam, toIsoParam]);

  /* ------------------------------------------------------------------ */
  /* LOADING STATE */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  /* ------------------------------------------------------------------ */
  /* SAFE SUMMARY FALLBACK */
  /* ------------------------------------------------------------------ */
  const safeSummary = summary ?? {
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    percentagePresent: 0,
  };

  const attendedCount =
    (safeSummary.presentCount ?? 0) +
    (safeSummary.lateCount ?? 0);

  /* ------------------------------------------------------------------ */
  /* UI */
  /* ------------------------------------------------------------------ */
  return (
    <View className="flex-1 p-4 bg-slate-50">
      {/* ---------- HEADER ---------- */}
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

        <Text className="text-2xl font-bold mb-1">
          {titleParam ?? "Staff Report"}
        </Text>
      </View>

      <Text className="text-lg font-semibold text-slate-700 mb-4">
        {staffName}
      </Text>

      {/* ---------- EXPORT ---------- */}
      <Pressable
        onPress={() =>
          range &&
          exportStaffAttendancePdf({
            staffId,
            fromIso: range.fromIso,
            toIso: range.toIso,
            title: titleParam ?? "Staff Attendance Report",
          })
        }
        className="bg-indigo-600 py-2 px-4 rounded-lg mb-4"
      >
        <Text className="text-white font-semibold text-center">
          Export PDF
        </Text>
      </Pressable>

      {/* ---------- SUMMARY ---------- */}
      <View className="bg-white p-4 rounded-xl mb-4 shadow">
        <Text className="font-semibold">Summary</Text>

        <View className="flex-row justify-between mt-2">
          <View>
            <Text className="text-xs text-slate-500">Present</Text>
            <Text className="text-lg font-bold text-emerald-600">
              {safeSummary.presentCount}
            </Text>
          </View>

          <View>
            <Text className="text-xs text-slate-500">Late</Text>
            <Text className="text-lg font-bold text-amber-700">
              {safeSummary.lateCount}
            </Text>
          </View>

          <View>
            <Text className="text-xs text-slate-500">Attended</Text>
            <Text className="text-lg font-bold text-sky-700">
              {attendedCount}
            </Text>
          </View>

          <View>
            <Text className="text-xs text-slate-500">Absent</Text>
            <Text className="text-lg font-bold text-red-500">
              {safeSummary.absentCount}
            </Text>
          </View>

          <View>
            <Text className="text-xs text-slate-500">Attendance %</Text>
            <Text className="text-lg font-bold">
              {safeSummary.percentagePresent.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* ---------- TIMELINE ---------- */}
      <Text className="font-semibold mb-2">
        Attendance Timeline
      </Text>

      {daily.length === 0 ? (
        <Text className="text-slate-500">
          No attendance records for this period.
        </Text>
      ) : (
        <FlatList
          data={daily}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <View className="bg-white p-3 rounded-lg mb-2 flex-row justify-between">
              <View>
                <Text className="text-slate-700">
                  {new Date(item.date).toLocaleDateString()}
                </Text>

                {item.checkInTime && (
                  <Text className="text-xs text-slate-500">
                    In:{" "}
                    {new Date(item.checkInTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}

                {item.checkOutTime && (
                  <Text className="text-xs text-slate-500">
                    Out:{" "}
                    {new Date(item.checkOutTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
              </View>

              <View className="items-end">
                <Text
                  className="font-bold"
                  style={{
                    color:
                      item.status === "absent"
                        ? "#DC2626"
                        : item.status === "late"
                        ? "#B45309"
                        : "#059669",
                  }}
                >
                  {item.status ??
                    (item.checkInTime ? "present" : "absent")}
                </Text>

                {item.biometric && (
                  <Text className="text-xs text-slate-500 mt-1">
                    Biometric
                  </Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
