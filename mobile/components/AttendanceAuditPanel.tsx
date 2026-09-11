import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { getAttendanceAudit, type AttendanceAuditRow } from "../src/services/attendanceAudit";
import { listStaff } from "../src/services/staff";
import { listStudents } from "../src/services/students";

function fromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

type AuditGroup = [string, AttendanceAuditRow[], string, "late" | "early" | "missingSignOut"];

export default function AttendanceAuditPanel() {
  const [rows, setRows] = useState<AttendanceAuditRow[]>([]);

  useEffect(() => {
    void Promise.all([
      getAttendanceAudit(fromDate(), new Date().toISOString().slice(0, 10)),
      listStaff(),
      listStudents(),
    ]).then(([audit, staff, students]) => {
      const labels = new Map<string, string>();
      staff.forEach((item: any) => labels.set(item.id, item.staffId || item.staffCode || item.employeeId || item.name || "Staff member"));
      students.forEach((item: any) => labels.set(item.id, item.studentId || item.rollNo || item.name || "Student"));
      setRows(audit.map((row) => ({ ...row, displayId: labels.get(row.personId) })));
    }).catch(() => setRows([]));
  }, []);

  const groups: AuditGroup[] = [
    ["Habitual late", rows.filter((row) => row.late >= 3), "text-amber-800", "late"],
    ["Early departures", rows.filter((row) => row.early > 0), "text-sky-800", "early"],
    ["Missing sign-outs", rows.filter((row) => row.missingSignOut > 0), "text-red-800", "missingSignOut"],
  ];

  return (
    <View className="mt-5 rounded-3xl bg-white p-5">
      <Text className="text-xl font-extrabold text-slate-900">Attendance audit</Text>
      <Text className="mt-1 text-base font-medium text-slate-700">Last 30 days · admin follow-up indicators</Text>
      {!rows.length ? <Text className="mt-4 text-base text-emerald-700">No attendance follow-up indicators found.</Text> : groups.map(([title, items, color, key]) => (
        <View key={title} className="mt-4 rounded-2xl bg-slate-50 p-4">
          <View className="flex-row justify-between">
            <Text className={`text-base font-extrabold ${color}`}>{title}</Text>
            <Text className="text-xl font-black text-slate-900">{items.length}</Text>
          </View>
          {items.slice(0, 5).map((row) => (
            <View key={row.personId} className="mt-2 flex-row justify-between">
              <Text className="flex-1 text-base font-semibold text-slate-700">{row.displayId || "Person"}</Text>
              <Text className="font-black text-slate-900">{row[key]}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
