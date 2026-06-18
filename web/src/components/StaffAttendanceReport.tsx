import { useEffect, useState } from "react";
import { listStaff, type Staff } from "../services/staff";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import { exportReportCsv, openReportPdf } from "../services/reportExport";

interface StaffAttendanceReportProps {
  title: string;
  description: string;
  initialFrom: string;
  initialTo: string;
  selectedStaffId?: string;
}

export default function StaffAttendanceReport({ title, description, initialFrom, initialTo, selectedStaffId }: StaffAttendanceReportProps) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffId, setStaffId] = useState<string>(selectedStaffId ?? "");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [results, setResults] = useState<StaffAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialFrom, initialTo]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const staffUsers = await listStaff();
        if (!active) return;
        setStaffList(staffUsers);
        if (!selectedStaffId && staffUsers.length > 0) setStaffId(staffUsers[0].id ?? "");
      } catch (err) {
        console.error("load staff list", err);
        setError("Failed to load staff users");
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedStaffId]);

  async function onGenerate() {
    if (!staffId) {
      setError("Please select a staff member.");
      return;
    }

    setError(null);
    setResults(null);
    setLoading(true);

    try {
      const rows = await getStaffGlobalSummary(from, to);
      const summary = rows.find((row) => row.staffId === staffId) ?? null;
      setResults(summary);
    } catch (err: any) {
      console.error("generate staff report", err);
      setError(err?.message ?? "Failed to generate staff report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <h1 className="text-xl font-extrabold">{title}</h1>
          <p className="mt-1 text-xs text-white/70">{description}</p>
        </div>

        <div className="grid gap-3 p-3 lg:grid-cols-[minmax(220px,1fr)_12rem_12rem_auto] lg:items-end">
          <label className="block">
            <span className="auth-label">Staff</span>
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="enterprise-input mt-1.5">
              <option value="">Select a staff member</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name ?? staff.email ?? staff.staffId ?? staff.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="auth-label">From</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="enterprise-input mt-1.5" />
          </label>

          <label className="block">
            <span className="auth-label">To</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="enterprise-input mt-1.5" />
          </label>

          <button type="button" onClick={onGenerate} disabled={loading} className="enterprise-button-primary">
            {loading ? "Generating..." : "Generate report"}
          </button>
        </div>
      </section>

      {error ? <div className="status-error">{error}</div> : null}

      <section className="enterprise-panel p-3">
        {results ? (
          <>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
              <button type="button" onClick={() => openReportPdf({ title, subtitle: `${from} to ${to}`, filename: `${title}-${from}-${to}`.replace(/\s+/g, "-"), subjectLabel: "Staff", rows: [results] })} className="enterprise-button-secondary">
                Print / PDF
              </button>
              <button type="button" onClick={() => exportReportCsv({ title, subtitle: `${from} to ${to}`, filename: `${title}-${from}-${to}`.replace(/\s+/g, "-"), subjectLabel: "Staff", rows: [results] })} className="enterprise-button-secondary">
                Export CSV
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Present</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-700">{results.presentCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Late</div>
                <div className="mt-2 text-2xl font-semibold text-amber-700">{results.lateCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Absent</div>
                <div className="mt-2 text-2xl font-semibold text-red-600">{results.absentCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Attended</div>
                <div className="mt-2 text-2xl font-semibold text-blue-700">{results.attendedSessions}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">% Present</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{results.percentagePresent.toFixed(2)}%</div>
              </div>
            </div>
          </>
        ) : !loading ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Generate a staff report to see summary data.</p>
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading report...</p>
        )}
      </section>
    </div>
  );
}
