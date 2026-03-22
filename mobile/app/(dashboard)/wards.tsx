// mobile/app/%28dashboard%29/wards.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
     Image,  
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { auth, db } from "@/app/firebase";
import { getWardsForParent } from "@/src/services/wards";
import { doc, getDoc } from "firebase/firestore";
import AppPicker from "@/components/AppPicker";

/* ---------------- Types ---------------- */

type Period = "day" | "week" | "month" | "term";

type WardRow = {
  studentId: string;
  studentName: string;
};

/* ---------------- Helpers ---------------- */

function getDateRange(period: Period) {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  switch (period) {
    case "day":
      break;

    case "week": {
      const day = from.getDay();
      const diff = from.getDate() - day + (day === 0 ? -6 : 1);
      from.setDate(diff);
      break;
    }

    case "month":
      from.setDate(1);
      break;

    case "term":
      from.setMonth(0, 1);
      break;
  }

  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}

const PERIOD_LABELS: Record<Period, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  term: "Termly",
};

/* ---------------- Screen ---------------- */

export default function Wards() {
  const router = useRouter();

  const [period, setPeriod] = useState<Period>("month");
  const [rows, setRows] = useState<WardRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Stable date range state (prevents race-condition crash)
  const [dateRange, setDateRange] = useState(() => getDateRange("month"));

  useEffect(() => {
    setDateRange(getDateRange(period));
  }, [period]);

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/(auth)/login");
  }

  /* ---------------- Load Wards ---------------- */

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!auth.currentUser) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const wards = await getWardsForParent(auth.currentUser.uid);
        const resolved: WardRow[] = [];

       for (const w of wards) {
  const snap = await getDoc(doc(db, "students", w.studentId));

  // 🚫 Skip deleted / moved students
  if (!snap.exists()) {
    continue;
  }

  const data = snap.data();
// 👇 ADD THIS
if (data?.isActive === false) continue;
  const name =
    data?.name?.trim()
      ? data.name
      : data?.studentId
      ? data.studentId
      : data?.rollNo
      ? data.rollNo
      : null;

  // 🚫 Still no identity → skip
  if (!name) continue;

  const label =
    data?.studentId && data?.name
      ? `${data.name} (${data.studentId})`
      : name;

  resolved.push({
    studentId: w.studentId,
    studentName: label,
  });
}


        if (mounted) setRows(resolved);
      } catch (e) {
        console.error("load wards error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const activeLabel = PERIOD_LABELS[period];

  return (
    <ScrollView className="flex-1 p-4 bg-slate-50">
      {/* Hero Image */}
<View className="bg-white -mx-4">
  <Image
    source={require("../../assets/images/parent-view-attendance.jpg")}
    style={{ width: "100%", height: 140 }}
    resizeMode="stretch"
  />
</View>

      {/* Header */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-2xl font-extrabold">My Wards</Text>
        <Pressable onPress={handleSignOut}>
          <Text className="text-red-600 font-semibold">Sign out</Text>
        </Pressable>
      </View>

      {/* ✅ NO STUDENTS ASSIGNED */}
      {rows.length === 0 ? (
        <View className="mt-12 items-center">
          <Text className="text-lg font-semibold text-slate-700 mb-2">
            No student assigned
          </Text>
          <Text className="text-center text-slate-500">
            You currently do not have any students linked to your account.
            Please contact the school administrator for assistance.
          </Text>
        </View>
      ) : (
        <>
          {/* Period Info */}
          <Text className="text-sm text-slate-500 mb-2">
            Viewing:{" "}
            <Text className="font-semibold">{activeLabel} Attendance</Text>
          </Text>

          {/* Picker */}
          <View className="bg-white rounded-xl border mb-4">
            <AppPicker
              selectedValue={period}
              onValueChange={(v: Period) => setPeriod(v)}
            >
              <Picker.Item label="Daily Attendance" value="day" />
              <Picker.Item label="Weekly Attendance" value="week" />
              <Picker.Item label="Monthly Attendance" value="month" />
              <Picker.Item label="Term Attendance" value="term" />
            </AppPicker>
          </View>

          {/* Wards */}
          {rows.map((w) => (
            <Pressable
              key={w.studentId}
              onPress={() => {
                // ✅ Navigation safety guard
                if (!dateRange?.fromIso || !dateRange?.toIso) return;

                router.push({
                  pathname: "/reports/student/[id]",
                  params: {
                    id: w.studentId,
                    fromIso: dateRange.fromIso,
                    toIso: dateRange.toIso,
                    title: `${activeLabel} Attendance`,
                  },
                });
              }}
              className="mb-4 rounded-xl border border-slate-200 p-4 bg-white"
            >
              <Text className="text-lg font-semibold">{w.studentName}</Text>

              <Text className="text-sm text-slate-500 mt-1">
                Tap to view {activeLabel.toLowerCase()} attendance
              </Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}
