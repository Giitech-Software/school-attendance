import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStaffGlobalSummary, type StaffAttendanceSummary } from "../services/staffAttendanceSummary";
import { listTerms, type Term } from "../services/terms";
import { listWeeks } from "../services/weeks";
import type { Week } from "../types";
import { exportReportCsv, openReportPdf } from "../services/reportExport";

function currentTermFrom(terms: Term[]) {
  const today = new Date().toISOString().slice(0, 10);
  return terms.find((term) => term.isCurrent) ?? terms.find((term) => today >= term.startDate && today <= term.endDate) ?? null;
}

export default function ReportsStaffWeekly() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [rows, setRows] = useState<StaffAttendanceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const terms = await listTerms().catch(() => []);
        if (!active) return;

        const currentTerm = currentTermFrom(terms);
        if (!currentTerm?.id) {
          setWeeks([]);
          setSelectedWeek(null);
          setError("No active term found. Mark a term as current to view weekly staff reports.");
          return;
        }

        const generatedWeeks = await listWeeks(currentTerm.id).catch(() => []);
        if (!active) return;

        const today = new Date().toISOString().slice(0, 10);
        const selected = generatedWeeks.find((week) => today >= week.startDate && today <= week.endDate) ?? null;
        setWeeks(generatedWeeks);
        setSelectedWeek(selected);
        setError(null);
      } catch (err) {
        console.error("load weekly staff setup", err);
        if (active) setError("Failed to load weeks.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const sortedWeeks = useMemo(() => [...weeks].sort((a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)), [weeks]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!selectedWeek) {
        setRows([]);
        return;
      }

      try {
        setLoading(true);
        const data = await getStaffGlobalSummary(selectedWeek.startDate, selectedWeek.endDate);
        if (active) setRows(data);
      } catch (err) {
        console.error("load weekly staff report", err);
        if (active) {
          setRows([]);
          setError("Failed to load weekly staff report.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedWeek]);

  return (
    <div className="space-y-3">
      <div className="enterprise-panel p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-950">Weekly Staff Reports</h1>
            <p className="mt-1 text-sm text-slate-600">Select a generated term week and review staff attendance summaries.</p>
          </div>
          <button onClick={() => navigate("/reports")} className="enterprise-button-secondary">
            Back
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-slate-600">Select week</div>
          <div className="report-chip-rail">
            <div className="report-chip-row">
            {sortedWeeks.map((week) => (
              <button
                key={week.id}
                onClick={() => setSelectedWeek(week)}
                className={`report-choice-card min-w-40 ${selectedWeek?.id === week.id ? "report-choice-card-active" : ""}`}
              >
                <div className="font-semibold">Week {week.weekNumber}</div>
                <div className={`mt-1 text-xs ${selectedWeek?.id === week.id ? "text-white/80" : "text-slate-500"}`}>
                  {week.startDate} to {week.endDate}
                </div>
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
            <button type="button" onClick={() => openReportPdf({ title: "Weekly Staff Reports", subtitle: selectedWeek ? `${selectedWeek.startDate} to ${selectedWeek.endDate}` : "", filename: (selectedWeek ? `Weekly-Staff-Report-Week-${selectedWeek.weekNumber}` : "weekly-staff-report").replace(/\s+/g, "-"), subjectLabel: "Staff", rows })} className="enterprise-button-secondary">Print / PDF</button>
            <button type="button" onClick={() => exportReportCsv({ title: "Weekly Staff Reports", subtitle: selectedWeek ? `${selectedWeek.startDate} to ${selectedWeek.endDate}` : "", filename: (selectedWeek ? `Weekly-Staff-Report-Week-${selectedWeek.weekNumber}` : "weekly-staff-report").replace(/\s+/g, "-"), subjectLabel: "Staff", rows })} className="enterprise-button-secondary">Export CSV</button>
          </div>
        ) : null}

        {loading && <div className="mt-4 text-slate-500">Loading report...</div>}
        {!loading && !selectedWeek && <div className="mt-4 text-slate-500">Select a week to view report data.</div>}
        {!loading && selectedWeek && rows.length === 0 && <div className="mt-4 text-slate-500">No data for selected week.</div>}

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
                  <th className="px-2 py-1">% Present</th>
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
                            `/reports/staff/${row.staffId}?fromIso=${selectedWeek?.startDate}&toIso=${selectedWeek?.endDate}&title=Week ${selectedWeek?.weekNumber} Report`
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







