import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAttendanceForDate, todayISO } from "../services/attendance";
import { listStaff } from "../services/staff";
import { listStudents } from "../services/students";
import type { AttendanceRecord, Student } from "../types";
import type { Staff } from "../services/staff";

type SubjectFilter = "all" | "student" | "staff";
type StatusFilter = "all" | "present" | "late" | "absent";

function subjectType(record: AttendanceRecord): "student" | "staff" {
  if (record.subjectType === "staff" || record.staffId) return "staff";
  return "student";
}

function subjectKey(record: AttendanceRecord) {
  return record.subjectId ?? record.studentId ?? record.staffId ?? "";
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusClass(status?: string) {
  if (status === "present") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "late") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "absent") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

export default function AttendanceList() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;

    (async () => {
      setPeopleLoading(true);
      try {
        const [studentRows, staffRows] = await Promise.all([listStudents().catch(() => []), listStaff().catch(() => [])]);
        if (!active) return;
        setStudents(studentRows);
        setStaff(staffRows);
      } catch (err) {
        console.error("load attendance people", err);
      } finally {
        if (active) setPeopleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function loadAttendance(nextDate = date) {
    setLoading(true);
    setError(null);
    try {
      setRecords(await getAttendanceForDate(nextDate));
    } catch (err: any) {
      console.error("load attendance", err);
      setError(err?.message ?? "Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAttendanceForDate(date);
        if (active) setRecords(data);
      } catch (err: any) {
        console.error("load attendance", err);
        if (active) setError(err?.message ?? "Failed to load attendance records.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [date]);

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((student) => {
      if (student.id) map.set(student.id, student);
      if (student.studentId) map.set(student.studentId, student);
      if (student.rollNo) map.set(student.rollNo, student);
    });
    return map;
  }, [students]);

  const staffMap = useMemo(() => {
    const map = new Map<string, Staff>();
    staff.forEach((item) => {
      if (item.id) map.set(item.id, item);
      if (item.staffId) map.set(item.staffId, item);
    });
    return map;
  }, [staff]);

  const visibleRecords = useMemo(() => {
    return records.filter((record) => {
      const type = subjectType(record);
      const status = record.status ?? "present";
      return (subjectFilter === "all" || type === subjectFilter) && (statusFilter === "all" || status === statusFilter);
    });
  }, [records, statusFilter, subjectFilter]);

  const counts = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        const type = subjectType(record);
        const status = record.status ?? "present";
        acc.total += 1;
        acc[type] += 1;
        if (status === "present") acc.present += 1;
        if (status === "late") acc.late += 1;
        if (status === "absent") acc.absent += 1;
        return acc;
      },
      { total: 0, student: 0, staff: 0, present: 0, late: 0, absent: 0 }
    );
  }, [records]);

  function displaySubject(record: AttendanceRecord) {
    const key = subjectKey(record);
    if (subjectType(record) === "staff") {
      const person = staffMap.get(record.staffId ?? "") ?? staffMap.get(record.subjectId ?? "") ?? staffMap.get(key);
      return {
        name: person?.name ?? person?.email ?? "Unknown staff",
        meta: person?.staffId ? `ID: ${person.staffId}` : key ? `Record: ${key}` : "No staff ID",
      };
    }

    const person = studentMap.get(record.studentId ?? "") ?? studentMap.get(record.subjectId ?? "") ?? studentMap.get(key);
    const displayId = person?.studentId ?? person?.rollNo;
    return {
      name: person?.name ?? "Unknown student",
      meta: displayId ? `ID: ${displayId}` : key ? `Record: ${key}` : "No student ID",
    };
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-extrabold">Today's Attendance</h1>
            <p className="mt-1 text-xs text-white/70">Review student and staff attendance records for a selected date.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/attendance/checkin" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
              Take attendance
            </Link>
            <Link to="/attendance/qr" className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              QR scan
            </Link>
          </div>
        </div>

        <div className="grid gap-3 p-3 xl:grid-cols-[13rem_1fr_1fr_auto] xl:items-end">
          <label className="block">
            <span className="auth-label">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="enterprise-input mt-1.5" />
          </label>

          <div>
            <p className="auth-label mb-1.5">Subject</p>
            <div className="flex flex-wrap gap-2">
              {(["all", "student", "staff"] as SubjectFilter[]).map((value) => (
                <button key={value} type="button" onClick={() => setSubjectFilter(value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${subjectFilter === value ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {value === "all" ? "All" : value === "student" ? "Students" : "Staff"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="auth-label mb-1.5">Status</p>
            <div className="flex flex-wrap gap-2">
              {(["all", "present", "late", "absent"] as StatusFilter[]).map((value) => (
                <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${statusFilter === value ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {value}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => loadAttendance()} disabled={loading} className="enterprise-button-secondary">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Total", counts.total],
          ["Students", counts.student],
          ["Staff", counts.staff],
          ["Present", counts.present],
          ["Late", counts.late],
          ["Absent", counts.absent],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-3">
        {loading ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading attendance records...</p>
        ) : error ? (
          <div className="status-error">{error}</div>
        ) : visibleRecords.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">No attendance recorded for the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] table-auto border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Subject</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">In</th>
                  <th className="px-2 py-2">Out</th>
                  <th className="px-2 py-2">Method</th>
                  <th className="px-2 py-2">Biometric</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => {
                  const subject = displaySubject(record);
                  const type = subjectType(record);
                  return (
                    <tr key={record.id ?? `${subjectKey(record)}-${record.date}`} className="border-b last:border-0 even:bg-slate-50">
                      <td className="px-2 py-3">
                        <div className="font-semibold text-slate-900">{subject.name}</div>
                        <div className="text-xs text-slate-500">{subject.meta}</div>
                      </td>
                      <td className="px-2 py-3 capitalize text-slate-700">{type}</td>
                      <td className="px-2 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${statusClass(record.status)}`}>{record.status ?? "present"}</span>
                      </td>
                      <td className="px-2 py-3 text-slate-700">{formatTime(record.checkInTime)}</td>
                      <td className="px-2 py-3 text-slate-700">{formatTime(record.checkOutTime)}</td>
                      <td className="px-2 py-3 capitalize text-slate-700">{record.method ?? "manual"}</td>
                      <td className="px-2 py-3 text-slate-700">{record.biometric ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {peopleLoading ? <p className="mt-3 text-xs text-slate-500">Resolving names...</p> : null}
      </section>
    </div>
  );
}

