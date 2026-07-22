import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listClasses, type SchoolClass } from "../services/classes";
import { getAttendanceSummary, type AttendanceSummary } from "../services/attendanceSummary";
import { exportReportCsv, openReportPdf } from "../services/reportExport";
import AttendanceTotalsCards from "./AttendanceTotalsCards";
import { autoMarkAbsentAllClasses } from "../services/autoMarkAbsent";

interface ClassAttendanceReportProps {
  title: string;
  description: string;
  initialFrom: string;
  initialTo: string;
}

function classValue(cls: SchoolClass) {
  return cls.classId ?? cls.id ?? "";
}

function rangeLabel(from: string, to: string) {
  return from === to ? from : `${from} to ${to}`;
}

function StudentMobileRow({ row, title, from, to }: { row: AttendanceSummary; title: string; from: string; to: string }) {
  return (
    <div className="report-mobile-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold text-slate-950">{row.studentName || "Student"}</div>
          <div className="mt-0.5 text-xs text-slate-500">{row.displayId || row.studentId}</div>
        </div>
        <Link
          to={`/reports/student/${row.studentId}?fromIso=${from}&toIso=${to}&title=${encodeURIComponent(title)}`}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Open
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2 text-center">
        <span className="report-stat-pill bg-emerald-50 text-emerald-700">P {row.presentCount}</span>
        <span className="report-stat-pill bg-amber-50 text-amber-700">L {row.lateCount}</span>
        <span className="report-stat-pill bg-sky-50 text-sky-700">T {row.attendedSessions}</span>
        <span className="report-stat-pill bg-red-50 text-red-600">A {row.absentCount}</span>
        <span className="report-stat-pill bg-slate-100 text-slate-700">{row.percentagePresent.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function ClassAttendanceReport({
  title,
  description,
  initialFrom,
  initialTo,
}: ClassAttendanceReportProps) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [results, setResults] = useState<AttendanceSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClassName = useMemo(() => {
    if (!classId) return "All classes";
    return classes.find((cls) => classValue(cls) === classId)?.name ?? "Selected class";
  }, [classId, classes]);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialFrom, initialTo]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const allClasses = await listClasses();
        if (!active) return;
        setClasses(allClasses);
      } catch (err) {
        console.error("load classes", err);
        setError("Failed to load classes");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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
        await autoMarkAbsentAllClasses({ dateIso: to });
      }
      const data = await getAttendanceSummary({
        fromIso: from,
        toIso: to,
        classId: classId || undefined,
        includeStudentName: true,
      });
      setResults(data);
    } catch (err: any) {
      console.error("generate report", err);
      setError(err?.message ?? "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  const exportTitle = `${title} - ${selectedClassName}`;
  const exportSubtitle = rangeLabel(from, to);
  const exportFilename = `${title}-${selectedClassName}-${from}-${to}`.replace(/\s+/g, "-");

  return (
    <div className="report-page">
      <section className="report-hero">
        <div className="report-hero-bar">
          <div>
            <h1 className="report-title">{title}</h1>
            <p className="report-subtitle">{description}</p>
          </div>
          <Link to="/reports" className="enterprise-button-secondary border-white/20 bg-white/10 text-white shadow-none hover:bg-white/15">
            Back
          </Link>
        </div>

        <div className="report-toolbar lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3 md:grid-cols-[12rem_12rem_1fr]">
            <label className="block">
              <span className="report-control-label">From</span>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="enterprise-input" />
            </label>

            <label className="block">
              <span className="report-control-label">To</span>
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="enterprise-input" />
            </label>

            <div className="min-w-0">
              <span className="report-control-label">Filter by class</span>
              <div className="report-chip-rail">
                <div className="report-chip-row">
                <button type="button" onClick={() => setClassId("")} className={`report-filter-chip ${!classId ? "report-filter-chip-active" : ""}`}>
                  All classes
                </button>
                {classes.map((cls) => {
                  const value = classValue(cls);
                  return (
                    <button key={cls.id ?? value} type="button" onClick={() => setClassId(value)} className={`report-filter-chip ${classId === value ? "report-filter-chip-active" : ""}`}>
                      {cls.name}
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={onGenerate} disabled={loading} className="enterprise-button-primary h-10">
            {loading ? "Generating..." : "Generate report"}
          </button>
        </div>
      </section>

      {error ? <div className="status-error">{error}</div> : null}

      <section className="report-results">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Students ({results?.length ?? 0})</h2>
            <p className="mt-1 text-sm text-slate-600">P = Present, L = Late, T = Attended, A = Absent</p>
          </div>

          {results && results.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openReportPdf({ title: exportTitle, subtitle: exportSubtitle, filename: exportFilename, subjectLabel: "Student", rows: results })} className="enterprise-button-secondary">
                Print / PDF
              </button>
              <button type="button" onClick={() => exportReportCsv({ title: exportTitle, subtitle: exportSubtitle, filename: exportFilename, subjectLabel: "Student", rows: results })} className="enterprise-button-secondary">
                Export CSV
              </button>
            </div>
          ) : null}
        </div>

        {results && results.length > 0 ? <AttendanceTotalsCards rows={results} subjectLabel="Students" groupLabel={selectedClassName} /> : null}
        {results && results.length === 0 ? <p className="report-empty">No attendance records were found for the selected date range.</p> : null}
        {!results && !loading ? <p className="report-empty">Generate a report to view student attendance counts.</p> : null}
        {loading ? <p className="report-empty">Loading report...</p> : null}

        {results && results.length > 0 ? (
          <>
            <div className="mt-3 grid gap-3 md:hidden">
              {results.map((row) => (
                <StudentMobileRow key={row.studentId} row={row} title={title} from={from} to={to} />
              ))}
            </div>

            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student ID</th>
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
                    <tr key={row.studentId}>
                      <td className="font-semibold text-slate-900">{row.studentName ?? "Student"}</td>
                      <td className="text-slate-600">{row.displayId || row.studentId}</td>
                      <td className="font-semibold text-emerald-700">{row.presentCount}</td>
                      <td className="font-semibold text-amber-700">{row.lateCount}</td>
                      <td className="font-semibold text-blue-700">{row.attendedSessions}</td>
                      <td className="font-semibold text-red-600">{row.absentCount}</td>
                      <td className="font-semibold text-slate-700">{row.percentagePresent.toFixed(1)}%</td>
                      <td className="text-right">
                        <Link to={`/reports/student/${row.studentId}?fromIso=${from}&toIso=${to}&title=${encodeURIComponent(title)}`} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

