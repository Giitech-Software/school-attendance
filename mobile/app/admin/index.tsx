// mobile/app/admin/index.tsx
import * as React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import useCurrentUser from "../../src/hooks/useCurrentUser";
import { listTerms } from "../../src/services/terms";
import { listWeeks } from "../../src/services/weeks";
import { listClasses } from "../../src/services/classes";
import { listStudents } from "../../src/services/students";

import { Animated, Dimensions } from "react-native";
import { listStaff } from "../../src/services/staff"; // ✅ Add this import

interface Class {
  id: string;
  name: string;
  description?: string;
}

export default function AdminIndex() {
  const router = useRouter();
  const { userDoc, loading: userDocLoading } = useCurrentUser();

  const [termsCount, setTermsCount] = React.useState<number | null>(null);
  const [weeksCount, setWeeksCount] = React.useState<number | null>(null);
  const [classesCount, setClassesCount] = React.useState<number | null>(null);
  const [studentsCount, setStudentsCount] = React.useState<number | null>(null);
  const [loadingCounts, setLoadingCounts] = React.useState(true);
const [pageReady, setPageReady] = React.useState(false); // ✅ Add this line
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = React.useState(true);
const [classesExpanded, setClassesExpanded] = React.useState(false);
const { width: SCREEN_WIDTH } = Dimensions.get("window");

  const [staffCount, setStaffCount] = React.useState<number | null>(null); // ✅ Add this
const marqueeItems = [
  { text: "Manage Terms", color: "#EF4444" },        // red
  { text: "Manage Students", color: "#3B82F6" },     // blue
  { text: "Generate QRs", color: "#EAB308" },        // yellow
  { text: "Manage Classes", color: "#22C55E" },      // green
  { text: "Manage Users", color: "#FFFFFF" },       // white
  { text: "Assign Students to Classes", color: "#EF4444" },
  { text: "Set Attendance Time", color: "#3B82F6" },
];

function InfiniteMarquee() {
  const translateX = React.useRef(new Animated.Value(0)).current;

  // Approximate width of one item (adjust if needed)
  const ITEM_WIDTH = 180; 
  const totalWidth = marqueeItems.length * ITEM_WIDTH;

  React.useEffect(() => {
  let loop: Animated.CompositeAnimation | null = null;

  const start = () => {
    loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: -totalWidth,
          duration: 20000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
  };

  // Delay start until UI thread is ready
  const timer = setTimeout(start, 500);

  return () => {
    clearTimeout(timer);
    loop?.stop();
  };
}, []);

  return (
    <View className="overflow-hidden bg-[#0B1C33] rounded-xl py-2 mb-4">
      <Animated.View
        style={{
          flexDirection: "row",
          transform: [{ translateX }],
        }}
      >
        {[...marqueeItems, ...marqueeItems].map((item, index) => (
          <View
            key={index}
            className="px-4 py-1 mr-3 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <Text style={{ color: item.color }} className="font-semibold text-sm">
              {item.text}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}


  const isAdmin = Boolean(userDoc?.role === "admin");

  
  React.useEffect(() => {
    if (userDocLoading) return;

    if (!userDoc) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      Alert.alert("Access denied", "You must be an admin to access this page.");
      router.replace("/");
    }
  }, [userDoc, userDocLoading, isAdmin, router]);

  React.useEffect(() => {
    let mounted = true;

    async function loadCounts() {
  setLoadingCounts(true);
  setLoadingClasses(true);

  try {
    const terms = await listTerms().catch(() => []);
    const weeks = await listWeeks().catch(() => []);
    const clsList = await listClasses().catch(() => []);
    const students = await listStudents().catch(() => []);
      const staffList = await listStaff().catch(() => []); // ✅ Fetch staff

    if (!mounted) return;

    setTermsCount(terms.length);
    setWeeksCount(weeks.length);
    setClassesCount(clsList.length);
    setStudentsCount(students.length);
    setStaffCount(staffList.length); // ✅ Set staff count
    setClasses(clsList as Class[]);
  } catch (err) {
    console.error("loadCounts error:", err);
  } finally {
  if (mounted) {
    setLoadingCounts(false);
    setLoadingClasses(false);
    setPageReady(true); // ✅ Add this line
  }
}
}


    loadCounts();
    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     QUICK SETUP CONFIG
  ========================= */

  const quickSetupColors = {
  createTerm: "bg-amber-100",
  manageClasses: "bg-emerald-100",
  manageStudents: "bg-sky-100",
  generateQRs: "bg-violet-100",
  manageUsers: "bg-rose-100",
  manageParents: "bg-teal-100",
   manageStaff: "bg-orange-100", // ✅ Added color
   generateStaffQR: "bg-indigo-100", // A distinct purple/blue for staff
};

const quickSetupHeadingColors = {
  createTerm: "text-amber-800",
  manageClasses: "text-emerald-800",
  manageStudents: "text-sky-800",
  generateQRs: "text-violet-800",
  manageUsers: "text-rose-800",
  manageParents: "text-teal-800",
manageStaff: "text-orange-800", // ✅ Added color
generateStaffQR: "text-indigo-800",
};

const quickSetupIcons = {
  createTerm: "calendar-today",
  manageClasses: "library-books",
  manageStudents: "school",
  generateQRs: "qr-code",
  manageUsers: "people",
  manageParents: "family-restroom",
  manageStaff: "badge", // ✅ Added icon
  generateStaffQR: "badge", // "badge" is perfect for staff/employee cards
};


// ---------------------- After all useState/useEffect ----------------------
if (userDocLoading || userDoc === undefined) {
  return <ActivityIndicator />;
}

// ✅ Add this just below it
if (!pageReady) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-500">
      <ActivityIndicator size="large" />
      <Text className="mt-3 text-white">Loading admin dashboard...</Text>
    </View>
  );
}


return (
  <View className="flex-1 bg-slate-500">
    {/* ================= ADMIN HEADER ================= */}
    <View className="bg-[#0B1C33] px-6 pt-3 pb-4 border-b border-blue-900/40 shadow-md">
      <View className="flex-row items-center mb-2">
        <Pressable
          onPress={() => router.back()}
          className="p-1 mr-2"
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={26} color="#ffffff" />
        </Pressable>

        <View className="flex-row items-center mr-2">
          <MaterialIcons
            name="admin-panel-settings"
            size={22}
            color="#60A5FA"
          />
        </View>

        <Text className="text-3xl font-extrabold text-white">Admin</Text>
      </View>

      <View className="flex-row items-center mt-1">
        <MaterialIcons name="settings" size={16} color="#38BDF8" />
        <Text className="text-blue-300 ml-1">
          Setup terms • classes • users
        </Text>
      </View>
    </View>

   <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
  <View className="p-4 space-y-4">
    {/* ================= INFINITE MOTION TEXT ================= */}
    <InfiniteMarquee />
{/* ✅ NEW: Set School Location */}
<Pressable
  onPress={() => router.push("/admin/setup-school-location")}
  className="rounded-2xl p-4 shadow flex-row items-center justify-between bg-yellow-200"
>
  <View className="flex-row items-center space-x-3">
    <View className="p-2 rounded-full bg-white/60">
      <MaterialIcons name="location-on" size={20} color="#1E293B" />
    </View>
    <View>
      <Text className="font-semibold text-yellow-800">
        Set School/Work Location
      </Text>
      <Text className="text-sm text-neutral mt-1">
        Define the geofence for attendance (GPS)
      </Text>
    </View>
  </View>
  <MaterialIcons name="chevron-right" size={20} color="#64748B" />
</Pressable>
    {/* ================= QUICK SETUP ================= */}
    <Text className="text-lg font-semibold">Quick setup</Text>


        {/* Manage Terms */}
        <Pressable
          onPress={() => router.push("/terms")}
          className={`rounded-2xl p-4 shadow flex-row items-center justify-between ${quickSetupColors.createTerm}`}
        >
          <View className="flex-row items-center space-x-3">
            <View className="p-2 rounded-full bg-white/60">
              <MaterialIcons
                name={quickSetupIcons.createTerm as any}
                size={20}
                color="#1E293B"
              />
            </View>
            <View>
              <Text className={`font-semibold ${quickSetupHeadingColors.createTerm}`}>
                Manage Terms
              </Text>
              <Text className="text-sm text-neutral mt-1">
                Create, edit & delete academic terms
              </Text>
            </View>
          </View>
          <View className="items-end">
            {loadingCounts ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-sm text-neutral">
                {termsCount ?? 0} existing
              </Text>
            )}
            <MaterialIcons name="chevron-right" size={20} color="#64748B" />
          </View>
        </Pressable>

        {/* Manage Students */}
        <Pressable
          onPress={() => router.push("/students")}
          className={`rounded-2xl p-4 shadow flex-row items-center justify-between ${quickSetupColors.manageStudents}`}
        >
          <View className="flex-row items-center space-x-3">
            <View className="p-2 rounded-full bg-white/60">
              <MaterialIcons
                name={quickSetupIcons.manageStudents as any}
                size={20}
                color="#1E293B"
              />
            </View>
            <View>
              <Text className={`font-semibold ${quickSetupHeadingColors.manageStudents}`}>
                Manage Students
              </Text>
              <Text className="text-sm text-neutral mt-1">
                Enroll or assign students to classes
              </Text>
            </View>
          </View>
          <View className="items-end">
            {loadingCounts ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-sm text-neutral">
                {studentsCount ?? 0} existing
              </Text>
            )}
            <MaterialIcons name="chevron-right" size={20} color="#64748B" />
          </View>
        </Pressable>
  {/* ✅ NEW: Manage Staff Button */}
          <Pressable
            onPress={() => router.push("/staff")}
            className={`rounded-2xl p-4 shadow flex-row items-center justify-between ${quickSetupColors.manageStaff}`}
          >
            <View className="flex-row items-center space-x-3">
              <View className="p-2 rounded-full bg-white/60">
                <MaterialIcons
                  name={quickSetupIcons.manageStaff as any}
                  size={20}
                  color="#1E293B"
                />
              </View>
              <View>
                <Text className={`font-semibold ${quickSetupHeadingColors.manageStaff}`}>
                  Manage Staff
                </Text>
                <Text className="text-sm text-neutral mt-1">
                  Enroll staff and manage biometric access
                </Text>
              </View>
            </View>
            <View className="items-end">
              {loadingCounts ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-sm text-neutral">
                  {staffCount ?? 0} existing
                </Text>
              )}
              <MaterialIcons name="chevron-right" size={20} color="#64748B" />
            </View>
          </Pressable>
          
        {/* Generate QRs */}
        <Pressable
          onPress={() => router.push("/students/qr-generator")}
          className={`rounded-2xl p-4 shadow flex-row items-center justify-between ${quickSetupColors.generateQRs}`}
        >
          <View className="flex-row items-center space-x-3">
            <View className="p-2 rounded-full bg-white/60">
              <MaterialIcons
                name={quickSetupIcons.generateQRs as any}
                size={20}
                color="#1E293B"
              />
            </View>
            <View>
              <Text className={`font-semibold ${quickSetupHeadingColors.generateQRs}`}>
                Students QR Cards
              </Text>
              <Text className="text-sm text-neutral mt-1">
                Generate signed QR codes for students
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#64748B" />
        </Pressable>

{/* ✅ NEW: Generate Staff QR Cards */}
<Pressable
  onPress={() => router.push("/attendance/staff-qr-generator")}
  className={`rounded-2xl p-4 shadow flex-row items-center justify-between mt-4 ${quickSetupColors.generateStaffQR}`}
>
  <View className="flex-row items-center space-x-3">
    <View className="p-2 rounded-full bg-white/60">
     <MaterialIcons
  name="qr-code-scanner"
  size={20} 
  color="#1E293B"
/>

    </View>
    <View>
      <Text className={`font-semibold ${quickSetupHeadingColors.generateStaffQR}`}>
        Staff QR Cards
      </Text>
      <Text className="text-sm text-neutral mt-1">
        Generate digital ID cards for staff
      </Text>
    </View>
  </View>
  <MaterialIcons name="chevron-right" size={20} color="#64748B" />
</Pressable>

        {/* Manage Classes */}
        <Pressable
          onPress={() => router.push("/admin/classes" as any)}
          className="rounded-2xl p-4 shadow bg-emerald-100 flex-row items-center justify-between"
        >
          <View className="flex-row items-center space-x-3">
            <View className="p-2 rounded-full bg-white/60">
              <MaterialIcons name="library-books" size={20} color="#065F46" />
            </View>
            <View>
              <Text className="font-semibold text-emerald-800">
                Manage Classes
              </Text>
              <Text className="text-sm text-neutral mt-1">
                Create, edit & delete classes
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#64748B" />
        </Pressable>

        {/* Manage Users */}
        <Pressable
          onPress={() => router.push("/users")}
          className={`rounded-2xl p-4 shadow flex-row items-center justify-between ${quickSetupColors.manageUsers}`}
        >
          <View className="flex-row items-center space-x-3">
            <View className="p-2 rounded-full bg-white/60">
              <MaterialIcons
                name={quickSetupIcons.manageUsers as any}
                size={20}
                color="#1E293B"
              />
            </View>
            <View>
              <Text className={`font-semibold ${quickSetupHeadingColors.manageUsers}`}>
                Manage Users
              </Text>
              <Text className="text-sm text-neutral mt-1">
                Assign wards, roles & edit users
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#64748B" />
        </Pressable>

      {/* ================= CLASSES (Expandable) ================= */}
<Pressable
  onPress={() => setClassesExpanded((v) => !v)}
  className="rounded-2xl p-4 shadow bg-emerald-50 flex-row items-center justify-between "
>
  <View className="flex-row items-center space-x-3">
    <View className="p-2 rounded-full bg-white/70">
      {/* Changed icon here */}
      <MaterialIcons name="group-add" size={22} color="#065F46" />
    </View>

    <View>
      <Text className="font-semibold text-emerald-800">
        Assign Students to Classes
      </Text>
      <Text className="text-sm text-neutral mt-1">
        Select a class to assign students
      </Text>
    </View>
  </View>

 
  <MaterialIcons
    name={classesExpanded ? "expand-less" : "expand-more"}
    size={24}
    color="#065F46"
  />
</Pressable>

{classesExpanded && (
  <View className="mt-2 space-y-2">
    {loadingClasses ? (
      <ActivityIndicator className="mt-2" />
    ) : classes.length === 0 ? (
      <Text className="text-neutral mt-2 px-2">
        No classes available.
      </Text>
    ) : (
      classes.map((cls) => (
        <Pressable
          key={cls.id}
          onPress={() => router.push(`/admin/classes/${cls.id}`)}
          className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between shadow"
        >
          <View>
            <Text className="font-semibold text-dark">
              {cls.name}
            </Text>

            {!!cls.description && (
              <Text className="text-sm text-neutral mt-1">
                {cls.description}
              </Text>
            )}
          </View>

          <MaterialIcons
            name="chevron-right"
            size={20}
            color="#64748B"
          />
        </Pressable>
      ))
    )}
  </View>
)}

        {/* ================= ATTENDANCE ================= */}
        <View className="bg-white rounded-2xl p-4 shadow mt-6">
          <Text className="font-semibold text-lg mb-2">
            Attendance Management
          </Text>
          <Text className="text-slate-600 text-sm mb-3">
            Manage and review attendance records using these settings.
          </Text>

          <Pressable
            onPress={() => router.push("/admin/attendance-settings")}
             className="bg-indigo-600 rounded-xl p-4 items-center"
          >
            <Text className="text-white font-semibold text-lg">
              Go to Attendance Time
            </Text>
          </Pressable>
       

        </View>
      </View>
    </ScrollView>
  </View>
)};
