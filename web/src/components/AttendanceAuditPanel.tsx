import { useEffect, useState } from "react";
import { getAttendanceAudit, type AttendanceAuditRow } from "../services/attendanceAudit";
import { listStaff } from "../services/staff";
import { listStudents } from "../services/students";

export default function AttendanceAuditPanel() {
  const [rows, setRows] = useState<AttendanceAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    void Promise.all([getAttendanceAudit(from, to), listStaff(), listStudents()]).then(([audit, staff, students]) => {
      const labels = new Map<string, string>();
      staff.forEach((item: any) => labels.set(item.id, item.staffId || item.staffCode || item.employeeId || item.name || "Staff member"));
      students.forEach((item: any) => labels.set(item.id, item.studentId || item.rollNo || item.name || "Student"));
      setRows(audit.map((row) => ({ ...row, displayId: labels.get(row.personId) })));
    }).catch((e) => setError(e instanceof Error ? e.message : "Unable to load audit.")).finally(() => setLoading(false));
  }, []);
  const groups = [["Habitual late", rows.filter(r => r.late >= 3), "text-amber-800", "late"], ["Early departures", rows.filter(r => r.early > 0), "text-sky-800", "early"], ["Missing sign-outs", rows.filter(r => r.missingSignOut > 0), "text-red-800", "missingSignOut"]] as const;
  return <section className="enterprise-panel p-4"><h2 className="text-lg font-extrabold text-slate-900">Attendance audit</h2><p className="mt-1 text-base font-medium text-slate-700">Last 30 days · admin follow-up indicators</p>{loading ? <p className="mt-4 text-base text-slate-600">Loading audit...</p> : error ? <p className="mt-4 text-base text-red-700">{error}</p> : !rows.length ? <p className="mt-4 text-base text-emerald-700">No attendance follow-up indicators found.</p> : <div className="mt-4 grid gap-3 md:grid-cols-3">{groups.map(([title, items, color, key]) => <div key={title} className="rounded-lg bg-slate-50 p-3"><div className="flex items-center justify-between"><h3 className={`font-extrabold ${color}`}>{title}</h3><span className="text-xl font-black text-slate-900">{items.length}</span></div>{items.slice(0, 5).map(row => <div key={row.personId} className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-2"><span className="truncate text-base font-semibold text-slate-700">{row.displayId || "Person"}</span><span className="font-black text-slate-900">{row[key]}</span></div>)}</div>)}</div>}</section>;
}
