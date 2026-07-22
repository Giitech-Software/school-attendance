import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import { exportReportCsv, openReportPdf } from "../services/reportExport";
import AttendanceTotalsCards from "../components/AttendanceTotalsCards";

function yearRange(year: number) {
  return {
    fromIso: `${year}-01-01`,
    toIso: `${year}-12-31`,
    label: String(year),
  };
}

function yearOptions() {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2, current - 3, current - 4];
}

export default function ReportsStaffYearly() {
  const navigate = useNavigate();
  const years = useMemo(() => yearOptions(), []);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<StaffAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRange = yearRange(selectedYear);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getStaffGlobalSummary(selectedRange.fromIso, selectedRange.toIso);
        if (active) setRows(data);
      } catch (err) {
        console.error("load staff yearly report", err);
        if (active) {
          setRows([]);
          setError("Failed to load yearly staff report.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedRange.fromIso, selectedRange.toIso]);

  return (
    <div className="space-y-3">
      <div className="enterprise-panel p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-950">Yearly Staff Reports</h1>
            <p className="mt-1 text-sm text-slate-600">Select a year and review staff attendance summaries.</p>
          </div>
          <button onClick={() => navigate("/reports")} className="enterprise-button-secondary">
            Back
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-slate-600">Select year</div>
          <div className="report-chip-rail">
            <div className="report-chip-row">
              {years.map((year) => (
                <button key={year} onClick={() => setSelectedYear(year)} className={`report-choice-card ${selectedYear === year ? "report-choice-card-active" : ""}`}>
                  <div className="font-semibold">{year}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="enterprise-panel p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-extrabold text-slate-950">Staff ({rows.length})</h2>
          <div className="text-sm text-slate-600">P = Present, L = Late, T = Attended, A = Absent</div>
        </div>

        {rows.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => openReportPdf({ title: "Yearly Staff Reports", subtitle: `${selectedRange.fromIso} to ${selectedRange.toIso}`, filename: `Yearly-Staff-Report-${selectedRange.label}`, subjectLabel: "Staff", rows })} className="enterprise-button-secondary">Print / PDF</button>
            <button type="button" onClick={() => exportReportCsv({ title: "Yearly Staff Reports", subtitle: `${selectedRange.fromIso} to ${selectedRange.toIso}`, filename: `Yearly-Staff-Report-${selectedRange.label}`, subjectLabel: "Staff", rows })} className="enterprise-button-secondary">Export CSV</button>
          </div>
        ) : null}

        {rows.length > 0 ? <AttendanceTotalsCards rows={rows} subjectLabel="Staff" groupLabel="All staff" /> : null}
        {loading && <div className="mt-4 text-slate-500">Loading report...</div>}
        {!loading && rows.length === 0 && <div className="mt-4 text-slate-500">No data for selected year.</div>}

        {rows.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] table-auto border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-2 py-1">Staff</th>
                  <th className="px-2 py-1">P</th>
                  <th className="px-2 py-1">L</th>
                  <th className="px-2 py-1">T</th>
                  <th className="px-2 py-1">A</th>
                  <th className="px-2 py-1">Attendance %</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.staffId} className="border-b even:bg-slate-50">
                    <td className="px-2 py-0.5 align-middle leading-tight">
                      <div className="font-semibold text-slate-900">{row.staffName || "Staff"}</div>
                      <div className="text-xs text-slate-500">{row.displayId || row.staffId}</div>
                    </td>
                    <td className="px-2 py-0.5 align-middle leading-tight text-emerald-700">{row.presentCount}</td>
                    <td className="px-2 py-0.5 align-middle leading-tight text-amber-700">{row.lateCount}</td>
                    <td className="px-2 py-0.5 align-middle leading-tight text-blue-700">{row.attendedSessions}</td>
                    <td className="px-2 py-0.5 align-middle leading-tight text-red-600">{row.absentCount}</td>
                    <td className="px-2 py-0.5 align-middle leading-tight text-slate-700">{row.percentagePresent.toFixed(1)}%</td>
                    <td className="px-2 py-0.5 align-middle leading-tight text-right">
                      <button onClick={() => navigate(`/reports/staff/${row.staffId}?fromIso=${selectedRange.fromIso}&toIso=${selectedRange.toIso}&title=${selectedRange.label} Report`)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
