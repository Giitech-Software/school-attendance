type AttendanceTotalRow = {
  presentCount?: number;
  lateCount?: number;
  absentCount?: number;
  attendedSessions?: number;
};

type AttendanceTotalsCardsProps = {
  rows: AttendanceTotalRow[];
  subjectLabel: string;
  groupLabel?: string;
  onSelectMetric?: (metric: "present" | "late" | "attended" | "absent" | null) => void;
  selectedMetric?: string | null;
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

export default function AttendanceTotalsCards({ rows, subjectLabel, groupLabel, onSelectMetric, selectedMetric }: AttendanceTotalsCardsProps) {
  const totals = getAttendanceTotals(rows);

  return (
    <div className="report-summary-grid">
      <div className="report-summary-card">
        <p>{groupLabel ?? `Total ${subjectLabel}`}</p>
        <strong>{rows.length}</strong>
      </div>
      <button type="button" onClick={() => onSelectMetric?.("present")} className={`report-summary-card text-left ${selectedMetric === "present" ? "ring-2 ring-emerald-400" : ""}`}>
        <p>Present</p>
        <strong className="text-emerald-700">{totals.present}</strong>
      </button>
      <button type="button" onClick={() => onSelectMetric?.("late")} className={`report-summary-card text-left ${selectedMetric === "late" ? "ring-2 ring-amber-400" : ""}`}>
        <p>Late</p>
        <strong className="text-amber-700">{totals.late}</strong>
      </button>
      <button type="button" onClick={() => onSelectMetric?.("attended")} className={`report-summary-card text-left ${selectedMetric === "attended" ? "ring-2 ring-sky-400" : ""}`} title="Attended (Present + Late)">
        <p>T</p>
        <strong className="text-sky-700">{totals.attended}</strong>
      </button>
      <button type="button" onClick={() => onSelectMetric?.("absent")} className={`report-summary-card text-left ${selectedMetric === "absent" ? "ring-2 ring-red-400" : ""}`}>
        <p>Absent</p>
        <strong className="text-red-600">{totals.absent}</strong>
      </button>
      <div className="report-summary-card">
        <p>Attendance %</p>
        <strong className="text-slate-900">{totals.percentagePresent.toFixed(1)}%</strong>
      </div>
    </div>
  );
}
