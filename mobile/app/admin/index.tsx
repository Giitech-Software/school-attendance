import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useCurrentUser from "../../src/hooks/useCurrentUser";
import { allowsStudentAndParentFeatures } from "../../src/services/tenantScope";
import { listTerms } from "../../src/services/terms";
import { listWeeks } from "../../src/services/weeks";
import { listClasses } from "../../src/services/classes";
import { listStudents } from "../../src/services/students";
import { listStaff } from "../../src/services/staff";
import {
  getSchoolLocationReadiness,
  type SchoolLocationReadiness,
} from "../../src/services/locationGuard";
import { getTenantById, type Tenant } from "../../src/services/tenants";

type ClassRow = {
  id: string;
  name: string;
  description?: string;
};

type ActionItem = {
  label: string;
  description: string;
  route: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  iconBackground: string;
  iconColor: string;
  schoolOnly?: boolean;
  superAdminOnly?: boolean;
};

type ActionGroup = {
  title: string;
  description: string;
  items: ActionItem[];
};

const groups: ActionGroup[] = [
  {
    title: "People & access",
    description: "Manage everyone who uses the attendance system.",
    items: [
      { label: "Manage Students", description: "Enroll and assign students", route: "/students", icon: "school", iconBackground: "#E0F2FE", iconColor: "#0369A1", schoolOnly: true },
      { label: "Manage Staff", description: "Enroll staff and manage access", route: "/staff", icon: "badge", iconBackground: "#FFEDD5", iconColor: "#C2410C" },
      { label: "Manage Users", description: "Assign roles and edit users", route: "/users", icon: "people", iconBackground: "#FFE4E6", iconColor: "#BE123C" },
      { label: "Promote Students", description: "Move students between classes", route: "/admin/promote-students", icon: "upgrade", iconBackground: "#CFFAFE", iconColor: "#0E7490", schoolOnly: true },
    ],
  },
  {
    title: "Academic setup",
    description: "Organise the academic calendar and class structure.",
    items: [
      { label: "Manage Terms", description: "Create and edit academic terms", route: "/terms", icon: "calendar-today", iconBackground: "#FEF3C7", iconColor: "#B45309", schoolOnly: true },
      { label: "Manage Classes", description: "Create and edit classes", route: "/admin/classes", icon: "library-books", iconBackground: "#D1FAE5", iconColor: "#047857", schoolOnly: true },
    ],
  },
  {
    title: "Attendance & identification",
    description: "Configure attendance rules, verification, and ID cards.",
    items: [
      { label: "Presence Verification", description: "Configure location and network checks", route: "/admin/setup-school-location", icon: "location-on", iconBackground: "#FEE2E2", iconColor: "#B91C1C" },
      { label: "Attendance Settings", description: "Set time windows and policies", route: "/admin/attendance-settings", icon: "schedule", iconBackground: "#E2E8F0", iconColor: "#334155" },
      { label: "Student QR Cards", description: "Generate signed student cards", route: "/students/qr-generator", icon: "qr-code", iconBackground: "#EDE9FE", iconColor: "#6D28D9", schoolOnly: true },
      { label: "Staff QR Cards", description: "Generate staff ID cards", route: "/attendance/staff-qr-generator", icon: "qr-code-scanner", iconBackground: "#E0E7FF", iconColor: "#4338CA" },
    ],
  },
  {
    title: "Support & oversight",
    description: "Find guidance and review administrative activity.",
    items: [
      { label: "User Manual", description: "Open the guide for all app pages", route: "/admin/user-manual", icon: "menu-book", iconBackground: "#DBEAFE", iconColor: "#1D4ED8" },
      { label: "Activity Logs", description: "Review user and admin actions", route: "/admin/activity-logs", icon: "history", iconBackground: "#F1F5F9", iconColor: "#334155" },
      { label: "Tenant Organisations", description: "Manage organisations and subscriptions", route: "/super-admin", icon: "verified-user", iconBackground: "#CFFAFE", iconColor: "#0E7490", superAdminOnly: true },
    ],
  },
];

const schoolMotionItems = [
  { label: "Manage Terms", color: "#FCA5A5" },
  { label: "Manage Students", color: "#93C5FD" },
  { label: "Generate QR Cards", color: "#FDE047" },
  { label: "Manage Classes", color: "#6EE7B7" },
  { label: "Manage Users", color: "#FFFFFF" },
  { label: "Assign Students", color: "#FCA5A5" },
  { label: "Attendance Settings", color: "#7DD3FC" },
];

