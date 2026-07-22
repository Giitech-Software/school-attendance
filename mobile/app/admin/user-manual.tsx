import React from "react";
import { Alert, ScrollView, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const WORD_MANUAL_ASSET = require("../../docs/ASTEM-Attendance-User-Manual.docx");
const WORD_MANUAL_FILE_NAME = "ASTEM-Attendance-User-Manual.docx";
const WORD_MANUAL_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const sections = [
  {
    title: "Account Access",
    items: [
      "Sign in with email and password.",
      "New users must verify email and wait for admin approval.",
      "Use Forgot password to receive a reset link.",
      "If the internet is down, the app shows a friendly connection message instead of a long technical error.",
      "If the verification email is missing, check the inbox first, then spam or junk.",
    ],
  },
  {
    title: "Home Page",
    items: [
      "Use Start to choose Student Attendance or Staff Attendance.",
      "The quick attendance row shows QR, Biometric, Facial, ID, and Start actions.",
      "Use ID for staff ID attendance when a staff member cannot use QR, face, or biometric.",
      "Use Reports for daily, weekly, monthly, termly, yearly, and individual summaries.",
      "Use Admin to manage setup, users, students, staff, and classes.",
    ],
  },
  {
    title: "Attendance",
    items: [
      "Student attendance supports class selection, QR check-in/out, biometric check-in/out, and student face check-in where configured.",
      "Staff attendance supports QR, fingerprint/biometric, face check-in, and staff ID attendance.",
      "Attendance may be blocked on weekends, holidays, outside allowed time, or outside the approved school/work location.",
      "After the configured attendance close time, check-in is blocked but check-out remains available.",
      "When geofencing is bypassed, only admins or users with explicit attendance-taking permission can record student or staff attendance.",
      "Staff self-service and assigned-class-only attendance are blocked while geofencing is bypassed.",
      "Late arrivals and early departures require a movement book entry when they cross the configured attendance threshold.",
    ],
  },
  {
    title: "Admin Setup",
    items: [
      "Attendance Readiness shows whether the school/work geofence is configured and whether attendance is ready or blocked.",
      "Set School/Work Location to save the GPS geofence, radius, optional manual latitude/longitude, and geofencing policy.",
      "Use Bypass Options to disable geofencing for a controlled period: day, week, month, term, or year.",
      "Set Attendance Time to configure late time, close time, timezone, weekend/holiday policy, and absence marking.",
      "Manage Terms, Classes, Students, Staff, Users, Parent Wards, and the User Manual from the Admin dashboard.",
      "Use Promote Students to move selected active students from one class to another without deleting attendance history.",
    ],
  },
  {
    title: "Students",
    items: [
      "Create or edit students with name, class, student ID, and roll number.",
      "Use Bulk Import to paste CSV rows with name, classId or className, studentId, and rollNo.",
      "Enroll biometric from the student profile.",
      "Register student face from the student face registration page when face attendance is needed.",
      "Generate student QR codes individually or export class QR cards as PDF.",
    ],
  },
  {
    title: "Staff",
    items: [
      "Create or edit staff with name, staff ID, email, and role.",
      "Use Bulk Import to paste CSV rows with name, email, role, and staffId.",
      "Register face before enrolling staff fingerprint/biometric.",
      "Generate professional signed staff QR cards individually or export staff QR PDF.",
      "Staff users can view My Attendance and My Report where enabled.",
    ],
  },
  {
    title: "Users and Parents",
    items: [
      "Admins can edit user roles, approval, and display names.",
      "Use Wards to assign students to parent accounts.",
      "Parents use My Wards to view daily, weekly, monthly, or term attendance.",
    ],
  },
  {
    title: "Reports",
    items: [
      "Reports are admin-only.",
      "Choose Student Reports or Staff Reports.",
      "Open daily, weekly, monthly, termly, yearly, or individual reports, then export PDF when needed.",
      "Report dashboards show Present, Late, Attended, Absent, and Attendance % total cards.",
      "Daily reports can auto-mark absentees before showing report results.",
    ],
  },
  {
    title: "Geofencing Quality",
    items: [
      "Location setup and attendance use fresh high-accuracy GPS readings.",
      "If the phone reports weak accuracy, the app asks the user to move outside, enable precise location, or retry.",
      "Different devices can vary in GPS quality, but all users are checked against the same saved school/work location and radius.",
      "Use a practical radius that covers the school compound, not only the exact point where the admin stood during setup.",
      "If geofencing must be bypassed for rural connectivity or GPS issues, choose a clear duration and reason.",
      "Bypassed attendance records are audited with reason, admin, expiry, and timestamp.",
    ],
  },
];

const commonIssues = [
  ["Cannot sign in", "Check email/password, verify email, or reset password."],
  ["No internet", "Connect to mobile data or Wi-Fi, then try again."],
  ["Account pending", "Ask an administrator to approve the account."],
  ["Verification email missing", "Check inbox, spam, or junk, then resend the email if needed."],
  ["Camera blocked", "Grant camera permission in device settings."],
  ["Biometric unavailable", "Set up fingerprint or face unlock on the device first."],
  ["Location unavailable", "Enable precise location, go near a window or outdoors, and retry after GPS improves."],
  ["Too far from school", "Ask an admin to confirm the saved latitude, longitude, and radius."],
  ["Attendance readiness blocked", "Admin should set the school/work location or choose a controlled bypass period."],
  ["Geofencing bypass active", "Only admins or users with explicit attendance-taking permission can record attendance."],
  ["Check-in closed", "Check-in is blocked after the close time; use check-out only if the person already checked in."],
  ["QR not accepted", "Confirm the QR belongs to the correct student/staff and class."],
  ["Parent sees no wards", "Assign wards to the parent account."],
  ["Reports are empty", "Confirm terms, weeks, students, staff, classes, and attendance or absent records exist for the selected range."],
];

export default function UserManualScreen() {
  const router = useRouter();

  async function shareWordManual() {
    try {
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert(
          "Sharing unavailable",
          "This device does not currently support file sharing."
        );
        return;
      }

      const asset = Asset.fromModule(WORD_MANUAL_ASSET);
      await asset.downloadAsync();

      const sourceUri = asset.localUri ?? asset.uri;
      if (!sourceUri) {
        throw new Error("The Word manual could not be loaded.");
      }

      const targetUri = `${FileSystem.cacheDirectory}${WORD_MANUAL_FILE_NAME}`;
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetUri,
      });

      await Sharing.shareAsync(targetUri, {
        dialogTitle: "Download Word Manual",
        mimeType: WORD_MANUAL_MIME,
        UTI: "org.openxmlformats.wordprocessingml.document",
      });
    } catch (error) {
      console.error("shareWordManual", error);
      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "Could not prepare the Word manual."
      );
    }
  }

  return (
    <View className="flex-1 bg-slate-300">
      <View className="bg-[#0B1C33] px-5 pt-3 pb-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#ffffff" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-extrabold text-white">
              User Manual
            </Text>
            <Text className="text-blue-200 mt-1">
              ASTEM Attendance Register
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <View className="bg-white rounded-2xl p-4 shadow mb-4">
          <View className="flex-row items-center mb-2">
            <View className="bg-blue-100 p-2 rounded-full mr-3">
              <MaterialIcons name="menu-book" size={22} color="#1E3A8A" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-slate-900">
                Quick Guide
              </Text>
              <Text className="text-sm text-slate-500 mt-1">
                Concise help for all major app pages and workflows.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={shareWordManual}
            className="bg-blue-700 rounded-xl p-3 mt-3 flex-row items-center justify-center"
          >
            <MaterialIcons name="file-download" size={20} color="#ffffff" />
            <Text className="text-white font-semibold ml-2">
              Download Word Manual
            </Text>
          </Pressable>
        </View>

        {sections.map((section) => (
          <View key={section.title} className="bg-white rounded-2xl p-4 shadow mb-4">
            <Text className="text-lg font-bold text-slate-900 mb-3">
              {section.title}
            </Text>
            {section.items.map((item) => (
              <View key={item} className="flex-row mb-2">
                <MaterialIcons name="check-circle" size={18} color="#16A34A" />
                <Text className="text-slate-700 ml-2 flex-1 leading-5">
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View className="bg-white rounded-2xl p-4 shadow">
          <Text className="text-lg font-bold text-slate-900 mb-3">
            Common Issues
          </Text>
          {commonIssues.map(([issue, fix]) => (
            <View key={issue} className="border-b border-slate-100 py-3">
              <Text className="font-semibold text-slate-800">{issue}</Text>
              <Text className="text-slate-600 mt-1">{fix}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

