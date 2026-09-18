import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentStaff } from "../hooks/useCurrentStaff";
import { getStaffAttendanceInRange } from "../services/staffAttendanceSummary";
import { listTerms } from "../services/terms";
import { listWeeks } from "../services/weeks";
import type { AttendanceRecord, Week } from "../types";
import AttendancePieChart from "../components/AttendancePieChart";
import useCurrentUser from "../hooks/useCurrentUser";
import { allowsStudentAndParentFeatures } from "../services/tenantScope";
import ImageCarousel from "../components/ImageCarousel";

function getLast30Days() {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 29);
  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: today.toISOString().slice(0, 10),
  };
}

function buildStaffSummary(records: AttendanceRecord[]) {
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  records.forEach((record) => {
    const status = record.status ?? (record.checkInTime ? "present" : "absent");
    if (status === "late") lateCount += 1;
    else if (status === "absent") absentCount += 1;
    else presentCount += 1;
  });

  const attendedSessions = presentCount + lateCount;
  const totalDays = attendedSessions + absentCount;
  const score = presentCount + lateCount * 0.5;
  const percentagePresent = totalDays === 0 ? 0 : Number(((score / totalDays) * 100).toFixed(2));

  return { presentCount, lateCount, absentCount, attendedSessions, totalDays, percentagePresent };
}

function formatMaybeTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type ReportMode = "last30" | "week" | "daily" | "monthly" | "term" | "year";
type StaffSummary = ReturnType<typeof buildStaffSummary>;

