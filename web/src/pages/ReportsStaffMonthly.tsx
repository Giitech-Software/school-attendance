import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import { exportReportCsv, openReportPdf } from "../services/reportExport";
import AttendanceTotalsCards from "../components/AttendanceTotalsCards";

function monthsForYear(year: number) {
  return Array.from({ length: 12 }, (_, month) => {
    const date = new Date(year, month, 1);
    return {
      year,
      month,
      label: date.toLocaleString("default", { month: "short", year: "numeric" }),
      fromIso: new Date(year, month, 1).toISOString().slice(0, 10),
      toIso: new Date(year, month + 1, 0).toISOString().slice(0, 10),
    };
  });
}

export default function ReportsStaffMonthly() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const months = useMemo(() => monthsForYear(year), [year]);
  const [selectedMonth, setSelectedMonth] = useState<(typeof months)[number] | null>(null);
  const [rows, setRows] = useState<StaffAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!selectedMonth) {
        setRows([]);
        return;
      }

      try {
        setLoading(true);
        const data = await getStaffGlobalSummary(selectedMonth.fromIso, selectedMonth.toIso);
        if (active) setRows(data);
      } catch (err) {
        console.error("load staff monthly report", err);
        if (active) {
          setRows([]);
          setError("Failed to load monthly staff report.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedMonth]);

  return (
    <div className="space-y-3">
      <div className="enterprise-panel p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-950">Monthly Staff Reports</h1>
            <p className="mt-1 text-sm text-slate-600">Select a month and review staff attendance summaries.</p>
          </div>
          <button onClick={() => navigate("/reports")} className="enterprise-button-secondary">
            Back
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-slate-600">Select month</div>
          <div className="report-chip-rail">
            <div className="report-chip-row">
            {months.map((month) => (
              <button
                key={`${month.year}-${month.month}`}
                onClick={() => setSelectedMonth(month)}
                className={`report-choice-card ${selectedMonth?.month === month.month ? "report-choice-card-active" : ""}`}
              >
                <div className="font-semibold">{month.label}</div>
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
            <button type="button" onClick={() => openReportPdf({ title: "Monthly Staff Reports", subtitle: selectedMonth ? `${selectedMonth.fromIso} to ${selectedMonth.toIso}` : "", filename: (selectedMonth ? `Monthly-Staff-Report-${selectedMonth.label}` : "monthly-staff-report").replace(/\s+/g, "-"), subjectLabel: "Staff", rows })} className="enterprise-button-secondary">Print / PDF</button>
            <button type="button" onClick={() => exportReportCsv({ title: "Monthly Staff Reports", subtitle: selectedMonth ? `${selectedMonth.fromIso} to ${selectedMonth.toIso}` : "", filename: (selectedMonth ? `Monthly-Staff-Report-${selectedMonth.label}` : "monthly-staff-report").replace(/\s+/g, "-"), subjectLabel: "Staff", rows })} className="enterprise-button-secondary">Export CSV</button>
          </div>
        ) : null}

        {rows.length > 0 ? <AttendanceTotalsCards rows={rows} subjectLabel="Staff" groupLabel="All staff" /> : null}
        {loading && <div className="mt-4 text-slate-500">Loading report...</div>}
        {!loading && !selectedMonth && <div className="mt-4 text-slate-500">Select a month to view report data.</div>}
        {!loading && selectedMonth && rows.length === 0 && <div className="mt-4 text-slate-500">No data for selected month.</div>}

        {rows.length > 0 && selectedMonth && (
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
                      <button
                        onClick={() =>
                          navigate(
                            `/reports/staff/${row.staffId}?fromIso=${selectedMonth.fromIso}&toIso=${selectedMonth.toIso}&title=Monthly Report - ${selectedMonth.label}`
                          )
                        }
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
        )}
      </div>
    </div>
  );
}
