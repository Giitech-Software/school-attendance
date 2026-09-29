type Props = {
  present: number;
  late: number;
  absent: number;
  title?: string;
};

const series = [
  { key: "present", label: "Present", color: "#10b981" },
  { key: "late", label: "Late", color: "#f59e0b" },
  { key: "absent", label: "Absent", color: "#ef4444" },
] as const;

export default function AttendanceOverviewCharts({ present, late, absent, title = "Attendance overview" }: Props) {
  const values = { present: Math.max(0, present), late: Math.max(0, late), absent: Math.max(0, absent) };
  const total = values.present + values.late + values.absent;
  const max = Math.max(1, ...Object.values(values));
  const pie = total
    ? `conic-gradient(#10b981 0deg ${(values.present / total) * 360}deg, #f59e0b ${(values.present / total) * 360}deg ${((values.present + values.late) / total) * 360}deg, #ef4444 ${((values.present + values.late) / total) * 360}deg 360deg)`
    : "#e2e8f0";
  const points = series.map((item, index) => {
    const x = 35 + index * 115;
    const y = 105 - (values[item.key] / max) * 75;
    return { ...item, value: values[item.key], x, y };
  });

  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        <article className="enterprise-panel p-4">
          <h4 className="text-sm font-bold text-slate-800">Attendance distribution</h4>
          <div className="mt-3 flex items-center gap-4">
            <div className="h-28 w-28 shrink-0 rounded-full" style={{ background: pie }} role="img" aria-label={total ? `${values.present} present, ${values.late} late, ${values.absent} absent` : "No attendance data"} />
            <div className="space-y-2 text-sm font-semibold text-slate-700">
              {series.map((item) => <div key={item.key}><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />{item.label}: {values[item.key]}</div>)}
            </div>
          </div>
        </article>

        <article className="enterprise-panel p-4">
          <h4 className="text-sm font-bold text-slate-800">Attendance totals</h4>
          <div className="mt-4 space-y-3" role="img" aria-label="Bar chart of present, late, and absent totals">
            {series.map((item) => <div key={item.key}>
              <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600"><span>{item.label}</span><span>{values[item.key]}</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${total ? (values[item.key] / max) * 100 : 0}%`, backgroundColor: item.color }} /></div>
            </div>)}
          </div>
        </article>

        <article className="enterprise-panel p-4">
          <h4 className="text-sm font-bold text-slate-800">Status comparison</h4>
          <svg viewBox="0 0 300 140" className="mt-2 h-28 w-full" role="img" aria-label="Line graph comparing attendance status totals">
            <line x1="25" y1="108" x2="275" y2="108" stroke="#cbd5e1" />
            <polyline fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
            {points.map((point) => <g key={point.key}>
              <circle cx={point.x} cy={point.y} r="5" fill={point.color}><title>{point.label}: {point.value}</title></circle>
              <text x={point.x} y="130" textAnchor="middle" fontSize="10" fill="#475569">{point.label}</text>
            </g>)}
          </svg>
        </article>
      </div>
      {!total ? <p className="text-xs text-slate-500">No attendance has been recorded for this report yet; charts are shown with empty values.</p> : null}
    </section>
  );
}
