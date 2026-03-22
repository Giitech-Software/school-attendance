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
    Image,   // ✅ add this
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, Link } from "expo-router";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth as firebaseAuth } from "./firebase";
import { signOutUser } from "../src/services/auth";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons, Entypo } from "@expo/vector-icons";
import useCurrentUser from "../src/hooks/useCurrentUser";  
import { getAttendanceSettings } from "../src/services/attendanceSettings";
//import { autoMarkAbsentsForToday } from "../src/services/attendance"; // adjust path if needed
import { autoMarkAbsentsForToday } from "../src/services/autoMarkAbsent";
/* ---------- helpers ---------- */

function shortName(email?: string | null) {
  if (!email) return "";
  return email.split("@")[0];
}

// Step 4 — formatTime helper (NOT inside component)
function formatTime(time?: string) {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true, // ✅ FORCE AM / PM
  });
}


export default function Home(): JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);
  const { userDoc, loading: userDocLoading } = useCurrentUser();
  const [showWelcome, setShowWelcome] = useState(true);

  
const [showStartOptions, setShowStartOptions] = useState(false);
const [showReportOptions, setShowReportOptions] = useState(false);
const [loadingReports, setLoadingReports] = useState(false);
const [actor, setActor] = useState<"student" | "staff">("student");
  // Step 2 — attendance settings state
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
        if (active && userDoc?.role === "admin") {
          await autoMarkAbsentsForToday();
        }
      } catch (e) {
        console.warn("Auto-mark failed", e);
      }
    })();

    return () => {
      active = false;
    };
  }, [userDoc?.role])
);

  // Step 3 — load attendance settings
 useFocusEffect(
  React.useCallback(() => {
    let active = true;

    (async () => {
      try {
        const settings = await getAttendanceSettings();
        if (active) setAttendanceSettings(settings);
      } catch (e) {
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

  const isAdmin = Boolean(userDoc?.role === "admin");

  return (
   <SafeAreaView
  className="flex-1 bg-blue-900"
  edges={["left", "right", "bottom"]}   // 🚫 no top padding
>


 {/* Subtitle / Action Banner (NOT a header) */}
<View style={{ backgroundColor: '#1e293b' }} className="px-6 py-2">

  <View className="flex-row items-center justify-between">
    <View className="flex-1 pr-2">
      <Text
        className="text-lg font-semibold text-white"
        style={{ includeFontPadding: false }}
      >
        Manage check-in • check-out • reports
      </Text>
    </View>
  </View>

 
  {/* Action row */}
<View className="mt-4 flex-row items-center justify-between">
  <View className="flex-row items-center space-x-3">

    {/* QR */}
    <View className="bg-white/15 rounded-full px-3 py-2 flex-row items-center">
      <MaterialIcons name="qr-code-scanner" size={16} color="#FFFFFF" />
      <Text className="text-white ml-2 text-m">QR</Text>
    </View>

    {/* Biometric */}
    <View className="bg-white/15 rounded-full px-3 py-2 flex-row items-center">
      <Entypo name="fingerprint" size={16} color="#FFFFFF" />
      <Text className="text-white ml-2 text-m">Biometric</Text>
    </View>

    {/* ✅ Facial */}
    <View className="bg-white/15 rounded-full px-3 py-2 flex-row items-center">
      <MaterialIcons
        name="face-retouching-natural"
        size={16}
        color="#FFFFFF"
      />
      <Text className="text-white ml-2 text-m">Facial</Text>
    </View>

  </View>

 <Pressable
  onPress={() => setShowStartOptions(true)}
  className="bg-yellow-400 px-4 py-2 rounded-full"
>
  <Text className="text-blue-900 font-bold">
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



{/* 🌟 Welcome Popup */}
{showWelcome && (
  <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/40 items-center justify-center px-6 z-50">
    <View className="w-full bg-white rounded-3xl p-6 shadow-2xl">
      <LinearGradient
        colors={["#1E3A8A", "#2563EB", "#0EA5E9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-2xl p-4"
      >
        <Text className="text-xl font-extrabold text-yellow-300 text-center">
          Welcome to ASTEM
        </Text>

        <Text className="text-sm text-white mt-2 text-center leading-5">
          Attendance Register
        </Text>

        <View className="mt-4 bg-white/20 p-3 rounded-xl">
          <Text className="text-white text-center text-sm">
            Manage Attendance • Staff • Students • Reports
          </Text>
        </View>

        <Pressable
          onPress={() => setShowWelcome(false)}
          className="mt-5 bg-white rounded-full py-3"
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
          Staff Attendance
        </Text>
      </Pressable>

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
        {/* Quick cards */}
        <View className="grid grid-cols-2 gap-4">
          <Link href="/attendance/checkin" asChild>
            <Pressable className="bg-white rounded-2xl p-4 shadow flex-row items-center">
              <View className="p-3 rounded-lg bg-primary/10 mr-3">
                <MaterialIcons name="qr-code" size={22} color="#1E3A8A" />
              </View>
              <View>
                <Text className="font-semibold text-dark">Scan QR</Text>
                <Text className="text-sm text-neutral mt-1">
                  Fast student check-in/out
                </Text> 
              </View>
            </Pressable>
          </Link>
<Link
  href={{
    pathname: "/attendance/checkin",
    params: { actor: "staff" },
  }}
  asChild
>
  <Pressable className="bg-white rounded-2xl p-4 shadow flex-row items-center">
    <View className="p-3 rounded-lg bg-blue-500/10 mr-3">
      <MaterialIcons name="badge" size={22} color="#2563EB" />
    </View>
    <View>
      <Text className="font-semibold text-dark">
        Staff Check-In
      </Text>
      <Text className="text-sm text-neutral mt-1">
        Staff attendance tracking
      </Text>
    </View>
  </Pressable>
</Link>

        
        {isAdmin && (
  <Pressable
    className="bg-white rounded-2xl p-4 shadow flex-row items-center"
    onPress={() =>
  router.push({
    pathname: "/reports",
    params: { type: actor },
  })
}
  >
    <View className="p-3 rounded-lg bg-secondary/10 mr-3">
      <MaterialIcons name="bar-chart" size={22} color="#FACC15" />
    </View>
    <View>
      <Text className="font-semibold text-dark">Reports</Text>
      <Text className="text-sm text-neutral mt-1">
        Daily • Weekly • Monthly • Termly
      </Text>
    </View>
  </Pressable>
)}


          {isAdmin ? (
            <Pressable
              onPress={() => router.push("/admin")}
              className="bg-white rounded-2xl p-4 shadow flex-row items-center"
            >
              <View className="p-3 rounded-lg bg-primary/10 mr-3">
                <MaterialIcons
                  name="admin-panel-settings"
                  size={22}
                  color="#1E3A8A"
                />
              </View>
              <View>
                <Text className="font-semibold text-dark">Admin</Text>
                <Text className="text-sm text-neutral mt-1">
                  Setup terms, classes & users
                </Text>
              </View>
            </Pressable>
          ) : (
            <View />
          )}

          <Pressable
            onPress={() => router.push("/students")}
            className="bg-white rounded-2xl p-4 shadow flex-row items-center"
          >
            <View className="p-3 rounded-lg bg-red/10 mr-3">
              <Entypo name="add-to-list" size={22} color="#EF4444" />
            </View>
            <View>
              <Text className="font-semibold text-dark">Add Student</Text>
              <Text className="text-sm text-neutral mt-1">
                Enroll new student
              </Text>
            </View>
          </Pressable>
        </View><View className="mt-6 bg-white rounded-2xl p-4 shadow">
  {/* Card title */}
  <Text className="font-semibold text-dark mb-3 text-lg">
    Select Actor
  </Text>

  {/* Buttons */}
  <View className="flex-row space-x-3">
    <Pressable
     onPress={() => setActor("student")}
      className={`flex-1 py-3 rounded-xl items-center justify-center border border-slate-200 ${
        actor === "student" ? "bg-primary" : "bg-white"
      }`}
    >
      <Text
        className={`font-semibold ${
          actor === "student" ? "text-white" : "text-dark"
        }`}
      >
        Students
      </Text>
    </Pressable>

    <Pressable
     onPress={() => setActor("staff")}
      className={`flex-1 py-3 rounded-xl items-center justify-center border border-slate-200 ${
        actor === "staff" ? "bg-primary" : "bg-white"
      }`}
    >
      <Text
        className={`font-semibold ${
          actor === "staff" ? "text-white" : "text-dark"
        }`}
      >
        Staff
      </Text>
    </Pressable>
  </View>
</View>
        {/* Quick Actions */}
        <View className="mt-6 bg-white rounded-2xl p-4 shadow">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-semibold text-dark">Quick Actions</Text>
            <Text className="text-sm text-neutral">Today</Text>
          </View>

          <View className="space-y-3">
            <Pressable
              onPress={() =>
  router.push({
    pathname: "/attendance/checkin",
    params: { actor },
  })
}
              className="p-3 rounded-lg bg-primary/5 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="login" size={18} color="#1E3A8A" />
                <Text className="ml-3 text-dark">
                 {actor === "student" ? "Start class check-in" : "Start staff check-in"}   </Text>
              </View>
             <Text className="text-sm text-neutral">
  • {formatTime(attendanceSettings.lateAfter)}

</Text>

            </Pressable>

            <Pressable
              onPress={() => router.push("/attendance/checkin")}
              className="p-3 rounded-lg bg-red/5 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="logout" size={18} color="#EF4444" />
                <Text className="ml-3 text-dark">
               {actor === "student" ? "End of class check-out" : "End of staff check-out"}
                </Text>
              </View>
             <Text className="text-sm text-neutral">
  • {formatTime(attendanceSettings.closeAfter)}

</Text> 
    </Pressable>

{isAdmin && (
  <Pressable
    onPress={() =>
      router.push({
        pathname: "/reports",
        params: { type: actor }, // 🔥 PASS ACTOR
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
      • {actor === "student" ? 5 : 30} days
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
              {signingOut ? "Signing out…" : "Sign out"}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View className="mt-6 items-center">
          <Text className="text-xs text-neutral">
            Developer • Solomon K. Aggrey
          </Text>
          <Text className="text-xs text-neutral">
            ASTEM Attendance • Mobile app
          </Text>
          <Text className="text-xs text-neutral">Version 1.0</Text>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 40 : 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
