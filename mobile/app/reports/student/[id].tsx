//mobile/app/reports/student/[id].tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList } from "react-native";
import {
  getAttendanceSummary,
  getAttendanceForStudentInRange,
} from "../../../src/services/attendanceSummary";

import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore"; 
import { db } from "../../firebase";
import { Pressable } from "react-native";
import { exportStudentAttendancePdf } from "../../../src/services/exports/exportStudentAttendancePdf";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/**
 * Student detail page
 * Supports dynamic date ranges (daily / weekly / monthly / termly)
 */

function getLast5SchoolDays() {
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

export default function StudentDetail() {
  const params = useLocalSearchParams();

  const studentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fromIsoParam = params.fromIso as string | undefined;
  const toIsoParam = params.toIso as string | undefined;
  const titleParam = params.title as string | undefined;
const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [studentName, setStudentName] = useState<string>("");

  useEffect(() => {
    if (!studentId) return;

    (async () => {
      try {
        setLoading(true);

        /* ---------------- student name ---------------- */
        const snap = await getDoc(doc(db, "students", studentId));
        if (snap.exists()) {
  const data = snap.data();

  const displayName =
    data.name
      ?? "Student";

  const displayId =
    data.studentId
      ?? data.rollNo
      ?? "";

  setStudentName(
    displayId
      ? `${displayName} (${displayId})`
      : displayName
  );
} else {
  setStudentName("Student");
}

        /* ---------------- date range ---------------- */
        let fromIso = fromIsoParam;
        let toIso = toIsoParam;

        // fallback → last 5 school days
        if (!fromIso || !toIso) {
          const last5 = getLast5SchoolDays();
          fromIso = last5[0];
          toIso = last5[last5.length - 1];
        }

        /* ---------------- summary ---------------- */
       const summaries = await getAttendanceSummary({
  studentId,
  fromIso,
  toIso,
  includeStudentName: true,
});
const s = summaries[0]; // only one student
setSummary(s);

        /* ---------------- daily timeline ---------------- */
        const recs = await getAttendanceForStudentInRange(studentId, fromIso, toIso);
        setDaily(recs.sort((a: any, b: any) => a.date.localeCompare(b.date)));
      } catch (e) {
        console.error("student detail", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId, fromIsoParam, toIsoParam]);

  if (loading || !summary) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }
const attendedCount =
  (summary.presentCount ?? 0) + (summary.lateCount ?? 0);

  return (
    <View className="flex-1 p-4 bg-slate-50">
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
        {titleParam ?? "Student Report"}
      </Text>
</View>

     

      <Text className="text-lg font-semibold text-slate-700 mb-4">
        {studentName}
      </Text>
<Pressable
  onPress={() =>
    exportStudentAttendancePdf({
      studentId,
      fromIso: fromIsoParam ?? summary.__fromIso,
      toIso: toIsoParam ?? summary.__toIso,
      title: titleParam ?? "Student Attendance Report",
    })
  }
  className="bg-indigo-600 py-2 px-4 rounded-lg mb-4"
>
  <Text className="text-white font-semibold text-center">
    Export PDF
  </Text>
</Pressable>

      {/* -------- SUMMARY -------- */}
      <View className="bg-white p-4 rounded-xl mb-4 shadow">
        <Text className="font-semibold">Summary</Text>

        <View className="flex-row justify-between mt-2">
          <View>
            <Text className="text-xs text-slate-500">Present</Text>
            <Text className="text-lg font-bold text-emerald-600">
              {summary.presentCount}
            </Text>
          </View>
 

 <View>
            <Text className="text-xs text-slate-500">Late</Text>
            <Text className="text-lg font-bold text-amber-700">
              {summary.lateCount}
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
              {summary.absentCount}
            </Text>
          </View>


          <View>
            <Text className="text-xs text-slate-500">Attendance %</Text>
            <Text className="text-lg font-bold">
              {summary.percentagePresent.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* -------- DAILY TIMELINE -------- */}
      <Text className="font-semibold mb-2">Attendance Timeline</Text>

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
                  {item.status ?? (item.checkInTime ? "present" : "absent")}
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

