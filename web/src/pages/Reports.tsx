import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAttendanceSummary, type AttendanceSummary } from "../services/attendanceSummary";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import useCurrentUser from "../hooks/useCurrentUser";
import ImageCarousel from "../components/ImageCarousel";
import { allowsStudentAndParentFeatures } from "../services/tenantScope";
import AttendanceAuditPanel from "../components/AttendanceAuditPanel";

type ReportType = "student" | "staff";
type SummaryRow = AttendanceSummary | StaffAttendanceSummary;

function getPreviewRange(type: ReportType) {
  const today = new Date();

  if (type === "staff") {
    const from = new Date();
    from.setDate(today.getDate() - 29);
    return {
      fromIso: from.toISOString().slice(0, 10),
      toIso: today.toISOString().slice(0, 10),
      label: "Last 30 days (preview)",
    };
  }

  const dates: Date[] = [];
  const current = new Date();
  while (dates.length < 5) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(current));
    current.setDate(current.getDate() - 1);
  }

  return {
    fromIso: dates[dates.length - 1].toISOString().slice(0, 10),
    toIso: dates[0].toISOString().slice(0, 10),
    label: "Last 5 school days (preview)",
  };
}

const studentLinks = [
  { title: "Daily Attendance", subtitle: "Preview by day - Last 5 school days", href: "/reports/daily", tone: "border-l-purple-500 text-purple-600" },
  { title: "Weekly Reports", subtitle: "Attendance grouped by school week", href: "/reports/weekly", tone: "border-l-indigo-500 text-indigo-600" },
  { title: "Monthly Reports", subtitle: "Attendance grouped by calendar month", href: "/reports/monthly", tone: "border-l-teal-500 text-teal-600" },
  { title: "Termly Reports", subtitle: "Summaries by term", href: "/reports/termly", tone: "border-l-rose-500 text-rose-600" },
  { title: "Yearly Reports", subtitle: "Full-year attendance summaries", href: "/reports/yearly", tone: "border-l-orange-500 text-orange-600" },
];