function AdminMotionStrip({ allowsSchoolFeatures }: { allowsSchoolFeatures: boolean }) {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const items = React.useMemo(
    () => allowsSchoolFeatures
      ? schoolMotionItems
      : schoolMotionItems.filter((item) => !["Manage Terms", "Manage Students", "Manage Classes", "Assign Students"].includes(item.label)),
    [allowsSchoolFeatures]
  );

  React.useEffect(() => {
    translateX.setValue(0);
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -(items.length * 165),
        duration: Math.max(12000, items.length * 3200),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [items.length, translateX]);

  return (
    <View className="mb-3 overflow-hidden rounded-xl border border-blue-900/40 bg-[#0B1C33] py-2.5">
      <Animated.View className="flex-row" style={{ transform: [{ translateX }] }}>
        {[...items, ...items].map((item, index) => (
          <View key={`${item.label}-${index}`} className="ml-3 shrink-0 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5">
            <Text className="text-sm font-semibold" style={{ color: item.color }}>{item.label}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function ActionRow({ item, onPress, isLast }: { item: ActionItem; onPress: () => void; isLast: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#DBEAFE" }}
      className={`flex-row items-center px-4 py-3.5 ${isLast ? "" : "border-b border-slate-200"}`}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: item.iconBackground }}>
        <MaterialIcons name={item.icon} size={22} color={item.iconColor} />
      </View>
      <View className="ml-3 flex-1" style={{ minWidth: 0 }}>
        <Text className="font-bold text-slate-900">{item.label}</Text>
        <Text className="mt-0.5 text-sm text-slate-500">{item.description}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
    </Pressable>
  );
}

export default function AdminIndex() {
  const router = useRouter();
  const { userDoc, loading: userDocLoading } = useCurrentUser();
  const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);
  const isSuperAdmin = userDoc?.role === "super_admin";
  const personnelLabel = allowsSchoolFeatures ? "Staff" : userDoc?.tenantType === "company" ? "Employees" : "Personnel";
  const isAdmin = userDoc?.role === "admin" || isSuperAdmin;
  const presenceLabel = allowsSchoolFeatures ? "school geofence" : "workplace verification";
  const setupSubtitle = allowsSchoolFeatures ? "Terms, classes, people & attendance" : `${personnelLabel}, users & attendance`;

  const [loading, setLoading] = React.useState(true);
  const [termsCount, setTermsCount] = React.useState(0);
  const [weeksCount, setWeeksCount] = React.useState(0);
  const [studentsCount, setStudentsCount] = React.useState(0);
  const [staffCount, setStaffCount] = React.useState(0);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [classesExpanded, setClassesExpanded] = React.useState(false);
  const [locationReadiness, setLocationReadiness] = React.useState<SchoolLocationReadiness | null>(null);
  const [currentTenant, setCurrentTenant] = React.useState<Tenant | null>(null);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    try {
      const [terms, weeks, classRows, students, staff, readiness] = await Promise.all([
        allowsSchoolFeatures ? listTerms().catch(() => []) : Promise.resolve([]),
        allowsSchoolFeatures ? listWeeks().catch(() => []) : Promise.resolve([]),
        allowsSchoolFeatures ? listClasses().catch(() => []) : Promise.resolve([]),
        allowsSchoolFeatures ? listStudents().catch(() => []) : Promise.resolve([]),
        listStaff().catch(() => []),
        getSchoolLocationReadiness().catch(() => null),
      ]);
      setTermsCount(terms.length);
      setWeeksCount(weeks.length);
      setClasses(classRows as ClassRow[]);
      setStudentsCount(students.length);
      setStaffCount(staff.length);
      setLocationReadiness(readiness);
    } finally {
      setLoading(false);
    }
  }, [allowsSchoolFeatures]);

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
  }, [isAdmin, router, userDoc, userDocLoading]);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  React.useEffect(() => {
    let active = true;
    if (!userDoc?.tenantId || isSuperAdmin) {
      setCurrentTenant(null);
      return;
    }
    getTenantById(userDoc.tenantId)
      .then((tenant) => { if (active) setCurrentTenant(tenant); })
      .catch(() => { if (active) setCurrentTenant(null); });
    return () => { active = false; };
  }, [isSuperAdmin, userDoc?.tenantId]);

  if (userDocLoading || userDoc === undefined) {
    return <View className="flex-1 items-center justify-center bg-slate-100"><ActivityIndicator size="large" color="#1D4ED8" /></View>;
  }

  const attendanceReady = Boolean(locationReadiness?.configured) || Boolean(locationReadiness?.emergencyBypassActive);
  const summaries = allowsSchoolFeatures
    ? [
        { label: "Terms", value: termsCount, color: "#B91C1C", background: "#FEF2F2" },
        { label: "Weeks", value: weeksCount, color: "#B45309", background: "#FFFBEB" },
        { label: "Classes", value: classes.length, color: "#047857", background: "#ECFDF5" },
        { label: "Students", value: studentsCount, color: "#0369A1", background: "#F0F9FF" },
        { label: "Staff", value: staffCount, color: "#C2410C", background: "#FFF7ED" },
      ]
    : [{ label: personnelLabel, value: staffCount, color: "#C2410C", background: "#FFF7ED" }];

  return (
    <View className="flex-1 bg-slate-100">
      <View className="border-b border-blue-900/40 bg-[#0B1C33] px-5 pb-4 pt-3">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-2 p-1" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={25} color="#FFFFFF" />
          </Pressable>
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20">
            <MaterialIcons name="verified-user" size={21} color="#93C5FD" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-2xl font-extrabold text-white">Administration</Text>
            <Text className="mt-0.5 text-sm text-blue-200">{setupSubtitle}</Text>
          </View>
          <Pressable onPress={loadDashboard} disabled={loading} className="h-10 w-10 items-center justify-center rounded-lg border border-white/20">
            {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="refresh" size={21} color="#FFFFFF" />}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <AdminMotionStrip allowsSchoolFeatures={allowsSchoolFeatures} />

        {currentTenant?.inviteCode ? (
          <View className="mb-3 rounded-xl border border-cyan-200 bg-white p-4">
            <Text className="text-xs font-bold uppercase tracking-wider text-cyan-700">Organisation invite</Text>
            <View className="mt-2 flex-row items-center">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-extrabold text-slate-900">{currentTenant.name}</Text>
                <Text className="mt-1 text-sm text-slate-500">Share this code with expected users during signup.</Text>
              </View>
              <View className="rounded-lg bg-cyan-50 px-3 py-2">
                <Text className="text-center text-xs font-bold text-cyan-700">CODE</Text>
                <Text className="font-mono text-xl font-extrabold text-cyan-950">{currentTenant.inviteCode}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          {summaries.map((summary) => (
            <View key={summary.label} className="mr-2 min-w-24 rounded-xl border border-slate-200 px-3 py-2.5" style={{ backgroundColor: summary.background }}>
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">{summary.label}</Text>
              <Text className="mt-1 text-2xl font-extrabold" style={{ color: summary.color }}>{loading ? "—" : summary.value}</Text>
            </View>
          ))}
        </ScrollView>

        <View className={`mb-3 rounded-xl border p-4 ${attendanceReady ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <View className="flex-row items-start">
            <View className={`h-10 w-10 items-center justify-center rounded-lg ${attendanceReady ? "bg-emerald-100" : "bg-red-100"}`}>
              <MaterialIcons name={attendanceReady ? "location-on" : "warning"} size={21} color={attendanceReady ? "#047857" : "#B91C1C"} />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`font-extrabold ${attendanceReady ? "text-emerald-800" : "text-red-800"}`}>Attendance readiness</Text>
              <Text className="mt-1 text-sm leading-5 text-slate-600">
                {attendanceReady
                  ? locationReadiness?.emergencyBypassActive ? "Emergency bypass is active for the approved period." : `${presenceLabel} is configured and ready.`
                  : `Attendance is blocked until ${presenceLabel} is configured.`}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => router.push("/admin/setup-school-location")} className={`mt-3 items-center rounded-lg px-4 py-3 ${attendanceReady ? "border border-slate-300 bg-white" : "bg-blue-700"}`}>
            <Text className={`font-bold ${attendanceReady ? "text-slate-700" : "text-white"}`}>{attendanceReady ? "Review verification" : "Configure now"}</Text>
          </Pressable>
        </View>

        {groups.map((group) => {
          const items = group.items.filter((item) => (!item.schoolOnly || allowsSchoolFeatures) && (!item.superAdminOnly || isSuperAdmin));
          if (!items.length) return null;
          return (
            <View key={group.title} className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <View className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <Text className="font-extrabold text-slate-900">{group.title}</Text>
                <Text className="mt-0.5 text-sm text-slate-500">{group.description}</Text>
              </View>
              {items.map((item, index) => {
                const displayItem = item.route === "/staff" && !allowsSchoolFeatures
                  ? { ...item, label: `Manage ${personnelLabel}`, description: `Enroll ${personnelLabel.toLowerCase()} and manage attendance access` }
                  : item;
                return <ActionRow key={item.route} item={displayItem} isLast={index === items.length - 1} onPress={() => router.push(item.route as never)} />;
              })}
            </View>
          );
        })}

        {allowsSchoolFeatures ? (
          <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Pressable onPress={() => setClassesExpanded((value) => !value)} className="flex-row items-center px-4 py-3.5">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                <MaterialIcons name="group-add" size={22} color="#047857" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-bold text-slate-900">Assign students to classes</Text>
                <Text className="mt-0.5 text-sm text-slate-500">Select a class to manage assignments</Text>
              </View>
              <MaterialIcons name={classesExpanded ? "expand-less" : "expand-more"} size={23} color="#64748B" />
            </Pressable>
            {classesExpanded ? (
              <View className="border-t border-slate-200 bg-slate-50 p-2">
                {classes.length ? classes.map((item) => (
                  <Pressable key={item.id} onPress={() => router.push(`/admin/classes/${item.id}` as never)} className="mb-1 flex-row items-center rounded-lg bg-white px-3 py-3 last:mb-0">
                    <View className="flex-1">
                      <Text className="font-bold text-slate-900">{item.name}</Text>
                      {item.description ? <Text className="mt-0.5 text-sm text-slate-500">{item.description}</Text> : null}
                    </View>
                    <MaterialIcons name="chevron-right" size={21} color="#94A3B8" />
                  </Pressable>
                )) : <Text className="px-2 py-3 text-sm text-slate-500">No classes available.</Text>}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
