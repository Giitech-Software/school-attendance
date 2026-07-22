// mobile/app/index.tsx
import React, { JSX, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth as firebaseAuth } from "./firebase";
import { signOutUser } from "../src/services/auth";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons, Entypo } from "@expo/vector-icons";
import useCurrentUser from "../src/hooks/useCurrentUser";
import { useAssignedStudentClasses } from "../src/hooks/useAssignedStudentClasses";
import { getAttendanceSettings } from "../src/services/attendanceSettings";
//import { autoMarkAbsentsForToday } from "../src/services/attendance"; // adjust path if needed
import { autoMarkAbsentsForToday } from "../src/services/autoMarkAbsent";
import { allowsStudentAndParentFeatures } from "../src/services/tenantScope";
/* ---------- helpers ---------- */

// Step 4 - formatTime helper (NOT inside component)
function formatTime(time?: string) {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type LandingAction = {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  iconBackground: string;
  iconColor: string;
  onPress: () => void;
};

function LandingActionGroup({ title, description, actions }: { title: string; description: string; actions: LandingAction[] }) {
  if (!actions.length) return null;
  return (
    <View className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <View className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Text className="font-extrabold text-slate-900">{title}</Text>
        <Text className="mt-0.5 text-sm text-slate-500">{description}</Text>
      </View>
      {actions.map((action, index) => (
        <Pressable
          key={action.title}
          onPress={action.onPress}
          android_ripple={{ color: "#DBEAFE" }}
          className={`flex-row items-center px-4 py-3.5 ${index === actions.length - 1 ? "" : "border-b border-slate-200"}`}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: action.iconBackground }}>
            <MaterialIcons name={action.icon} size={22} color={action.iconColor} />
          </View>
          <View className="ml-3 flex-1" style={{ minWidth: 0 }}>
            <Text className="font-bold text-slate-900">{action.title}</Text>
            <Text className="mt-0.5 text-sm text-slate-500">{action.subtitle}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
        </Pressable>
      ))}
    </View>
  );
}


export default function Home(): JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);
  const { userDoc } = useCurrentUser();
  const { hasAssignedClasses: hasAssignedStudentClasses } =
    useAssignedStudentClasses(
      userDoc?.approved === true || userDoc?.role === "admin" || userDoc?.role === "super_admin"
        ? userDoc?.uid ?? userDoc?.id
        : null
    );
  const [showWelcome, setShowWelcome] = useState(true);


const [showStartOptions, setShowStartOptions] = useState(false);
const [actor, setActor] = useState<"student" | "staff">("student");
  // Step 2 - attendance settings state
 const [attendanceSettings, setAttendanceSettings] = useState<{
  lateAfter?: string;
  closeAfter?: string;
  timezone?: string;
}>({});

const mounted = React.useRef(true);

