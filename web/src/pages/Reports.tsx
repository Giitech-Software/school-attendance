import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAttendanceSummary, type AttendanceSummary } from "../services/attendanceSummary";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import useCurrentUser from "../hooks/useCurrentUser";
import { allowsStudentAndParentFeatures } from "../services/tenantScope";

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
  { title: "Daily Attendance", subtitle: "Preview by day - Last 5 school days", href: "/reports/daily", tone: "border-l-purple-500" },
  { title: "Weekly Reports", subtitle: "Attendance grouped by school week", href: "/reports/weekly", tone: "border-l-indigo-500" },
  { title: "Monthly Reports", subtitle: "Attendance grouped by calendar month", href: "/reports/monthly", tone: "border-l-teal-500" },
  { title: "Termly Reports", subtitle: "Summaries by term", href: "/reports/termly", tone: "border-l-rose-500" },
  { title: "Yearly Reports", subtitle: "Full-year attendance summaries", href: "/reports/yearly", tone: "border-l-orange-500" },
];

const staffLinks = [
  { title: "Daily Attendance", subtitle: "Preview by day - staff", href: "/reports/staff-daily", tone: "border-l-purple-500" },
  { title: "Weekly Reports", subtitle: "Staff attendance grouped by week", href: "/reports/staff-weekly", tone: "border-l-indigo-500" },
  { title: "Monthly Reports", subtitle: "Staff attendance grouped by month", href: "/reports/staff-monthly", tone: "border-l-teal-500" },
  { title: "Termly Reports", subtitle: "Staff summaries by term", href: "/reports/staff-termly", tone: "border-l-rose-500", schoolOnly: true },
  { title: "Yearly Reports", subtitle: "Full-year staff summaries", href: "/reports/staff-yearly", tone: "border-l-orange-500" },
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
      <section className="enterprise-panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
          <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white lg:border-b-0">
            <h1 className="text-xl font-extrabold">Reports</h1>
            <p className="mt-1 text-xs text-white/70">Quick previews - tap a tile to open detailed reports.</p>
          </div>
          <img
            src="/attendance-report.jpg"
            alt="Student and staff attendance reports"
            className="h-[180px] w-full object-fill sm:h-[220px] lg:h-[240px]"
          />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_21rem]">
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

          <div className="grid gap-3 md:grid-cols-2">
            {tiles.map((tile) => (
              <Link key={tile.href} to={tile.href} className={`rounded-lg border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tile.tone}`}>
                <h2 className="text-base font-extrabold text-slate-950">{tile.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{tile.subtitle}</p>
              </Link>
            ))}
          </div>
        </div>

        <aside className="enterprise-panel p-4">
          <h2 className="text-sm font-bold text-slate-700">{previewLabel}</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading preview...</p>
          ) : error ? (
            <div className="status-error mt-4">{error}</div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Present", totals.present, "text-emerald-600"],
                  ["Late", totals.late, "text-amber-600"],
                  ["Attended", totals.attended, "text-sky-600"],
                  ["Absent", totals.absent, "text-red-500"],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="rounded-lg bg-slate-50 p-3">
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
    </div>
  );
}
