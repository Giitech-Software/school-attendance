// app/admin/attendance-settings.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";

import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import useCurrentUser from "../../src/hooks/useCurrentUser";
import {
  getAttendanceSettings,
  saveAttendanceSettings,
} from "../../src/services/attendanceSettings"; 
import { autoMarkAbsentAllClasses, autoMarkAbsentStaff } from "../../src/services/autoMarkAbsent";
import { MaterialIcons } from "@expo/vector-icons";

/* =========================
   ✅ ADDITION START
   Time formatter (24h → 12h with AM/PM)
========================= */
function formatTo12Hour(time24: string) {
  if (!time24 || !/^\d{2}:\d{2}$/.test(time24)) return time24;

  const [hourStr, minute] = time24.split(":");
  let hour = Number(hourStr);

  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  hour = hour === 0 ? 12 : hour;

  return `${hour}:${minute} ${ampm}`;
}

/* =========================
   ✅ ADDITION END
========================= */

export default function AttendanceSettingsAdmin() {
  const router = useRouter();
  const { userDoc, loading: userDocLoading } = useCurrentUser();

  const [lateAfter, setLateAfter] = useState("08:00");
  const [closeAfter, setCloseAfter] = useState("16:00");
  const [timezone, setTimezone] = useState("Africa/Accra");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = userDoc?.role === "admin";

  /* ---------------------------
     AUTH GUARD
  --------------------------- */
  useEffect(() => {
  if (userDocLoading || !userDoc || !isAdmin) return;

  Promise.all([
    autoMarkAbsentAllClasses({ adminUid: userDoc.id }),
    autoMarkAbsentStaff({ adminUid: userDoc.id }),
  ]).catch((err) => {
    console.error("Auto-mark absent failed", err);
  });
}, [userDoc, userDocLoading, isAdmin]);

  /* ---------------------------
     LOAD SETTINGS
  --------------------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const settings = await getAttendanceSettings();
        if (!mounted) return;

        setLateAfter(settings.lateAfter ?? "08:00");
        setCloseAfter(settings.closeAfter ?? "16:00");
        setTimezone(settings.timezone ?? "Africa/Accra");
      } catch (e) {
        console.error("load attendance settings", e);
        Alert.alert("Failed to load attendance settings");
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading || userDocLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  /* ---------------------------
     SAVE
  --------------------------- */
  async function onSave() {
    const timeRegex = /^\d{2}:\d{2}$/;

    if (!timeRegex.test(lateAfter) || !timeRegex.test(closeAfter)) {
      Alert.alert("Invalid time", "Use HH:mm format (e.g. 16:00)");
      return;
    }

    try {
      setSaving(true);
      await saveAttendanceSettings({
        lateAfter,
        closeAfter,
        timezone,
      });
      Alert.alert("Saved", "Attendance settings updated");
    } catch (e) {
      console.error("save settings", e);
      Alert.alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------
     UI
  --------------------------- */
  return (
    <KeyboardAwareScreen>
      <View className="flex-1 bg-slate-300 p-4">
        {/* Header */}
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

          <Text className="text-2xl font-extrabold text-slate-900">          </Text>
        </View>

        {/* Late time */}
        <View className="bg-white rounded-2xl p-4 shadow mb-4">
          <Text className="font-semibold text-lg mb-2">
            Late Check-In Time
          </Text>
          <Text className="text-slate-600 text-sm mb-3">
            Checking in after this time will be marked as late.
          </Text>

          <TextInput
            value={lateAfter}
            onChangeText={setLateAfter}
            placeholder="HH:mm"
            keyboardType="numeric"
            className="border rounded-xl p-3 text-lg"
          />

          {/* =========================
              ✅ ADDITION (AM/PM display)
          ========================= */}
          <Text className="text-slate-500 mt-2">
            Selected time: {formatTo12Hour(lateAfter)}
          </Text>
        </View>

        {/* Close time */}
        <View className="bg-white rounded-2xl p-4 shadow mb-4">
          <Text className="font-semibold text-lg mb-2">
            Attendance Close Time
          </Text>
          <Text className="text-slate-600 text-sm mb-3">
            Check-in and check-out will be disabled after this time.
          </Text>

          <TextInput
            value={closeAfter}
            onChangeText={setCloseAfter}
            placeholder="HH:mm"
            keyboardType="numeric"
            className="border rounded-xl p-3 text-lg"
          />

          {/* =========================
              ✅ ADDITION (AM/PM display)
          ========================= */}
          <Text className="text-slate-500 mt-2">
            Selected time: {formatTo12Hour(closeAfter)}
          </Text>
        </View>

        {/* Timezone */}
        <View className="bg-white rounded-2xl p-4 shadow mb-6">
          <Text className="font-semibold text-lg mb-2">
            Timezone
          </Text>
          <Text className="text-slate-600 text-sm mb-3">
            Used to calculate attendance times correctly.
          </Text>

          <TextInput
            value={timezone}
            onChangeText={setTimezone}
            className="border rounded-xl p-3 text-lg"
          />
        </View>



        {/* Save */}
        <Pressable
          disabled={saving}
          onPress={onSave}
          className={`rounded-xl p-4 items-center ${
            saving ? "bg-slate-300" : "bg-blue-600"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              Save Settings
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScreen>
  );
}
 
