import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClasses, type SchoolClass } from "../services/classes";
import { getAttendanceSummary, type AttendanceSummary } from "../services/attendanceSummary";
import { listTerms, type Term } from "../services/terms";
import { listWeeks } from "../services/weeks";
import type { Week } from "../types";
import { exportReportCsv, openReportPdf } from "../services/reportExport";
import AttendanceTotalsCards from "../components/AttendanceTotalsCards";

function classKey(cls: SchoolClass) {
  return cls.classId ?? cls.id ?? "";
}

function currentTermFrom(terms: Term[]) {
  const today = new Date().toISOString().slice(0, 10);
  return terms.find((term) => term.isCurrent) ?? terms.find((term) => today >= term.startDate && today <= term.endDate) ?? null;
}

export default function ReportsWeekly() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState<string>("");
  const [rows, setRows] = useState<AttendanceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [terms, classList] = await Promise.all([listTerms().catch(() => []), listClasses().catch(() => [])]);
        if (!active) return;

        const currentTerm = currentTermFrom(terms);
        setClasses(classList);

        if (!currentTerm?.id) {
          setWeeks([]);
          setSelectedWeek(null);
          setError("No active term found. Mark a term as current to view weekly reports.");
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
        console.error("load weekly report setup", err);
        if (active) setError("Failed to load weeks or classes.");
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
        const data = await getAttendanceSummary({
          fromIso: selectedWeek.startDate,
          toIso: selectedWeek.endDate,
          classId: selectedClassKey || undefined,
          includeStudentName: true,
        });
        if (active) setRows(data);
      } catch (err) {
        console.error("load weekly report", err);
        if (active) {
          setRows([]);
          setError("Failed to load weekly report.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedWeek, selectedClassKey]);

  return (
    <div className="report-page">
      <section className="report-hero">
        <div className="report-hero-bar">
          <div>
            <h1 className="report-title">Weekly Reports</h1>
            <p className="report-subtitle">Select a generated term week, filter by class, and open student detail reports.</p>
          </div>
          <button onClick={() => navigate("/reports")} className="enterprise-button-secondary border-white/20 bg-white/10 text-white shadow-none hover:bg-white/15">
            Back
          </button>
        </div>

        <div className="report-toolbar">
          {error && <div className="status-error">{error}</div>}

          <div className="min-w-0">
            <div className="report-control-label">Select week</div>
            <div className="report-chip-rail">
              <div className="report-chip-row">
                {sortedWeeks.map((week) => (
                <button key={week.id} onClick={() => setSelectedWeek(week)} className={`report-choice-card min-w-40 ${selectedWeek?.id === week.id ? "report-choice-card-active" : ""}`}>
                  <div className="font-bold">Week {week.weekNumber}</div>
                  <div className={`mt-1 text-xs ${selectedWeek?.id === week.id ? "text-white/80" : "text-slate-500"}`}>
                    {week.startDate} to {week.endDate}
                  </div>
                </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="report-control-label">Filter by class</div>
            <div className="report-chip-rail">
              <div className="report-chip-row">
                <button onClick={() => setSelectedClassKey("")} className={`report-filter-chip ${!selectedClassKey ? "report-filter-chip-active" : ""}`}>
                All classes
              </button>
                {classes.map((cls) => {
                const key = classKey(cls);
                return (
                  <button key={cls.id ?? key} onClick={() => setSelectedClassKey(key)} className={`report-filter-chip ${selectedClassKey === key ? "report-filter-chip-active" : ""}`}>
                    {cls.name}
                  </button>
                );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="report-results">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Students ({rows.length})</h2>
            <p className="mt-1 text-sm text-slate-600">P = Present, L = Late, T = Attended, A = Absent</p>
          </div>

          {rows.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openReportPdf({ title: "Weekly Reports", subtitle: selectedWeek ? `${selectedWeek.startDate} to ${selectedWeek.endDate}` : "", filename: (selectedWeek ? `Weekly-Report-Week-${selectedWeek.weekNumber}` : "weekly-report").replace(/\s+/g, "-"), subjectLabel: "Student", rows })} className="enterprise-button-secondary">Print / PDF</button>
              <button type="button" onClick={() => exportReportCsv({ title: "Weekly Reports", subtitle: selectedWeek ? `${selectedWeek.startDate} to ${selectedWeek.endDate}` : "", filename: (selectedWeek ? `Weekly-Report-Week-${selectedWeek.weekNumber}` : "weekly-report").replace(/\s+/g, "-"), subjectLabel: "Student", rows })} className="enterprise-button-secondary">Export CSV</button>
            </div>
          ) : null}
        </div>

        {rows.length > 0 ? <AttendanceTotalsCards rows={rows} subjectLabel="Students" groupLabel={selectedClassKey ? "Selected class" : "All classes"} /> : null}
        {loading && <div className="report-empty">Loading report...</div>}
        {!loading && !selectedWeek && <div className="report-empty">Select a week to view report data.</div>}
        {!loading && selectedWeek && rows.length === 0 && <div className="report-empty">No data for selected week or class.</div>}

        {rows.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>P</th>
                  <th>L</th>
                  <th>T</th>
                  <th>A</th>
                  <th>Attendance %</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId}>
                    <td>
                      <div className="font-semibold text-slate-900">{row.studentName || "Student"}</div>
                      <div className="text-xs text-slate-500">{row.displayId || row.studentId}</div>
                    </td>
                    <td className="font-semibold text-emerald-700">{row.presentCount}</td>
                    <td className="font-semibold text-amber-700">{row.lateCount}</td>
                    <td className="font-semibold text-blue-700">{row.attendedSessions}</td>
                    <td className="font-semibold text-red-600">{row.absentCount}</td>
                    <td className="font-semibold text-slate-700">{row.percentagePresent.toFixed(1)}%</td>
                    <td className="text-right">
                      <button onClick={() => navigate(`/reports/student/${row.studentId}?fromIso=${selectedWeek?.startDate}&toIso=${selectedWeek?.endDate}&title=Week ${selectedWeek?.weekNumber} Report`)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Open
                      </button>
                    </td>
                  </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
