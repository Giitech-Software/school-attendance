import React from "react";
import { View, Text } from "react-native";

type AttendanceTotalRow = {
  presentCount?: number;
  lateCount?: number;
  absentCount?: number;
  attendedSessions?: number;
};

export function getAttendanceTotals(rows: AttendanceTotalRow[]) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.present += Number(row.presentCount ?? 0);
      acc.late += Number(row.lateCount ?? 0);
      acc.absent += Number(row.absentCount ?? 0);
      acc.attended += Number(row.attendedSessions ?? Number(row.presentCount ?? 0) + Number(row.lateCount ?? 0));
      return acc;
    },
    { present: 0, late: 0, absent: 0, attended: 0 }
  );

  const total = totals.attended + totals.absent;
  return {
    ...totals,
    total,
    percentagePresent: total === 0 ? 0 : Number(((totals.attended / total) * 100).toFixed(1)),
  };
}

export default function AttendanceTotalsCards({ rows, label }: { rows: AttendanceTotalRow[]; label: string }) {
  const totals = getAttendanceTotals(rows);

  const cards = [
    { title: label, value: rows.length, color: "text-slate-900", accent: "border-l-slate-500", bg: "bg-slate-50" },
    { title: "Present", value: totals.present, color: "text-emerald-600", accent: "border-l-emerald-500", bg: "bg-emerald-50" },
    { title: "Late", value: totals.late, color: "text-amber-600", accent: "border-l-amber-500", bg: "bg-amber-50" },
    { title: "Attended", value: totals.attended, color: "text-sky-700", accent: "border-l-sky-500", bg: "bg-sky-50" },
    { title: "Absent", value: totals.absent, color: "text-red-500", accent: "border-l-red-500", bg: "bg-red-50" },
    { title: "Attendance %", value: `${totals.percentagePresent.toFixed(1)}%`, color: "text-slate-900", accent: "border-l-indigo-500", bg: "bg-indigo-50" },
  ];

  return (
    <View className="mt-4 mb-3 flex-row flex-wrap justify-between">
      {cards.map((card) => (
        <View key={card.title} className={`mb-3 w-[48%] min-h-[82px] rounded-xl border border-slate-200 border-l-4 p-3 shadow-sm ${card.bg} ${card.accent}`}>
          <Text className="text-sm font-semibold text-slate-500">{card.title}</Text>
          <Text className={`mt-1 text-2xl font-extrabold ${card.color}`}>{card.value}</Text>
        </View>
      ))}
    </View>
  );
}
