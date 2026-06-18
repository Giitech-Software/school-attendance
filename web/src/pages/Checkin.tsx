import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listClasses, type ClassRecord } from "../services/classes";
import { listStudents, type Student } from "../services/students";
import { getAttendanceForDate, registerAttendanceUnified, todayISO } from "../services/attendance";
import { getStaffByStaffId, listStaff, type Staff } from "../services/staff";
import { registerStaffAttendance } from "../services/staffAttendance";
import type { AttendanceRecord } from "../types";

function isAttendanceAllowed(): { allowed: boolean; reason?: string } {
  const today = new Date();
  const day = today.getDay();
  if (day === 0) return { allowed: false, reason: "Today is Sunday. Attendance is not allowed." };
  if (day === 6) return { allowed: false, reason: "Today is Saturday. Attendance is not allowed." };
  const holidays = ["2026-01-01", "2026-04-15", "2026-12-25"];
  if (holidays.includes(today.toISOString().slice(0, 10))) return { allowed: false, reason: "Today is a holiday. Attendance is not allowed." };
  return { allowed: true };
}

function classValue(cls?: ClassRecord) {
  return cls?.classId ?? cls?.id ?? "";
}

function timeLabel(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
}

function actionCardClass(tone: "primary" | "sky" | "emerald" | "slate") {
  const tones = {
    primary: "border-l-primary bg-primary/5",
    sky: "border-l-accent1 bg-sky-50",
    emerald: "border-l-emerald-500 bg-emerald-50",
    slate: "border-l-slate-500 bg-slate-50",
  };
  return `rounded-lg border border-slate-200 border-l-4 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones[tone]}`;
}

