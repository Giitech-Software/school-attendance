import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import { exportReportCsv, openReportPdf } from "../services/reportExport";
import AttendanceTotalsCards from "./AttendanceTotalsCards";
import { autoMarkAbsentStaff } from "../services/autoMarkAbsent";

interface StaffAttendanceReportProps {
  title: string;
  description: string;
  initialFrom: string;
  initialTo: string;
}

function rangeLabel(from: string, to: string) {
  return from === to ? from : `${from} to ${to}`;
}

export default function StaffAttendanceReport({ title, description, initialFrom, initialTo }: StaffAttendanceReportProps) {
  const navigate = useNavigate();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [results, setResults] = useState<StaffAttendanceSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialFrom, initialTo]);

  async function onGenerate() {
    if (!from || !to) {
      setError("Select a valid date range before generating a report.");
      return;
    }

    setError(null);
    setResults(null);
    setLoading(true);

    try {
      if (from === to) {
        await autoMarkAbsentStaff({ dateIso: to });
      }
      const rows = await getStaffGlobalSummary(from, to);
      setResults(rows);
    } catch (err: any) {
      console.error("generate staff report", err);
      setError(err?.message ?? "Failed to generate staff report");
    } finally {
      setLoading(false);
    }
  }

  const exportSubtitle = rangeLabel(from, to);
  const exportFilename = `${title}-${from}-${to}`.replace(/\s+/g, "-");

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <h1 className="text-xl font-extrabold">{title}</h1>
          <p className="mt-1 text-xs text-white/70">{description}</p>
        </div>

        <div className="grid gap-3 p-3 lg:grid-cols-[12rem_12rem_auto] lg:items-end">
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-extrabold text-slate-950">Staff ({results?.length ?? 0})</h2>
          <div className="text-sm text-slate-600">P = Present, L = Late, T = Attended, A = Absent</div>
        </div>

        {results && results.length > 0 ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => openReportPdf({ title, subtitle: exportSubtitle, filename: exportFilename, subjectLabel: "Staff", rows: results })} className="enterprise-button-secondary">
                Print / PDF
              </button>
              <button type="button" onClick={() => exportReportCsv({ title, subtitle: exportSubtitle, filename: exportFilename, subjectLabel: "Staff", rows: results })} className="enterprise-button-secondary">
                Export CSV
              </button>
            </div>
            <AttendanceTotalsCards rows={results} subjectLabel="Staff" groupLabel="All staff" />

            <div className="mt-3 grid gap-3 md:hidden">
              {results.map((row) => (
                <div key={row.staffId} className="report-mobile-row">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-950">{row.staffName || "Staff"}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{row.displayId || row.staffId}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/reports/staff/${row.staffId}?fromIso=${from}&toIso=${to}&title=${encodeURIComponent(title)}`)}
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Open
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                    <span className="report-stat-pill bg-emerald-50 text-emerald-700">P {row.presentCount}</span>
                    <span className="report-stat-pill bg-amber-50 text-amber-700">L {row.lateCount}</span>
                    <span className="report-stat-pill bg-sky-50 text-sky-700">T {row.attendedSessions}</span>
                    <span className="report-stat-pill bg-red-50 text-red-600">A {row.absentCount}</span>
                    <span className="report-stat-pill bg-slate-100 text-slate-700">{row.percentagePresent.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Staff ID</th>
                    <th>P</th>
                    <th>L</th>
                    <th>T</th>
                    <th>A</th>
                    <th>Attendance %</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.staffId}>
                      <td className="font-semibold text-slate-900">{row.staffName || "Staff"}</td>
                      <td className="text-slate-600">{row.displayId || row.staffId}</td>
                      <td className="font-semibold text-emerald-700">{row.presentCount}</td>
                      <td className="font-semibold text-amber-700">{row.lateCount}</td>
                      <td className="font-semibold text-blue-700">{row.attendedSessions}</td>
                      <td className="font-semibold text-red-600">{row.absentCount}</td>
                      <td className="font-semibold text-slate-700">{row.percentagePresent.toFixed(1)}%</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/reports/staff/${row.staffId}?fromIso=${from}&toIso=${to}&title=${encodeURIComponent(title)}`)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        {results && results.length === 0 ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No staff attendance records were found for the selected date range.</p> : null}
        {!results && !loading ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Generate a staff report to see all staff attendance counts.</p> : null}
        {loading ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading report...</p> : null}
      </section>
    </div>
  );
}
