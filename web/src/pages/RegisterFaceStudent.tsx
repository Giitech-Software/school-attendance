import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FaceCameraCapture from "../components/FaceCameraCapture";
import { indexFace } from "../services/faceService";
import { getStudentById, updateStudent } from "../services/students";
import type { Student } from "../types";

export default function RegisterFaceStudent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get("studentId") ?? searchParams.get("id") ?? "";
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!studentId) {
      setLoading(false);
      setError("Open this page from a student profile so the face can be linked correctly.");
      return;
    }

    getStudentById(studentId)
      .then((row) => {
        if (!active) return;
        setStudent(row);
        if (!row) setError("Student not found.");
      })
      .catch((err) => {
        console.error("load student for face", err);
        if (active) setError(err?.message ?? "Could not load student.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studentId]);

  async function handleCapture(base64Image: string) {
    if (!student?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await indexFace(student.id, base64Image, "student");
      if (!result.success || !result.faceId) throw new Error(result.error ?? "No face was registered.");
      await updateStudent(student.id, {
        faceId: result.faceId,
        biometricEnabled: true,
        faceEnrolledAt: new Date().toISOString(),
      } as Partial<Student>);
      setStudent({ ...student, faceId: result.faceId, faceEnrolledAt: new Date().toISOString() } as Student);
      setSuccess(`${student.name ?? "Student"} face registered successfully.`);
    } catch (err: any) {
      console.error("register student face", err);
      setError(err?.message ?? "Could not register face.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link to={student?.id ? `/students/${student.id}` : "/students"} className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10">
              Back
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">Register Student Face</h1>
              <p className="mt-1 text-xs text-white/70">Capture a clear front-facing photo for face attendance.</p>
            </div>
          </div>
          {student ? <span className="rounded bg-white/10 px-3 py-2 text-sm font-semibold">{student.name ?? student.studentId}</span> : null}
        </div>
      </section>

      {loading ? <div className="enterprise-panel p-4 text-sm text-slate-500">Loading student...</div> : null}
      {error ? <div className="status-error">{error}</div> : null}
      {success ? <div className="status-success">{success}</div> : null}

      <section className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="enterprise-panel p-4">
          <h2 className="text-base font-extrabold text-slate-950">Camera Capture</h2>
          <p className="mt-1 text-sm text-slate-600">Use good lighting and keep only one face clearly visible in the frame.</p>
          <div className="mt-3">
            <FaceCameraCapture disabled={!student || saving} captureLabel={saving ? "Registering..." : "Capture Face"} onCapture={handleCapture} />
          </div>
        </div>

        <aside className="enterprise-panel p-4">
          <h2 className="text-base font-bold text-slate-950">Registration Notes</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="rounded-lg bg-slate-50 p-3">The image is sent to the same face registration function used by the mobile app.</p>
            <p className="rounded-lg bg-slate-50 p-3">A duplicate face may be rejected to prevent one person being registered twice.</p>
            <p className="rounded-lg bg-slate-50 p-3">Chrome requires camera permission for this site.</p>
          </div>
          {student?.id ? (
            <button type="button" onClick={() => navigate(`/students/${student.id}`)} className="enterprise-button-secondary mt-3 w-full">
              Back to student
            </button>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
