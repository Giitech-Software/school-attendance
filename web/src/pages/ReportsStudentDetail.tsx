import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getStudentById } from "../services/students";
import { computeAttendanceSummaryForStudent, type AttendanceSummary } from "../services/attendanceSummary";
import { getCurrentTerm } from "../services/terms";
import { exportReportCsv, openReportPdf } from "../services/reportExport";

function fallbackFromDate() {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return start.toISOString().slice(0, 10);
}

export default function ReportsStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const [studentName, setStudentName] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [range, setRange] = useState<{ fromIso: string; toIso: string; title: string } | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError("Missing student ID.");
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [student, currentTerm] = await Promise.all([getStudentById(id), getCurrentTerm().catch(() => null)]);
        if (!active) return;

        const today = new Date().toISOString().slice(0, 10);
        const fromIso = params.get("fromIso") ?? currentTerm?.startDate ?? fallbackFromDate();
        const toIso = params.get("toIso") ?? today;
        const title = params.get("title") ?? "Student report";

        setStudentName(student?.name ?? "Student");
        setDisplayId(student?.studentId ?? student?.rollNo ?? null);
        setRange({ fromIso, toIso, title });

        const result = await computeAttendanceSummaryForStudent(id, fromIso, toIso);
        if (!active) return;
        setSummary(result);
      } catch (err: any) {
        console.error("load student report", err);
        if (active) setError(err?.message ?? "Failed to load student report.");
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
            <h1 className="text-xl font-extrabold text-slate-950">{range?.title ?? "Student report"}</h1>
            <p className="mt-2 text-slate-600">
              {studentName ?? id ?? "Student"}
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
                <button type="button" onClick={() => openReportPdf({ title: range.title, subtitle: `${studentName ?? "Student"}${displayId ? ` (${displayId})` : ""} - ${range.fromIso} to ${range.toIso}`, filename: `${range.title}-${studentName ?? id}`.replace(/\s+/g, "-"), subjectLabel: "Student", rows: [{ ...summary, studentName: studentName ?? "Student", displayId: displayId ?? summary.displayId }] })} className="enterprise-button-secondary">
                  Print / PDF
                </button>
                <button type="button" onClick={() => exportReportCsv({ title: range.title, subtitle: `${studentName ?? "Student"}${displayId ? ` (${displayId})` : ""} - ${range.fromIso} to ${range.toIso}`, filename: `${range.title}-${studentName ?? id}`.replace(/\s+/g, "-"), subjectLabel: "Student", rows: [{ ...summary, studentName: studentName ?? "Student", displayId: displayId ?? summary.displayId }] })} className="enterprise-button-secondary">
                  Export CSV
                </button>
              </>
            ) : null}
            <Link to="/reports" className="enterprise-button-secondary">
              Back to reports
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 text-slate-500">Loading student data...</div>
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
              <div className="text-sm text-slate-500">% Present</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.percentagePresent.toFixed(1)}%</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-slate-500">No attendance summary available.</div>
        )}
      </div>
    </div>
  );
}





