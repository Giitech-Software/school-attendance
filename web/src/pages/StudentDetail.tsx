import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listClasses, type ClassRecord } from "../services/classes";
import { getStudentById, upsertStudent } from "../services/students";
import type { Student } from "../types";

function classValue(cls: ClassRecord) {
  return cls.classId ?? cls.id ?? "";
}

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;

    (async () => {
      try {
        const [studentRow, classRows] = await Promise.all([getStudentById(id), listClasses().catch(() => [])]);
        if (!active) return;
        setStudent(studentRow);
        setClasses(classRows);
      } catch (err) {
        console.error(err);
        alert("Unable to load student.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student) return;

    setSaving(true);
    try {
      await upsertStudent({
        ...student,
        name: student.name?.trim() || undefined,
        studentId: student.studentId?.trim() || undefined,
        classId: student.classId?.trim() || undefined,
        rollNo: student.rollNo?.trim() || undefined,
      });
      navigate("/students");
    } catch (err: any) {
      alert(err?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading student...</div>;
  }

  if (!student) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Student not found.</div>;
  }

  const face = Boolean(student.faceId || student.faceEmbedding || student.faceEnrolledAt);
  const fingerprint = Boolean(student.fingerprintId);

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link to="/students" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to students">
              Back
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">Edit Student</h1>
              <p className="mt-1 text-xs text-white/70">{student.name ?? student.studentId ?? "Student profile"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/students/${student.id}/qr`} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Student QR
            </Link>
            <Link to={`/reports/student/${student.id}`} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              View report
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1fr_19rem]">
        <form onSubmit={handleSave} className="enterprise-panel p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="auth-label">Full name</span>
              <input value={student.name ?? ""} onChange={(event) => setStudent({ ...student, name: event.target.value })} className="enterprise-input mt-1.5" />
            </label>

            <label className="block">
              <span className="auth-label">Student ID</span>
              <input value={student.studentId ?? ""} onChange={(event) => setStudent({ ...student, studentId: event.target.value || undefined })} placeholder="Leave empty to keep or auto-generate" className="enterprise-input mt-1.5" />
            </label>

            <label className="block">
              <span className="auth-label">Class</span>
              {classes.length > 0 ? (
                <select value={student.classId ?? ""} onChange={(event) => setStudent({ ...student, classId: event.target.value || undefined })} className="enterprise-input mt-1.5">
                  <option value="">Select class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={classValue(cls)}>
                      {cls.name} {cls.classId ? `(${cls.classId})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={student.classId ?? ""} onChange={(event) => setStudent({ ...student, classId: event.target.value || undefined })} className="enterprise-input mt-1.5" />
              )}
            </label>

            <label className="block">
              <span className="auth-label">Roll no (optional)</span>
              <input value={student.rollNo ?? ""} onChange={(event) => setStudent({ ...student, rollNo: event.target.value || undefined })} className="enterprise-input mt-1.5" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="submit" disabled={saving} className="enterprise-button-primary">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => navigate("/students")} className="enterprise-button-secondary">
              Cancel
            </button>
          </div>
        </form>

        <aside className="enterprise-panel p-4">
          <h2 className="text-base font-bold text-slate-950">Enrollment Status</h2>
          <div className="mt-3 space-y-2">
            <div className={`rounded-lg border p-3 ${face ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-sm font-bold text-slate-900">Face</p>
              <p className="text-sm text-slate-600">{face ? "Enrolled" : "Not enrolled"}</p>
            </div>
            <div className={`rounded-lg border p-3 ${fingerprint ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-sm font-bold text-slate-900">Fingerprint</p>
              <p className="text-sm text-slate-600">{fingerprint ? "Enrolled" : "Not enrolled"}</p>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Face enrollment can be captured on web with a camera. Fingerprint enrollment remains device-specific.</p>
          <div className="mt-3 grid gap-2">
            <Link to={`/students/register-face?studentId=${student.id}`} className="enterprise-button-primary">
              {face ? "Update Face" : "Register Face"}
            </Link>
            <Link to={`/students/enroll-biometric?id=${student.id}`} className="enterprise-button-secondary">
              Fingerprint instructions
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