export default function StaffMyReport() {
  const { staff, loading: staffLoading } = useCurrentStaff();
  const { userDoc } = useCurrentUser();
  const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [termSummary, setTermSummary] = useState<StaffSummary | null>(null);
  const [yearSummary, setYearSummary] = useState<StaffSummary | null>(null);
  const [termLabel, setTermLabel] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [reportMode, setReportMode] = useState<ReportMode>("last30");
  const [emptyMessage, setEmptyMessage] = useState("No attendance records in the last 30 days.");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (staffLoading) return;

    if (!staff?.id) {
      setLoading(false);
      return;
    }

    const staffId = staff.id;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const terms = await listTerms().catch(() => []);
        const nowIso = new Date().toISOString().slice(0, 10);
        const currentTerm =
          terms.find((term) => term.isCurrent) ??
          terms.find((term) => nowIso >= term.startDate && nowIso <= term.endDate) ??
          null;

        if (currentTerm?.id) {
          setTermLabel(`${currentTerm.name}: ${currentTerm.startDate} to ${currentTerm.endDate}`);
          const termWeeks = await listWeeks(currentTerm.id).catch(() => []);
          const sortedWeeks = [...termWeeks].sort((a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0));
          setWeeks(sortedWeeks);
          setSelectedWeek(
            sortedWeeks.find((week) => nowIso >= week.startDate && nowIso <= week.endDate) ?? sortedWeeks[0] ?? null
          );

          const termRecords = await getStaffAttendanceInRange(staffId, currentTerm.startDate, currentTerm.endDate);
          if (active) setTermSummary(buildStaffSummary(termRecords));
        } else {
          setWeeks([]);
          setSelectedWeek(null);
          setTermSummary(null);
          setYearSummary(null);
          setTermLabel(null);
        }

        const year = new Date().getFullYear();
        const yearRecords = await getStaffAttendanceInRange(staffId, `${year}-01-01`, `${year}-12-31`);
        if (active) setYearSummary(buildStaffSummary(yearRecords));

        const range = getLast30Days();
        const rows = await getStaffAttendanceInRange(staffId, range.fromIso, range.toIso);
        if (active) {
          setReportMode("last30");
          setRecords([...rows].sort((a, b) => b.date.localeCompare(a.date)));
          setEmptyMessage("No attendance records in the last 30 days.");
        }
      } catch (err: any) {
        console.error("my staff report", err);
        if (active) setError(err?.message ?? "Could not load your staff report.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [staff?.id, staffLoading]);

  useEffect(() => {
    let active = true;

    if (!staff?.id || reportMode !== "week" || !selectedWeek) return;

    const staffId = staff.id;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = await getStaffAttendanceInRange(staffId, selectedWeek.startDate, selectedWeek.endDate);
        if (active) {
          setRecords([...rows].sort((a, b) => b.date.localeCompare(a.date)));
          setEmptyMessage("No attendance records for selected week.");
        }
      } catch (err: any) {
        console.error("my staff report week", err);
        if (active) setError(err?.message ?? "Could not load the selected week.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reportMode, selectedWeek, staff?.id]);

  const summary = useMemo(() => buildStaffSummary(records), [records]);
  const safeTermSummary = termSummary ?? buildStaffSummary([]);

  async function showLast30Days() {
    if (!staff?.id) return;

    try {
      setReportMode("last30");
      setLoading(true);
      setError(null);
      const range = getLast30Days();
      const rows = await getStaffAttendanceInRange(staff.id, range.fromIso, range.toIso);
      setRecords([...rows].sort((a, b) => b.date.localeCompare(a.date)));
      setEmptyMessage("No attendance records in the last 30 days.");
    } catch (err: any) {
      console.error("my staff report last 30 days", err);
      setError(err?.message ?? "Could not load the last 30 days.");
    } finally {
      setLoading(false);
    }
  }

  async function showRange(mode: "daily" | "monthly" | "term" | "year") {
    if (!staff?.id) return;
    const year = new Date().getFullYear();
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    const fromIso = mode === "daily" ? todayIso : mode === "monthly" ? monthStart : mode === "term" && termLabel ? termLabel.split(": ")[1]?.split(" to ")[0] : `${year}-01-01`;
    const toIso = mode === "daily" ? todayIso : mode === "monthly" ? monthEnd : mode === "term" && termLabel ? termLabel.split(" to ")[1] : `${year}-12-31`;
    if (!fromIso || !toIso) return;
    try {
      setReportMode(mode);
      setLoading(true);
      setError(null);
      const rows = await getStaffAttendanceInRange(staff.id, fromIso, toIso);
      setRecords([...rows].sort((a, b) => b.date.localeCompare(a.date)));
      setEmptyMessage(`No attendance records for the ${mode}.`);
    } catch (err: any) {
      console.error(`my staff report ${mode}`, err);
      setError(err?.message ?? `Could not load the ${mode} report.`);
    } finally {
      setLoading(false);
    }
  }

  if (staffLoading || loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading report...</div>;
  }

  if (!staff) {
    return (
      <div className="mx-auto max-w-lg enterprise-panel p-6 text-center">
        <h1 className="text-xl font-extrabold text-slate-950">Staff profile not linked</h1>
        <p className="mt-2 text-sm text-slate-500">Ask an administrator to link your account to a staff record.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel -mx-3 -mt-3 m-0 overflow-hidden rounded-none p-0 sm:-mx-4 lg:-mx-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/staff/my-attendance" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to my attendance">
                Back
              </Link>
              <h1 className="truncate text-xl font-extrabold">My Report</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Attendance report for {staff.name}.</p>
          </div>
        </div>
      </section>

      <section className="enterprise-panel -mx-3 overflow-hidden rounded-none sm:-mx-4 lg:-mx-5">
        <ImageCarousel images={[{ src: "/reports-1.webp", alt: "Attendance report overview" }, { src: "/reports-2.webp", alt: "Attendance report analysis" }, { src: "/reports-3.webp", alt: "Attendance report summary" }, { src: "/reports-4.webp", alt: "Attendance report insights" }]} />
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="enterprise-panel p-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">{staff.name}</h2>
          <p className="text-sm text-slate-500">
            {reportMode === "week" && selectedWeek
              ? `Week ${selectedWeek.weekNumber}: ${selectedWeek.startDate} to ${selectedWeek.endDate}`
              : reportMode === "daily" ? "Today" : reportMode === "monthly" ? "Current month" : reportMode === "term" ? termLabel ?? "Current term" : reportMode === "year" ? `Year ${new Date().getFullYear()}` : "Last 30 days"}
          </p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Report period</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={showLast30Days}
              className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                reportMode === "last30"
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              Last 30 days
            </button>
            <button type="button" onClick={() => showRange("daily")} className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${reportMode === "daily" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>Daily</button>
            <button type="button" onClick={() => showRange("monthly")} className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${reportMode === "monthly" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>Monthly</button>
            {allowsSchoolFeatures ? <button type="button" onClick={() => showRange("term")} disabled={!termLabel} className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${reportMode === "term" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"}`}>
              Term
            </button> : null}
            <button type="button" onClick={() => showRange("year")} className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${reportMode === "year" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>
              Year
            </button>
            {weeks.map((week) => (
              <button
                key={week.id ?? `${week.startDate}-${week.endDate}`}
                type="button"
                onClick={() => {
                  setSelectedWeek(week);
                  setReportMode("week");
                }}
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                  reportMode === "week" && selectedWeek?.id === week.id
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                Week {week.weekNumber}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 xl:grid-cols-5">
        {[
          ["Present", summary.presentCount, "text-emerald-600"],
          ["Late", summary.lateCount, "text-amber-700"],
          ["Attended", summary.attendedSessions, "text-sky-700"],
          ["Absent", summary.absentCount, "text-red-600"],
          ["Attendance", `${summary.percentagePresent.toFixed(1)}%`, "text-slate-950"],
        ].map(([label, value, tone]) => (
          <div key={label} className="enterprise-panel min-w-0 p-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      <AttendancePieChart present={summary.presentCount} late={summary.lateCount} absent={summary.absentCount} title={`${reportMode === "term" ? "Term" : reportMode === "year" ? "Year" : "Current period"} attendance distribution`} />

      {allowsSchoolFeatures ? <section className="enterprise-panel p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Term Attendance</h2>
            <p className="text-sm text-slate-500">{termLabel ?? "No current term has been set."}</p>
          </div>
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-700">
            {safeTermSummary.percentagePresent.toFixed(1)}%
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 xl:grid-cols-5">
          {[
            ["Present", safeTermSummary.presentCount, "text-emerald-600"],
            ["Late", safeTermSummary.lateCount, "text-amber-700"],
            ["Attended", safeTermSummary.attendedSessions, "text-sky-700"],
            ["Absent", safeTermSummary.absentCount, "text-red-600"],
            ["Attendance", `${safeTermSummary.percentagePresent.toFixed(1)}%`, "text-slate-950"],
          ].map(([label, value, tone]) => (
            <div key={label} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`mt-1 text-xl font-extrabold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
      </section> : null}

      <section className="enterprise-panel p-3 sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Year Attendance</h2>
            <p className="text-sm text-slate-500">Calendar year {new Date().getFullYear()}</p>
          </div>
          <div className="rounded-md bg-sky-50 px-3 py-2 text-sm font-extrabold text-sky-700">{(yearSummary ?? buildStaffSummary([])).percentagePresent.toFixed(1)}%</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 xl:grid-cols-5">
          {[["Present", (yearSummary ?? buildStaffSummary([])).presentCount, "text-emerald-600"], ["Late", (yearSummary ?? buildStaffSummary([])).lateCount, "text-amber-700"], ["Attended", (yearSummary ?? buildStaffSummary([])).attendedSessions, "text-sky-700"], ["Absent", (yearSummary ?? buildStaffSummary([])).absentCount, "text-red-600"], ["Attendance", `${(yearSummary ?? buildStaffSummary([])).percentagePresent.toFixed(1)}%`, "text-slate-950"]].map(([label, value, tone]) => <div key={label} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-xl font-extrabold ${tone}`}>{value}</p></div>)}
        </div>
      </section>

      <section className="enterprise-panel p-3">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Timeline</h2>
            <p className="text-sm text-slate-500">Staff ID: {staff.staffId ?? staff.id}</p>
          </div>
        </div>
        <div className="grid gap-2">
          {records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">{emptyMessage}</div>
          ) : (
            records.map((record) => (
              <div key={record.id ?? record.date} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-bold text-slate-950">{new Date(record.date).toLocaleDateString()}</p>
                    <p className="text-sm text-slate-500">In: {formatMaybeTime(record.checkInTime)} | Out: {formatMaybeTime(record.checkOutTime)}</p>
                    {record.lateReason ? <p className="text-xs font-semibold text-amber-700">Movement book — late arrival: {record.lateReason}</p> : null}
                    {record.earlyCheckoutReason ? <p className="text-xs font-semibold text-blue-700">Early out: {record.earlyCheckoutReason}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`rounded px-2 py-1 text-xs font-bold ${record.status === "late" ? "bg-amber-100 text-amber-700" : record.status === "absent" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {record.status ?? (record.checkInTime ? "present" : "absent")}
                    </span>
                    <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-500">{record.method ?? "manual"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
