import { useEffect, useState } from "react";
import { getAttendanceAudit, type AttendanceAuditRow } from "../services/attendanceAudit";
import { listStaff } from "../services/staff";
import { listStudents } from "../services/students";

type Props = { periodFrom?: string; periodTo?: string };
export default function AttendanceAuditPanel({ periodFrom, periodTo }: Props = {}) {
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(periodFrom ?? defaultFrom); const [to, setTo] = useState(periodTo ?? new Date().toISOString().slice(0, 10)); const [rows, setRows] = useState<AttendanceAuditRow[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (periodFrom) setFrom(periodFrom); if (periodTo) setTo(periodTo); }, [periodFrom, periodTo]);
  useEffect(() => { let active = true; void Promise.all([getAttendanceAudit(from, to), listStaff(), listStudents()]).then(([audit, staff, students]) => { if (!active) return; const labels = new Map<string, string>(); staff.forEach((x: any) => labels.set(x.id, x.staffId || x.name || "Staff member")); students.forEach((x: any) => labels.set(x.id, x.studentId || x.rollNo || x.name || "Student")); setRows(audit.map((x) => ({ ...x, displayId: labels.get(x.personId) }))); }).catch((e) => active && setError(e?.message ?? "Unable to load audit.")).finally(() => active && setError((current) => current)); return () => { active = false; }; }, [from, to]);
  const groups = [["Habitual late", rows.filter(r => r.late >= 3), "late"], ["Early departures", rows.filter(r => r.early > 0), "early"], ["Missing sign-outs", rows.filter(r => r.missingSignOut > 0), "missingSignOut"]] as const;
  return <section className="enterprise-panel p-4"><h2 className="text-lg font-extrabold text-slate-900">Attendance audit</h2><p className="mt-1 text-base text-slate-700">Period: {from} to {to}</p>{!periodFrom || !periodTo ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="enterprise-input" /><input type="date" value={to} onChange={e => setTo(e.target.value)} className="enterprise-input" /></div> : null}{error ? <p className="mt-3 text-red-700">{error}</p> : <div className="mt-4 grid gap-3 md:grid-cols-3">{groups.map(([title, items, key]) => <div key={title} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between font-extrabold text-slate-800"><span>{title}</span><span>{items.length}</span></div>{items.slice(0, 5).map(row => <div key={row.personId} className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base"><span>{row.displayId || "Person"}</span><strong>{row[key]}</strong></div>)}</div>)}</div>}</section>;
}
