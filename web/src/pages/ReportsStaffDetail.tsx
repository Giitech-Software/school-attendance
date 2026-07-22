import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getStaffById } from "../services/staff";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import { exportReportCsv, openReportPdf } from "../services/reportExport";

function fallbackRange() {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    fromIso: start.toISOString().slice(0, 10),
    toIso: new Date().toISOString().slice(0, 10),
  };
}

export default function ReportsStaffDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [range, setRange] = useState<{ fromIso: string; toIso: string; title: string } | null>(null);
  const [summary, setSummary] = useState<StaffAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Missing staff ID.");
      setLoading(false);
      return;
    }

    let active = true;
    const fallback = fallbackRange();

    (async () => {
      try {
        setLoading(true);
        const fromIso = params.get("fromIso") ?? fallback.fromIso;
        const toIso = params.get("toIso") ?? fallback.toIso;
        const title = params.get("title") ?? "Staff report detail";
        const [staff, allRows] = await Promise.all([getStaffById(id), getStaffGlobalSummary(fromIso, toIso)]);
        if (!active) return;

        const row = allRows.find((item) => item.staffId === id) ?? null;
        setStaffName(staff?.name ?? row?.staffName ?? "Staff member");
        setDisplayId(staff?.staffId ?? row?.displayId ?? null);
        setRange({ fromIso, toIso, title });
        setSummary(row);
      } catch (err: any) {
        console.error("load staff detail", err);
        if (active) setError(err?.message ?? "Failed to load staff report.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, params]);

  return (
    <div className="space-y-3">
      <div className="enterprise-panel p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-950">{range?.title ?? "Staff report detail"}</h1>
            <p className="mt-2 text-slate-600">
              {staffName ?? id ?? "Staff member"}
              {displayId ? ` (${displayId})` : ""}
            </p>
            {range && (
              <p className="mt-1 text-sm text-slate-500">
                {range.fromIso} to {range.toIso}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {summary && range ? (
              <>
                <button type="button" onClick={() => openReportPdf({ title: range.title, subtitle: `${staffName ?? "Staff member"}${displayId ? ` (${displayId})` : ""} - ${range.fromIso} to ${range.toIso}`, filename: `${range.title}-${staffName ?? id}`.replace(/\s+/g, "-"), subjectLabel: "Staff", rows: [{ ...summary, staffName: staffName ?? "Staff member", displayId: displayId ?? summary.displayId }] })} className="enterprise-button-secondary">
                  Print / PDF
                </button>
                <button type="button" onClick={() => exportReportCsv({ title: range.title, subtitle: `${staffName ?? "Staff member"}${displayId ? ` (${displayId})` : ""} - ${range.fromIso} to ${range.toIso}`, filename: `${range.title}-${staffName ?? id}`.replace(/\s+/g, "-"), subjectLabel: "Staff", rows: [{ ...summary, staffName: staffName ?? "Staff member", displayId: displayId ?? summary.displayId }] })} className="enterprise-button-secondary">
                  Export CSV
                </button>
              </>
            ) : null}
            <Link to="/reports/staff" className="enterprise-button-secondary">
              Back to staff reports
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 text-slate-500">Loading report...</div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : summary ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Present</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-700">{summary.presentCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Late</div>
              <div className="mt-2 text-2xl font-semibold text-amber-700">{summary.lateCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Absent</div>
              <div className="mt-2 text-2xl font-semibold text-red-600">{summary.absentCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Attended</div>
              <div className="mt-2 text-2xl font-semibold text-blue-700">{summary.attendedSessions}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Attendance %</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.percentagePresent.toFixed(1)}%</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-slate-500">No summary data available for this staff member.</div>
        )}
      </div>
    </div>
  );
}