export default function Checkin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const actor = searchParams.get("actor") === "staff" ? "staff" : "student";
  const initialMode = searchParams.get("mode") === "out" ? "out" : "in";
  const [mode, setMode] = useState<"in" | "out">(initialMode);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [staffIdInput, setStaffIdInput] = useState("");
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const attendanceCheck = isAttendanceAllowed();
  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId || cls.classId === selectedClassId),
    [classes, selectedClassId]
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [classRows, attendanceRows, studentRows, staffRows] = await Promise.all([
          listClasses(),
          getAttendanceForDate(todayISO()),
          listStudents().catch(() => []),
          listStaff().catch(() => []),
        ]);
        if (!active) return;
        setClasses(classRows);
        setAllStudents(studentRows);
        setStaffMembers(staffRows);
        setTodayAttendance(attendanceRows);
        if (classRows.length > 0) setSelectedClassId((current) => current || classValue(classRows[0]));
      } catch (err: any) {
        console.error("load check-in data", err);
        if (active) setError(err?.message ?? "Failed to load attendance data.");
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

    if (actor !== "student" || !selectedClassId) {
      setStudents([]);
      return;
    }

    listStudents(selectedClassId)
      .then((rows) => {
        if (active) setStudents(rows);
      })
      .catch((err) => {
        console.error("load students", err);
        if (active) setError(err?.message ?? "Failed to load students.");
      });

    return () => {
      active = false;
    };
  }, [actor, selectedClassId]);

  function changeActor(nextActor: "student" | "staff") {
    setSearchParams({ actor: nextActor, mode });
    setError(null);
    setSuccess(null);
  }


  async function refreshAttendance() {
    setTodayAttendance(await getAttendanceForDate(todayISO()));
  }

  async function submitStudentAttendance(studentId = selectedStudentId, nextMode: "in" | "out" = mode) {
    if (!studentId) {
      setError("Select a student before recording attendance.");
      return;
    }
    if (!selectedClassId) {
      setError("Select a class before recording attendance.");
      return;
    }
    if (!attendanceCheck.allowed) {
      setError(attendanceCheck.reason ?? "Attendance is not allowed today.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const student = students.find((item) => item.id === studentId);
      await registerAttendanceUnified({
        studentId,
        classId: selectedClassId,
        classDocId: selectedClass?.id,
        mode: nextMode,
        method: "manual",
        biometric: false,
      });
      setSuccess(`${student?.name ?? student?.studentId ?? "Student"} checked ${nextMode === "in" ? "in" : "out"} successfully.`);
      setSelectedStudentId("");
      await refreshAttendance();
    } catch (err: any) {
      setError(err?.message ?? "Could not record student attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStaffAttendance(nextMode = mode) {
    if (!staffIdInput.trim()) {
      setError("Enter a staff ID before recording attendance.");
      return;
    }
    if (!attendanceCheck.allowed) {
      setError(attendanceCheck.reason ?? "Attendance is not allowed today.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const staffCode = staffIdInput.trim();
      const staff = await getStaffByStaffId(staffCode);
      if (!staff?.id) throw new Error(`No staff record found for ID: ${staffCode}`);
      await registerStaffAttendance({ staffId: staff.id, mode: nextMode, method: "manual", biometric: false });
      setStaffMembers((current) => (current.some((item) => item.id === staff.id || item.staffId === staff.staffId) ? current : [...current, staff]));
      setSuccess(`${staff.name ?? staff.staffId ?? "Staff member"} checked ${nextMode === "in" ? "in" : "out"} successfully.`);
      setStaffIdInput("");
      await refreshAttendance();
    } catch (err: any) {
      setError(err?.message ?? "Could not record staff attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  const studentLookup = useMemo(() => {
    const map = new Map<string, Student>();
    [...allStudents, ...students].forEach((student) => {
      if (student.id) map.set(student.id, student);
      if (student.studentId) map.set(student.studentId, student);
      if (student.rollNo) map.set(student.rollNo, student);
    });
    return map;
  }, [allStudents, students]);

  const staffLookup = useMemo(() => {
    const map = new Map<string, Staff>();
    staffMembers.forEach((staff) => {
      if (staff.id) map.set(staff.id, staff);
      if (staff.staffId) map.set(staff.staffId, staff);
    });
    return map;
  }, [staffMembers]);

  function getAttendanceSubject(record: AttendanceRecord) {
    const rawId = record.subjectId ?? record.studentId ?? record.staffId ?? "";

    if (record.subjectType === "staff" || record.staffId) {
      const staff = staffLookup.get(record.staffId ?? "") ?? staffLookup.get(record.subjectId ?? "");
      return {
        name: staff?.name ?? "Unknown staff",
        meta: staff?.staffId ? `ID: ${staff.staffId}` : rawId ? `Record: ${rawId}` : "No staff ID",
      };
    }

    const student = studentLookup.get(record.studentId ?? "") ?? studentLookup.get(record.subjectId ?? "");
    const displayId = student?.studentId ?? student?.rollNo;
    return {
      name: student?.name ?? "Unknown student",
      meta: displayId ? `ID: ${displayId}` : rawId ? `Record: ${rawId}` : "No student ID",
    };
  }

  const filteredTodayAttendance = todayAttendance.filter((record) =>
    actor === "staff" ? record.subjectType === "staff" || record.staffId : record.subjectType !== "staff" && record.studentId
  );

  const qrClassQuery = selectedClassId ? `&classId=${selectedClassId}&classDocId=${selectedClass?.id ?? ""}` : "";

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold">{actor === "student" ? "Student Attendance" : "Staff Attendance"}</h1>
            <p className="mt-1 text-xs text-white/70">{actor === "student" ? "Scan QR or fingerprint for check-in." : "Scan QR or use face recognition for check-in."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/attendance/qr?actor=${actor}&mode=${mode}${qrClassQuery}`} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-extrabold text-primary">
              QR Scanner
            </Link>
            <Link to="/attendance" className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
              View List
            </Link>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
          <div className="p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => changeActor("student")} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${actor === "student" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-dark hover:bg-slate-50"}`}>
                Students
              </button>
              <button type="button" onClick={() => changeActor("staff")} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${actor === "staff" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-dark hover:bg-slate-50"}`}>
                Staff
              </button>
            </div>
          </div>
          <img src="/how-it-works2.jpg" alt="Attendance workflow" className="hidden h-full min-h-24 w-full object-cover lg:block" />
        </div>
      </section>

      {!attendanceCheck.allowed ? <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">{attendanceCheck.reason}</div> : null}
      {error ? <div className="status-error">{error}</div> : null}
      {success ? <div className="status-success">{success}</div> : null}

      <section className="grid gap-3 xl:grid-cols-[1fr_21rem]">
        <div className="space-y-3">
          {actor === "student" ? (
            <div className="enterprise-panel p-3">
              <p className="mb-2 text-sm font-semibold text-dark">Choose class</p>
              {loading ? (
                <p className="text-sm text-neutral">Loading classes...</p>
              ) : classes.length === 0 ? (
                <p className="text-sm text-neutral">No classes found.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {classes.map((cls) => {
                    const value = classValue(cls);
                    const selected = value === selectedClassId || cls.id === selectedClassId;
                    return (
                      <button key={cls.id} type="button" onClick={() => setSelectedClassId(value)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${selected ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-dark hover:bg-slate-50"}`}>
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {actor === "staff" ? (
            <div className="enterprise-panel p-3">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-dark">Staff ID Attendance</h2>
                <p className="text-sm text-neutral">Enter a staff ID to check staff in or out.</p>
              </div>
              <input
                value={staffIdInput}
                onChange={(event) => setStaffIdInput(event.target.value.toUpperCase())}
                placeholder="e.g. TCH-0001 or NST-0001"
                className="enterprise-input"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => submitStaffAttendance("in")} disabled={submitting || !attendanceCheck.allowed} className="enterprise-button-primary justify-center">
                  Check-In
                </button>
                <button type="button" onClick={() => submitStaffAttendance("out")} disabled={submitting || !attendanceCheck.allowed} className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
                  Check-Out
                </button>
              </div>
            </div>
          ) : null}

          {actor === "student" ? (
            <div className="enterprise-panel p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto]">
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={loading || students.length === 0} className="enterprise-input">
                  <option value="">Choose a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name ?? student.studentId ?? student.id}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => { setMode("in"); submitStudentAttendance(selectedStudentId, "in"); }} disabled={submitting || !attendanceCheck.allowed || !selectedStudentId} className="enterprise-button-primary justify-center">
                  Check-In
                </button>
                <button type="button" onClick={() => { setMode("out"); submitStudentAttendance(selectedStudentId, "out"); }} disabled={submitting || !attendanceCheck.allowed || !selectedStudentId} className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
                  Check-Out
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {actor === "student" ? (
              <>
                <div className={actionCardClass("primary") + " opacity-75"}>
                  <h2 className="text-base font-semibold text-dark">Student Biometric Attendance</h2>
                  <p className="mt-1 text-sm text-neutral">Check-in or check-out using fingerprint.</p>
                  <p className="mt-2 text-xs font-semibold text-primary">Available on mobile</p>
                </div>
                <Link to={`/attendance/face?actor=student&mode=in${qrClassQuery}`} className={actionCardClass("emerald")}>
                  <h2 className="text-base font-semibold text-dark">Student Face Check-In</h2>
                  <p className="mt-1 text-sm text-neutral">Check-in using facial recognition.</p>
                </Link>
                <Link to={`/attendance/face?actor=student&mode=out${qrClassQuery}`} className={actionCardClass("slate")}>
                  <h2 className="text-base font-semibold text-dark">Student Face Check-Out</h2>
                  <p className="mt-1 text-sm text-neutral">Check-out using facial recognition.</p>
                </Link>
              </>
            ) : null}

            <Link to={`/attendance/qr?actor=${actor}&mode=in${qrClassQuery}`} className={actionCardClass("primary")}>
              <h2 className="text-base font-semibold text-dark">Scan QR Code (In)</h2>
              <p className="mt-1 text-sm text-neutral">Check-in via QR scan.</p>
            </Link>

            <Link to={`/attendance/qr?actor=${actor}&mode=out${qrClassQuery}`} className={actionCardClass("sky")}>
              <h2 className="text-base font-semibold text-dark">Scan QR Code (Out)</h2>
              <p className="mt-1 text-sm text-neutral">Check-out via QR scan.</p>
            </Link>

            {actor === "staff" ? (
              <>
                <Link to="/attendance/face?actor=staff&mode=in" className={actionCardClass("emerald")}>
                  <h2 className="text-base font-semibold text-dark">Staff Face Check-In</h2>
                  <p className="mt-1 text-sm text-neutral">Check-in using facial recognition.</p>
                </Link>
                <Link to="/attendance/face?actor=staff&mode=out" className={actionCardClass("slate")}>
                  <h2 className="text-base font-semibold text-dark">Staff Face Check-Out</h2>
                  <p className="mt-1 text-sm text-neutral">Check-out using facial recognition.</p>
                </Link>
              </>
            ) : null}
          </div>

          <div className="enterprise-panel p-3">
            <h2 className="mb-2 text-base font-semibold text-dark">How it works</h2>
            <div className="grid gap-2 text-sm text-neutral md:grid-cols-2">
              <p>{actor === "staff" ? "Scan QR or use face recognition for check-in." : "Scan QR or fingerprint for check-in."}</p>
              <p>Attendance is logged automatically.</p>
            </div>
          </div>
        </div>

        <aside className="enterprise-panel p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-dark">Today's attendance</h2>
              <p className="text-xs text-neutral">{todayISO()}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{filteredTodayAttendance.length}</span>
          </div>

          <div className="mt-3 space-y-2">
            {filteredTodayAttendance.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-neutral">No records yet.</p>
            ) : (
              filteredTodayAttendance.slice(0, 10).map((record) => {
                const subject = getAttendanceSubject(record);
                return (
                  <div key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-dark">{subject.name}</p>
                        <p className="truncate text-xs text-slate-500">{subject.meta}</p>
                        <p className="text-xs text-slate-600">In: {timeLabel(record.checkInTime)}</p>
                        <p className="text-xs text-slate-600">Out: {timeLabel(record.checkOutTime)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${record.status === "late" ? "bg-amber-100 text-amber-700" : record.status === "absent" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {record.status ?? "present"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}






