import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClasses, type SchoolClass } from "../services/classes";
import { getAttendanceSummary, type AttendanceSummary } from "../services/attendanceSummary";
import { listTerms, type Term } from "../services/terms";
import { exportReportCsv, openReportPdf } from "../services/reportExport";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function classKey(cls: SchoolClass) {
  return cls.classId ?? cls.id ?? "";
}

function currentTermFrom(terms: Term[]) {
  const today = new Date().toISOString().slice(0, 10);
  return terms.find((term) => term.isCurrent) ?? terms.find((term) => today >= term.startDate && today <= term.endDate) ?? null;
}

function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
    label: `${MONTHS[month]} ${year}`,
  };
}

function intersectRange(month: ReturnType<typeof monthRange>, term: Term | null) {
  if (!term) return null;
  const fromIso = month.fromIso > term.startDate ? month.fromIso : term.startDate;
  const toIso = month.toIso < term.endDate ? month.toIso : term.endDate;
  if (fromIso > toIso) return null;
  return { ...month, fromIso, toIso };
}

export default function ReportsMonthly() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [rows, setRows] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedRange = useMemo(() => {
    if (selectedMonth === null) return null;
    return intersectRange(monthRange(year, selectedMonth), currentTerm);
  }, [currentTerm, selectedMonth, year]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [termList, classList] = await Promise.all([listTerms().catch(() => []), listClasses().catch(() => [])]);
        if (!active) return;
        const term = currentTermFrom(termList);
        setCurrentTerm(term);
        setClasses(classList);
        setError(term ? null : "No active term found. Mark a term as current to view monthly reports.");
      } catch (err) {
        console.error("load monthly setup", err);
        if (active) setError("Failed to load terms or classes.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!selectedRange) {
        setRows([]);
        return;
      }

      try {
        setLoading(true);
        const data = await getAttendanceSummary({
          fromIso: selectedRange.fromIso,
          toIso: selectedRange.toIso,
          classId: selectedClassKey || undefined,
          includeStudentName: true,
        });
        if (active) setRows(data);
      } catch (err) {
        console.error("load monthly report", err);
        if (active) {
          setRows([]);
          setError("Failed to load monthly report.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedRange, selectedClassKey]);

  return (
    <div className="report-page">
      <div className="report-hero">
        <div className="report-hero-bar">
          <div>
            <h1 className="report-title">Monthly Reports</h1>
            <p className="report-subtitle">Select a month inside the current term, then filter by class.</p>
          </div>
          <button onClick={() => navigate("/reports")} className="enterprise-button-secondary border-white/20 bg-white/10 text-white shadow-none hover:bg-white/15">
            Back
          </button>
        </div>

        <div className="report-toolbar">
          {error && <div className="status-error">{error}</div>}

        <div className="mt-4 min-w-0">
          <div className="report-control-label">Select month</div>
          <div className="report-chip-rail">
            <div className="report-chip-row">
            {MONTHS.map((month, index) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(index)}
                className={`report-choice-card ${selectedMonth === index ? "report-choice-card-active" : ""}`}
              >
                <div className="font-semibold">{month}</div>
              </button>
            ))}
            </div>
          </div>
          {selectedMonth !== null && !selectedRange && (
            <div className="mt-2 text-sm text-slate-500">This month is outside the active term date range.</div>
          )}
          {selectedRange && (
            <div className="mt-2 text-sm text-slate-500">
              Reporting range: {selectedRange.fromIso} to {selectedRange.toIso}
            </div>
          )}
        </div>

        <div className="mt-4 min-w-0">
          <div className="report-control-label">Filter by class</div>
          <div className="report-chip-rail">
            <div className="report-chip-row">
            <button
              onClick={() => setSelectedClassKey("")}
              className={`report-filter-chip ${!selectedClassKey ? "report-filter-chip-active" : ""}`}
            >
              All classes
            </button>
            {classes.map((cls) => {
              const key = classKey(cls);
              return (
                <button
                  key={cls.id ?? key}
                  onClick={() => setSelectedClassKey(key)}
                  className={`report-filter-chip ${selectedClassKey === key ? "report-filter-chip-active" : ""}`}
                >
                  {cls.name}
                </button>
              );
            })}
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="report-results">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-extrabold text-slate-950">Students ({rows.length})</h2>
          <div className="text-sm text-slate-600">P = Present, L = Late, T = Attended, A = Absent</div>
        </div>

        {rows.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => openReportPdf({ title: "Monthly Reports", subtitle: selectedRange ? `${selectedRange.fromIso} to ${selectedRange.toIso}` : "", filename: (selectedRange ? `Monthly-Report-${selectedRange.label}` : "monthly-report").replace(/\s+/g, "-"), subjectLabel: "Student", rows })} className="enterprise-button-secondary">Print / PDF</button>
            <button type="button" onClick={() => exportReportCsv({ title: "Monthly Reports", subtitle: selectedRange ? `${selectedRange.fromIso} to ${selectedRange.toIso}` : "", filename: (selectedRange ? `Monthly-Report-${selectedRange.label}` : "monthly-report").replace(/\s+/g, "-"), subjectLabel: "Student", rows })} className="enterprise-button-secondary">Export CSV</button>
          </div>
        ) : null}

        {loading && <div className="report-empty">Loading report...</div>}
        {!loading && !selectedRange && <div className="report-empty">Select a month in the current term to view report data.</div>}
        {!loading && selectedRange && rows.length === 0 && <div className="report-empty">No data for selected month or class.</div>}

        {rows.length > 0 && selectedRange && (
          <div className="mt-3 overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-2 py-1">Student</th>
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
                  <tr key={row.studentId} className="border-b even:bg-slate-50">
                    <td className="px-2 py-0.5 align-middle leading-tight">
                      <div className="font-semibold text-slate-900">{row.studentName || "Student"}</div>
                      <div className="text-xs text-slate-500">{row.displayId || row.studentId}</div>
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
                            `/reports/student/${row.studentId}?fromIso=${selectedRange.fromIso}&toIso=${selectedRange.toIso}&title=${selectedRange.label} Report`
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












