// mobile/app/attendance/list.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, Pressable } from "react-native";
import { getAttendanceForDate } from "../../src/services/attendance"; // <-- updated import
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import { listStaff } from "../../src/services/staff";
import type { Staff } from "../../src/services/types";
import { listStaffGroups, type StaffGroup } from "../../src/services/staffGroups";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceList() {
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [group, setGroup] = useState("");

  useEffect(() => {
    load();
    Promise.all([listStaff(), listStaffGroups()]).then(([s, g]) => { setStaff(s); setGroups(g); }).catch(console.error);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await getAttendanceForDate(todayISO());
      setRows(d);
    } catch (err: any) {
      console.error("getAttendanceForDate", err);
    } finally {
      setLoading(false);
    }
  }

  if (adminLoading || !adminReady || loading)
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );

  const staffMap = new Map<string, Staff>(staff.flatMap(s => [s.id ? [s.id, s] : [], s.staffId ? [s.staffId, s] : []] as [string, Staff][]));
  const visibleRows = rows.filter(row => !group || (row.subjectType === "staff" && staffMap.get(row.subjectId ?? row.staffId)?.staffGroupId === group));
  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-xl font-semibold mb-4">Today’s Attendance</Text>

      <View className="flex-row flex-wrap gap-2 mb-3"><Pressable onPress={() => setGroup("")} className={`px-3 py-2 rounded-xl ${!group ? "bg-primary" : "bg-white border"}`}><Text className={!group ? "text-white" : "text-dark"}>All groups</Text></Pressable>{groups.map(g => <Pressable key={g.id} onPress={() => setGroup(g.id!)} className={`px-3 py-2 rounded-xl ${group === g.id ? "bg-primary" : "bg-white border"}`}><Text className={group === g.id ? "text-white" : "text-dark"}>{g.name}</Text></Pressable>)}</View>
      <FlatList
        data={visibleRows}
        keyExtractor={(i, idx) => i.id ?? String(idx)}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-3 shadow-sm">
            <Text className="font-semibold text-dark">{item.studentName ?? item.studentId}</Text>
            <Text className="text-sm text-neutral mt-1">
              In: {item.checkInTime ?? "—"} • Out: {item.checkOutTime ?? "—"}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text className="text-center text-neutral mt-8">No attendance recorded today.</Text>}
      />
    </View>
  );
}
