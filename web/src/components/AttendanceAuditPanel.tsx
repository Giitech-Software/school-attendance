import { useEffect, useState } from "react";
import { getAttendanceAudit, type AttendanceAuditRow } from "../services/attendanceAudit";
import { listStaff } from "../services/staff";
import { listStudents } from "../services/students";

type Props = { periodFrom?: string; periodTo?: string };

export default function AttendanceAuditPanel({ periodFrom, periodTo }: Props = {}) {
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(periodFrom ?? defaultFrom);
  const [to, setTo] = useState(periodTo ?? new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttendanceAuditRow[]>([]);
  const [error, setError] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (periodFrom) setFrom(periodFrom);
    if (periodTo) setTo(periodTo);
  }, [periodFrom, periodTo]);

  useEffect(() => {
    let active = true;
    void Promise.all([getAttendanceAudit(from, to), listStaff(), listStudents()])
      .then(([audit, staff, students]) => {
        if (!active) return;
        const labels = new Map<string, { displayId: string; displayName: string }>();
        staff.forEach((person: any) => labels.set(person.id, { displayId: person.staffId || "Staff ID unavailable", displayName: person.name || "Staff member" }));
        students.forEach((person: any) => labels.set(person.id, { displayId: person.studentId || person.rollNo || "Student ID unavailable", displayName: person.name || "Student" }));
        setRows(audit.map((row) => ({ ...row, ...labels.get(row.personId) })));
      })
      .catch((reason: any) => {
        if (active) setError(reason?.message ?? "Unable to load audit.");
      })
    return () => { active = false; };
  }, [from, to]);

  const groups = [
    ["Habitual late", rows.filter((row) => row.late >= 3), "late", "text-amber-800", "border-amber-200"],
    ["Absentees", rows.filter((row) => row.absent > 0), "absent", "text-red-800", "border-red-200"],
    ["Early departures", rows.filter((row) => row.early > 0), "early", "text-sky-800", "border-sky-200"],
    ["Missing sign-outs", rows.filter((row) => row.missingSignOut > 0), "missingSignOut", "text-slate-800", "border-slate-200"],
  ] as const;

  return <section className="enterprise-panel p-4">
    <h2 className="text-lg font-extrabold text-slate-900">Attendance audit</h2>
    <p className="mt-1 text-base text-slate-700">Period: {from} to {to}</p>
    {!periodFrom || !periodTo ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="enterprise-input" /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="enterprise-input" /></div> : null}
    {error ? <p className="mt-3 text-red-700">{error}</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {groups.map(([title, items, key, tone, border]) => {
        const isExpanded = expandedGroup === title;
        return <article key={title} className={`overflow-hidden rounded-lg border bg-white ${border}`}>
          <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedGroup(isExpanded ? null : title)} className={`flex w-full items-center justify-between gap-3 p-3 text-left ${tone} hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary`}>
            <span className="font-extrabold">{title}</span>
            <span className="flex items-center gap-2"><strong className="text-xl">{items.length}</strong><span className="text-xs font-semibold">{isExpanded ? "Hide" : "View"}</span></span>
          </button>
          {isExpanded ? <div className="max-h-72 overflow-y-auto border-t border-slate-100 p-3">
            {items.length ? <ul className="space-y-2">{items.map((row) => <li key={row.personId} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{row.displayName || "Person"}</span><span className="block text-xs text-slate-500">{row.displayId || row.personId} · Last record {row.lastDate}</span></span><strong className="shrink-0 text-slate-800">{row[key]}</strong></li>)}</ul> : <p className="text-sm text-slate-500">No matching records for this period.</p>}
          </div> : null}
        </article>;
      })}
    </div>}
  </section>;
}