useEffect(() => {
  return () => {
    mounted.current = false;
  };
}, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      if (!u) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

useFocusEffect(
  React.useCallback(() => {
    let active = true;

    (async () => {
      try {
        if (active && (userDoc?.role === "admin" || userDoc?.role === "super_admin")) {
          await autoMarkAbsentsForToday({ adminUid: userDoc.uid ?? userDoc.id });
        }
      } catch (error) {
        console.warn("Auto-mark failed", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [userDoc?.id, userDoc?.role, userDoc?.uid])
);

  // Step 3 - load attendance settings
 useFocusEffect(
  React.useCallback(() => {
    let active = true;

    (async () => {
      try {
        const settings = await getAttendanceSettings();
        if (active) setAttendanceSettings(settings);
      } catch {
        console.warn("Failed to load attendance settings");
      }
    })();

    return () => {
      active = false;
    };
  }, [])
);


  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
    } catch (err: any) {
      console.error("SignOut failed:", err);
      Alert.alert("Sign out failed", err?.message ?? String(err));
      setSigningOut(false);
    }
  }

  if (user === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-light items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const isSuperAdmin = Boolean(userDoc?.role === "super_admin");
  const isAdmin = Boolean(userDoc?.role === "admin" || isSuperAdmin);
  const isApproved = isAdmin || userDoc?.approved === true;
  const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);
  const personnelLabel = allowsSchoolFeatures ? "Staff" : userDoc?.tenantType === "company" ? "Employees" : "Personnel";
  const personnelLabelLower = personnelLabel.toLowerCase();
  const canTakeStudentAttendance =
    allowsSchoolFeatures && (
      isAdmin ||
    (isApproved && userDoc?.canTakeStudentAttendance === true) ||
    (isApproved && hasAssignedStudentClasses)
    );
  const canTakeStaffAttendance =
    isAdmin || (isApproved && userDoc?.canTakeStaffAttendance === true);
  const selectedActor = allowsSchoolFeatures ? actor : "staff";
  const canTakeSelectedAttendance =
    selectedActor === "staff" ? canTakeStaffAttendance : canTakeStudentAttendance;
  const isStaffUser =
    userDoc?.role === "teacher" ||
    userDoc?.role === "staff" ||
    userDoc?.role === "non_teaching_staff" ||
    userDoc?.role === "general_staff";
  const canUseStaffSelfService = isStaffUser || isAdmin;

  const personalActions: LandingAction[] = canUseStaffSelfService
    ? [
        { title: "My Attendance", subtitle: "Check in, check out, and view today", icon: "how-to-reg", iconBackground: "#D1FAE5", iconColor: "#047857", onPress: () => router.push("/staff/my-attendance" as any) },
        { title: "My Report", subtitle: "Review your attendance history", icon: "insights", iconBackground: "#E0E7FF", iconColor: "#4338CA", onPress: () => router.push("/staff/my-report" as any) },
      ]
    : [];

  const attendanceActions: LandingAction[] = [
    ...(canTakeStudentAttendance
      ? [{ title: "Student Check-In", subtitle: "Scan QR and manage student attendance", icon: "qr-code" as const, iconBackground: "#DBEAFE", iconColor: "#1D4ED8", onPress: () => router.push({ pathname: "/attendance/checkin", params: { actor: "student" } }) }]
      : []),
    ...(canTakeStaffAttendance
      ? [{ title: `${personnelLabel} Check-In`, subtitle: `Record ${personnelLabelLower} arrival and departure`, icon: "badge" as const, iconBackground: "#E0F2FE", iconColor: "#0369A1", onPress: () => router.push({ pathname: "/attendance/checkin", params: { actor: "staff" } }) }]
      : []),
  ];

  const managementActions: LandingAction[] = isAdmin
    ? [
        { title: "Reports", subtitle: allowsSchoolFeatures ? "Daily • Weekly • Monthly • Termly • Yearly" : "Daily • Weekly • Monthly • Yearly", icon: "bar-chart", iconBackground: "#FEF3C7", iconColor: "#A16207", onPress: () => router.push({ pathname: "/reports", params: { type: selectedActor } }) },
        { title: "Administration", subtitle: allowsSchoolFeatures ? "Terms, classes, people, and attendance" : `${personnelLabel}, users, and attendance`, icon: "verified-user", iconBackground: "#DBEAFE", iconColor: "#1E3A8A", onPress: () => router.push("/admin") },
        ...(allowsSchoolFeatures
          ? [{ title: "Add Student", subtitle: "Enroll and assign a new student", icon: "person-add" as const, iconBackground: "#FEE2E2", iconColor: "#B91C1C", onPress: () => router.push("/students") }]
          : []),
        ...(isSuperAdmin
          ? [{ title: "Tenant Organisations", subtitle: "Manage organisations, administrators, and subscriptions", icon: "business" as const, iconBackground: "#EDE9FE", iconColor: "#6D28D9", onPress: () => router.push("/super-admin" as any) }]
          : []),
      ]
    : [];

  return (
   <SafeAreaView
  className="flex-1 bg-blue-900"
  edges={["left", "right", "bottom"]}
>


 {/* Subtitle / Action Banner (NOT a header) */}
<View style={{ backgroundColor: '#1e293b' }} className="px-6 py-2">

  <View className="flex-row items-center justify-between">
    <View className="flex-1 pr-2">
      <Text
        className="text-lg font-semibold text-white"
        style={{ includeFontPadding: false }}
      >
        Manage check-in, check-out, and reports
      </Text>
    </View>
  </View>


  {/* Action row */}
<View className="mt-4 flex-row items-center justify-between">
  <View className="flex-row items-center" style={{ gap: 5 }}>

    {/* QR */}
    <View className="bg-white/15 rounded-full px-2.5 py-2 flex-row items-center">
      <MaterialIcons name="qr-code-scanner" size={15} color="#FFFFFF" />
      <Text className="text-white ml-1 text-sm">QR</Text>
    </View>

    {/* Biometric */}
    <View className="bg-white/15 rounded-full px-2.5 py-2 flex-row items-center">
      <Entypo name="fingerprint" size={15} color="#FFFFFF" />
      <Text className="text-white ml-1 text-sm">Biometric</Text>
    </View>

    {/* Facial */}
    <View className="bg-white/15 rounded-full px-2.5 py-2 flex-row items-center">
      <MaterialIcons
        name="face-retouching-natural"
        size={15}
        color="#FFFFFF"
      />
      <Text className="text-white ml-1 text-sm">Facial</Text>
    </View>

    {/* ID */}
    <View className="bg-white/15 rounded-full px-2.5 py-2 flex-row items-center">
      <MaterialIcons name="badge" size={15} color="#FFFFFF" />
      <Text className="text-white ml-1 text-sm">ID</Text>
    </View>

  </View>

 <Pressable
  onPress={() => {
    if (!canTakeStudentAttendance && !canTakeStaffAttendance) {
      Alert.alert(
        "Access denied",
        "You are approved, but you have not been authorized to take attendance."
      );
      return;
    }
    setShowStartOptions(true);
  }}
  className="bg-yellow-400 px-3 py-2 rounded-full"
>
  <Text className="text-blue-900 font-bold text-sm">
    Start
  </Text>
</Pressable>

</View>
</View>
{/* Hero Image */}
<View className="bg-white">
  <Image
    source={require("../assets/images/how-it-works2.jpg")}
    style={{ width: "100%", height: 130 }}
    resizeMode="stretch"
  />
</View>



{/* Welcome Popup */}
{showWelcome && (
  <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/40 items-center justify-center px-6 z-50">
    <View className="w-full bg-white rounded-3xl p-6 shadow-2xl">
      <LinearGradient
        colors={["#1E3A8A", "#2563EB", "#0EA5E9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-2xl p-4 pb-6"
      >
        <Text className="text-xl font-extrabold text-yellow-300 text-center">
          Welcome to ASTEM
        </Text>

        <Text className="text-sm text-white mt-2 text-center leading-5">
          Attendance Register
        </Text>

        <View className="mt-4 bg-white/20 p-3 rounded-xl">
          <Text className="text-white text-center text-sm">
            Manage people, attendance, and reports
          </Text>
        </View>

        <Pressable
          onPress={() => setShowWelcome(false)}
          className="mt-5 mb-1 bg-white rounded-full py-3"
        >
          <Text className="text-primary font-semibold text-center">
            Continue
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  </View>
)}

{showStartOptions && (
  <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/40 items-center justify-center px-6 z-50">
    <View className="w-full bg-white rounded-3xl p-6 shadow-2xl">
      <Text className="text-lg font-bold text-center mb-5">
        Select Attendance Type
      </Text>

      {canTakeStudentAttendance ? (
      <Pressable
        onPress={() => {
          setShowStartOptions(false);
          router.push({
            pathname: "/attendance/checkin",
            params: { actor: "student" },
          });
        }}
        className="bg-primary rounded-xl py-3 mb-3"
      >
        <Text className="text-white text-center font-semibold">
          Student Attendance
        </Text>
      </Pressable>
      ) : null}

      {canTakeStaffAttendance ? (
      <Pressable
        onPress={() => {
          setShowStartOptions(false);
          router.push({
            pathname: "/attendance/checkin",
            params: { actor: "staff" },
          });
        }}
        className="bg-blue-600 rounded-xl py-3"
      >
        <Text className="text-white text-center font-semibold">
          {personnelLabel} Attendance
        </Text>
      </Pressable>
      ) : null}

      <Pressable
        onPress={() => setShowStartOptions(false)}
        className="mt-4"
      >
        <Text className="text-center text-neutral">Cancel</Text>
      </Pressable>
    </View>
  </View>
)}

      {/* Content area */}
      <ScrollView contentContainerStyle={{ padding: 16 }} className="flex-1">
        <LandingActionGroup title="My workspace" description="Your attendance and personal records." actions={personalActions} />
        <LandingActionGroup title="Attendance operations" description="Start and manage authorised attendance activities." actions={attendanceActions} />
        <LandingActionGroup title="Management" description="Administration, reporting, and enrolment tools." actions={managementActions} />

        {allowsSchoolFeatures ? <View className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
  {/* Card title */}
  <Text className="font-semibold text-dark mb-3 text-lg">
    Attendance group
  </Text>
  <Text className="mb-3 text-sm text-slate-500">Choose whose attendance you are managing.</Text>

  {/* Buttons */}
  <View className="flex-row space-x-3">
    {allowsSchoolFeatures ? (
    <Pressable
     onPress={() => setActor("student")}
      className={`flex-1 py-3 rounded-xl items-center justify-center border border-slate-200 ${
        selectedActor === "student" ? "bg-primary" : "bg-white"
      }`}
    >
      <Text
        className={`font-semibold ${
          selectedActor === "student" ? "text-white" : "text-dark"
        }`}
      >
        Students
      </Text>
    </Pressable>
    ) : null}

    <Pressable
     onPress={() => setActor("staff")}
      className={`flex-1 py-3 rounded-xl items-center justify-center border border-slate-200 ${
        selectedActor === "staff" ? "bg-primary" : "bg-white"
      }`}
    >
      <Text
        className={`font-semibold ${
          selectedActor === "staff" ? "text-white" : "text-dark"
        }`}
      >
        Staff
      </Text>
    </Pressable>
  </View>
</View> : null}
        {/* Quick Actions */}
        <View className="mt-6 bg-white rounded-2xl p-4 shadow">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-semibold text-dark">Quick Actions</Text>
            <Text className="text-sm text-neutral">Today</Text>
          </View>

          <View className="space-y-3">
            {canTakeSelectedAttendance ? (
            <Pressable
              onPress={() =>
  router.push({
    pathname: "/attendance/checkin",
    params: { actor: selectedActor },
  })
}
              className="p-3 rounded-lg bg-primary/5 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="login" size={18} color="#1E3A8A" />
                <Text className="ml-3 text-dark">
                 {selectedActor === "student" ? "Start class check-in" : `Start ${personnelLabelLower} check-in`}   </Text>
              </View>
             <Text className="text-sm text-neutral">
  Due {formatTime(attendanceSettings.lateAfter)}

</Text>

            </Pressable>
            ) : null}

            {canTakeSelectedAttendance ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/attendance/checkin",
                  params: { actor: selectedActor },
                })
              }
              className="p-3 rounded-lg bg-red/5 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="logout" size={18} color="#EF4444" />
                <Text className="ml-3 text-dark">
               {selectedActor === "student" ? "End of class check-out" : `End of ${personnelLabelLower} check-out`}
                </Text>
              </View>
             <Text className="text-sm text-neutral">
  Due {formatTime(attendanceSettings.closeAfter)}

</Text>
    </Pressable>
            ) : null}

{isAdmin && (
  <Pressable
    onPress={() =>
      router.push({
        pathname: "/reports",
        params: { type: selectedActor },
      })
    }
    className="p-3 rounded-lg border border-slate-100 flex-row items-center justify-between"
  >
    <View className="flex-row items-center">
      <MaterialIcons name="insights" size={18} color="#0F172A" />
      <Text className="ml-3 text-dark">
        View weekly report
      </Text>
    </View>
    <Text className="text-sm text-neutral">
      {selectedActor === "student" ? 5 : 30} days
    </Text>
  </Pressable>
)}
</View>
        </View>

        {/* Sign out */}
        <View className="mt-6">
          <Pressable
            onPress={handleSignOut}
            className="py-3 px-4 rounded-2xl items-center"
            style={{ backgroundColor: "#EF4444" }}
            disabled={signingOut}
          >
            <Text className="text-white font-semibold">
              {signingOut ? "Signing out..." : "Sign out"}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View className="mt-6 items-center">
          <Text className="text-xs text-neutral">
            Developer: Solomon K. Aggrey
          </Text>
          <Text className="text-xs text-neutral">
            ASTEM Attendance - Mobile app
          </Text>
          <Text className="text-xs text-neutral">Version 2.0</Text>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 40 : 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
