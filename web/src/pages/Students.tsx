import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteStudent, listStudents } from "../services/students";
import type { Student } from "../types";

function enrollmentState(student: Student) {
  const fingerprint = Boolean(student.fingerprintId);
  const face = Boolean(student.faceId || student.faceEmbedding || student.faceEnrolledAt);
  if (fingerprint && face) return "Face + biometric enrolled";
  if (fingerprint) return "Biometric enrolled";
  if (face) return "Face enrolled";
  return "Biometric not enrolled";
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadStudents() {
    setLoading(true);
    try {
      setStudents(await listStudents());
    } catch (err: any) {
      alert(err?.message ?? "Failed to load students.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      [student.name, student.studentId, student.rollNo, student.classId].some((value) => (value ?? "").toLowerCase().includes(q))
    );
  }, [search, students]);

  const counts = useMemo(() => {
    return students.reduce(
      (acc, student) => {
        acc.total += 1;
        if (student.isActive === false) acc.inactive += 1;
        else acc.active += 1;
        if (student.fingerprintId || student.faceId || student.faceEmbedding || student.faceEnrolledAt) acc.enrolled += 1;
        return acc;
      },
      { total: 0, active: 0, inactive: 0, enrolled: 0 }
    );
  }, [students]);

  async function handleDelete(student: Student) {
    if (!window.confirm(`Delete student "${student.name ?? student.studentId ?? student.id}"? This action cannot be undone.`)) return;
    setDeletingId(student.id);
    try {
      await deleteStudent(student.id);
      setStudents((current) => current.filter((item) => item.id !== student.id));
    } catch (err: any) {
      alert(err?.message ?? "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back">
                Back
              </Link>
              <h1 className="text-xl font-extrabold">
                Students ({search ? `${filteredStudents.length} of ${students.length}` : students.length})
              </h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Manage student records, class assignment, IDs, and enrollment status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/students/bulk-import" className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600">
              Import
            </Link>
            <Link to="/students/create" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
              Add
            </Link>
            <Link to="/students/qr-generator" className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              QRs
            </Link>
          </div>
        </div>

        <div className="grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="auth-label">Search students</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students..." className="enterprise-input mt-1.5" />
          </label>
          <button type="button" onClick={loadStudents} disabled={loading} className="enterprise-button-secondary">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", counts.total],
          ["Active", counts.active],
          ["Enrolled", counts.enrolled],
          ["Inactive", counts.inactive],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-3">
        {loading ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading students...</p>
        ) : filteredStudents.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">No students yet.</p>
        ) : (
          <div className="grid gap-2">
            {filteredStudents.map((student) => {
              const enrolled = Boolean(student.fingerprintId || student.faceId || student.faceEmbedding || student.faceEnrolledAt);
              const inactive = student.isActive === false;
              return (
                <div key={student.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/students/${student.id}`} className="truncate text-base font-bold text-slate-950 hover:text-primary">
                          {student.name ?? "Unnamed student"}
                        </Link>
                        {inactive ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">Inactive</span> : null}
                      </div>
                      <div className="mt-1 grid gap-1 text-sm text-slate-600 sm:grid-cols-3">
                        <p>Class: {student.classId ?? "-"}</p>
                        <p>ID: {student.studentId ?? "Auto"}</p>
                        <p>{student.rollNo ? `Roll ${student.rollNo}` : "No roll number"}</p>
                      </div>
                      <p className={enrolled ? "mt-1 text-xs font-semibold text-emerald-700" : "mt-1 text-xs font-semibold text-slate-500"}>{enrollmentState(student)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link to={`/students/${student.id}`} className="enterprise-button-secondary">
                        Edit
                      </Link>
                      {!student.fingerprintId ? (
                        <Link to={`/students/enroll-biometric?id=${student.id}`} className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                          Enroll
                        </Link>
                      ) : null}
                      <button type="button" onClick={() => handleDelete(student)} disabled={deletingId === student.id} className="enterprise-button-danger">
                        {deletingId === student.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

