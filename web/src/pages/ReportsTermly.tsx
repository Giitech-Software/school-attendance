import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClasses, type SchoolClass } from "../services/classes";
import { getAttendanceSummary, type AttendanceSummary } from "../services/attendanceSummary";
import { listTerms, type Term } from "../services/terms";
import { exportReportCsv, openReportPdf } from "../services/reportExport";
import AttendanceTotalsCards from "../components/AttendanceTotalsCards";

function classKey(cls: SchoolClass) {
  return cls.classId ?? cls.id ?? "";
}

function currentTermFrom(terms: Term[]) {
  const today = new Date().toISOString().slice(0, 10);
  return terms.find((term) => term.isCurrent) ?? terms.find((term) => today >= term.startDate && today <= term.endDate) ?? terms[0] ?? null;
}

export default function ReportsTermly() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState<string>("");
  const [rows, setRows] = useState<AttendanceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [termList, classList] = await Promise.all([listTerms().catch(() => []), listClasses().catch(() => [])]);
        if (!active) return;
        setTerms(termList);
        setClasses(classList);
        setSelectedTerm(currentTermFrom(termList));
        setError(termList.length ? null : "No terms found. Create a term before viewing termly reports.");
      } catch (err) {
        console.error("load termly setup", err);
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
      if (!selectedTerm) {
        setRows([]);
        return;
      }

      try {
        setLoading(true);
        const data = await getAttendanceSummary({
          fromIso: selectedTerm.startDate,
          toIso: selectedTerm.endDate,
          classId: selectedClassKey || undefined,
          includeStudentName: true,
        });
        if (active) setRows(data);
      } catch (err) {
        console.error("load termly report", err);
        if (active) {
          setRows([]);
          setError("Failed to load termly report.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedTerm, selectedClassKey]);

  return (
    <div className="report-page">
      <div className="report-hero">
        <div className="report-hero-bar">
          <div>
            <h1 className="report-title">Termly Reports</h1>
            <p className="report-subtitle">Select a term, filter by class, and review each student summary.</p>
          </div>
          <button onClick={() => navigate("/reports")} className="enterprise-button-secondary border-white/20 bg-white/10 text-white shadow-none hover:bg-white/15">
            Back
          </button>
        </div>

        <div className="report-toolbar">
          {error && <div className="status-error">{error}</div>}

        <div className="mt-4 min-w-0">
          <div className="report-control-label">Select term</div>
          <div className="report-chip-rail">
            <div className="report-chip-row">
            {terms.map((term) => (
              <button
                key={term.id}
                onClick={() => setSelectedTerm(term)}
                className={`report-choice-card min-w-48 ${selectedTerm?.id === term.id ? "report-choice-card-active" : ""}`}
              >
                <div className="font-semibold">{term.name}</div>
                <div className={`mt-1 text-xs ${selectedTerm?.id === term.id ? "text-white/80" : "text-slate-500"}`}>
                  {term.startDate} to {term.endDate}
                </div>
              </button>
            ))}
            </div>
          </div>
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
            <button type="button" onClick={() => openReportPdf({ title: "Termly Reports", subtitle: selectedTerm ? `${selectedTerm.startDate} to ${selectedTerm.endDate}` : "", filename: (selectedTerm ? `Termly-Report-${selectedTerm.name}` : "termly-report").replace(/\s+/g, "-"), subjectLabel: "Student", rows })} className="enterprise-button-secondary">Print / PDF</button>
            <button type="button" onClick={() => exportReportCsv({ title: "Termly Reports", subtitle: selectedTerm ? `${selectedTerm.startDate} to ${selectedTerm.endDate}` : "", filename: (selectedTerm ? `Termly-Report-${selectedTerm.name}` : "termly-report").replace(/\s+/g, "-"), subjectLabel: "Student", rows })} className="enterprise-button-secondary">Export CSV</button>
          </div>
        ) : null}

        {rows.length > 0 ? <AttendanceTotalsCards rows={rows} subjectLabel="Students" groupLabel={selectedClassKey ? "Selected class" : "All classes"} /> : null}
        {loading && <div className="report-empty">Loading report...</div>}
        {!loading && !selectedTerm && <div className="report-empty">Select a term to view report data.</div>}
        {!loading && selectedTerm && rows.length === 0 && <div className="report-empty">No data for selected term or class.</div>}

        {rows.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-2 py-1">Student</th>
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
                            `/reports/student/${row.studentId}?fromIso=${selectedTerm?.startDate}&toIso=${selectedTerm?.endDate}&title=${selectedTerm?.name} Report`
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
