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
    { title: label, value: rows.length, color: "text-slate-900" },
    { title: "P", value: totals.present, color: "text-emerald-600" },
    { title: "L", value: totals.late, color: "text-amber-600" },
    { title: "T", value: totals.attended, color: "text-sky-700" },
    { title: "A", value: totals.absent, color: "text-red-500" },
    { title: "%", value: `${totals.percentagePresent.toFixed(1)}%`, color: "text-slate-900" },
  ];

  return (
    <View className="mt-3 mb-2 flex-row flex-wrap justify-between">
      {cards.map((card) => (
        <View key={card.title} className="mb-2 w-[31.5%] rounded-lg bg-white p-3 shadow">
          <Text className="text-xs font-semibold text-slate-500">{card.title}</Text>
          <Text className={`mt-1 text-xl font-extrabold ${card.color}`}>{card.value}</Text>
        </View>
      ))}
    </View>
  );
}
