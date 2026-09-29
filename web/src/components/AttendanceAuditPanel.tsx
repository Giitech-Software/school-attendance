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

  useEffect(() => {
    if (periodFrom) setFrom(periodFrom);
    if (periodTo) setTo(periodTo);
  }, [periodFrom, periodTo]);

  useEffect(() => {
    let active = true;
    void Promise.all([getAttendanceAudit(from, to), listStaff(), listStudents()])
      .then(([audit, staff, students]) => {
        if (!active) return;
        const labels = new Map<string, string>();
        staff.forEach((person: any) => labels.set(person.id, person.staffId || person.name || "Staff member"));
        students.forEach((person: any) => labels.set(person.id, person.studentId || person.rollNo || person.name || "Student"));
        setRows(audit.map((row) => ({ ...row, displayId: labels.get(row.personId) })));
      })
      .catch((reason: any) => {
        if (active) setError(reason?.message ?? "Unable to load audit.");
      })
    return () => { active = false; };
  }, [from, to]);

  const groups = [
    ["Habitual late", rows.filter((row) => row.late >= 3), "late"],
    ["Early departures", rows.filter((row) => row.early > 0), "early"],
    ["Missing sign-outs", rows.filter((row) => row.missingSignOut > 0), "missingSignOut"],
  ] as const;

  return <section className="enterprise-panel p-4"><h2 className="text-lg font-extrabold text-slate-900">Attendance audit</h2><p className="mt-1 text-base text-slate-700">Period: {from} to {to}</p>{!periodFrom || !periodTo ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="enterprise-input" /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="enterprise-input" /></div> : null}{error ? <p className="mt-3 text-red-700">{error}</p> : <div className="mt-4 grid gap-3 md:grid-cols-3">{groups.map(([title, items, key]) => <div key={title} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between font-extrabold text-slate-800"><span>{title}</span><span>{items.length}</span></div>{items.slice(0, 5).map((row) => <div key={row.personId} className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base"><span>{row.displayId || "Person"}</span><strong>{row[key]}</strong></div>)}</div>)}</div>}</section>;
}