const staffLinks = [
  { title: "Daily Attendance", subtitle: "Preview by day - staff", href: "/reports/staff-daily", tone: "border-l-purple-500 text-purple-600" },
  { title: "Weekly Reports", subtitle: "Staff attendance grouped by week", href: "/reports/staff-weekly", tone: "border-l-indigo-500 text-indigo-600" },
  { title: "Monthly Reports", subtitle: "Staff attendance grouped by month", href: "/reports/staff-monthly", tone: "border-l-teal-500 text-teal-600" },
  { title: "Termly Reports", subtitle: "Staff summaries by term", href: "/reports/staff-termly", tone: "border-l-rose-500 text-rose-600", schoolOnly: true },
  { title: "Yearly Reports", subtitle: "Full-year staff summaries", href: "/reports/staff-yearly", tone: "border-l-orange-500 text-orange-600" },
];

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { userDoc, loading: userLoading } = useCurrentUser();
  const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);
  const personnelLabel = allowsSchoolFeatures ? "Staff" : userDoc?.tenantType === "company" ? "Employee" : "Personnel";
  const [reportType, setReportType] = useState<ReportType>(searchParams.get("type") === "staff" ? "staff" : "student");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [previewLabel, setPreviewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const type = !allowsSchoolFeatures || searchParams.get("type") === "staff" ? "staff" : "student";
    setReportType(type);
  }, [allowsSchoolFeatures, searchParams]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const range = getPreviewRange(reportType);
        if (active) setPreviewLabel(range.label);

        const rows =
          reportType === "student"
            ? await getAttendanceSummary({ fromIso: range.fromIso, toIso: range.toIso, includeStudentName: false })
            : await getStaffGlobalSummary(range.fromIso, range.toIso);

        if (active) setSummary(rows);
      } catch (err: any) {
        console.error("reports dashboard load", err);
        if (active) setError(err?.message ?? "Failed to load reports preview.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reportType]);

  const totals = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;

    for (const row of summary) {
      present += Number(row.presentCount ?? 0);
      late += Number(row.lateCount ?? 0);
      absent += Number(row.absentCount ?? 0);
    }

    const attended = present + late;
    const total = attended + absent;
    return {
      present,
      late,
      absent,
      attended,
      pct: total === 0 ? 0 : (attended / total) * 100,
    };
  }, [summary]);

  function changeType(type: ReportType) {
    if (type === "student" && !allowsSchoolFeatures) return;
    setSearchParams({ type });
  }

  if (userLoading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-600">Checking access...</div>;
  }

  if (userDoc?.role !== "admin" && userDoc?.role !== "super_admin") {
    return (
      <div className="mx-auto max-w-lg enterprise-panel p-6 text-center">
        <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-500">You do not have permission to view reports.</p>
      </div>
    );
  }

  const tiles = reportType === "student" && allowsSchoolFeatures ? studentLinks : staffLinks.filter((link) => !link.schoolOnly || allowsSchoolFeatures);

  return (
    <div className="space-y-3">
      <section className="enterprise-panel -mx-3 rounded-none overflow-hidden sm:-mx-4 lg:-mx-5">
        <div className="grid gap-0">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-3 py-3 text-white sm:px-4 lg:border-b-0">
            <Link to="/" className="shrink-0 rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back home">Back</Link>
            <div>
              <h1 className="text-xl font-extrabold">Reports</h1>
              <p className="mt-1 text-xs text-white/70">Quick previews - tap a tile to open detailed reports.</p>
            </div>
          </div>
          <ImageCarousel images={[{ src: "/reports-1.webp", alt: "Student and staff attendance reports" }, { src: "/reports-2.webp", alt: "Attendance summaries" }, { src: "/reports-3.webp", alt: "Attendance audit reports" }, { src: "/reports-4.webp", alt: "Attendance analytics" }]} />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_34rem]">
        <div className="space-y-3">
          <div className="enterprise-panel p-3">
            <div className="grid grid-cols-2 gap-2">
              {(allowsSchoolFeatures ? (["student", "staff"] as const) : (["staff"] as const)).map((type) => (
                <button key={type} type="button" onClick={() => changeType(type)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${reportType === type ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {type === "student" ? "Student Reports" : `${personnelLabel} Reports`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {tiles.map((tile) => (
              <Link key={tile.href} to={tile.href} className={`group mb-0 flex min-h-32 flex-col justify-between rounded-2xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tile.tone}`}>
                <div>
                  <h2 className="text-lg font-extrabold leading-6 text-slate-900">{tile.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{tile.subtitle}</p>
                </div>
                <span className={`mt-3 text-sm font-bold ${tile.tone}`}>Open report ›</span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="enterprise-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-800">Attendance preview</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">{previewLabel.replace(" (preview)", "")}</span>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading preview...</p>
          ) : error ? (
            <div className="status-error mt-4">{error}</div>
          ) : (
            <>
              <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <div
                  className="h-36 w-36 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(#10b981 0 ${((totals.present / Math.max(1, totals.present + totals.late + totals.absent)) * 360).toFixed(2)}deg, #f59e0b ${((totals.present / Math.max(1, totals.present + totals.late + totals.absent)) * 360).toFixed(2)}deg ${(((totals.present + totals.late) / Math.max(1, totals.present + totals.late + totals.absent)) * 360).toFixed(2)}deg, #ef4444 ${(((totals.present + totals.late) / Math.max(1, totals.present + totals.late + totals.absent)) * 360).toFixed(2)}deg 360deg)`,
                    mask: "radial-gradient(circle, transparent 56%, #000 57%)",
                    WebkitMask: "radial-gradient(circle, transparent 56%, #000 57%)",
                  }}
                  aria-label={`Attendance distribution: ${totals.present} present, ${totals.late} late, ${totals.absent} absent`}
                />
                <div className="grid w-full grid-cols-3 gap-2 text-center sm:grid-cols-1 sm:text-left">
                  {["Present", "Late", "Absent"].map((label) => {
                    const value = label === "Present" ? totals.present : label === "Late" ? totals.late : totals.absent;
                    const color = label === "Present" ? "bg-emerald-500" : label === "Late" ? "bg-amber-500" : "bg-red-500";
                    return <div key={label} className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="text-xs font-bold text-slate-600">{label}</span><strong className="text-sm text-slate-900">{value}</strong></div>;
                  })}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Present", totals.present, "text-emerald-600"],
                  ["Late", totals.late, "text-amber-600"],
                  ["Attended", totals.attended, "text-sky-600"],
                  ["Absent", totals.absent, "text-red-500"],
                ].map(([label, value, color]) => (
                  <div key={label as string} className={`min-h-20 rounded-xl border border-slate-200 border-l-4 bg-slate-50 p-3 ${color === "text-emerald-600" ? "border-l-emerald-500" : color === "text-amber-600" ? "border-l-amber-500" : color === "text-sky-600" ? "border-l-sky-500" : "border-l-red-500"}`}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-slate-900 p-4 text-white">
                <p className="text-xs text-white/70">Attendance %</p>
                <p className="text-3xl font-extrabold">{totals.pct.toFixed(1)}%</p>
              </div>
            </>
          )}
        </aside>
      </section>
      <AttendanceAuditPanel />
    </div>
  );
}
