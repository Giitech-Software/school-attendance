import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStudent } from "../services/students";
import { listClasses, type ClassRecord } from "../services/classes";

function classValue(cls: ClassRecord) {
  return cls.classId ?? cls.id ?? "";
}

export default function StudentsCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  useEffect(() => {
    let active = true;

    listClasses()
      .then((items) => {
        if (active) setClasses(items);
      })
      .catch((err) => {
        console.error(err);
        alert("Unable to load classes.");
      })
      .finally(() => {
        if (active) setClassesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      alert("Name is required");
      return;
    }

    setSaving(true);

    try {
      await createStudent({
        name: name.trim(),
        classId: classId.trim() || undefined,
        studentId: studentId.trim() || undefined,
        rollNo: rollNo.trim() || undefined,
      });
      navigate("/students");
    } catch (err: any) {
      alert(err?.message ?? "Unable to create student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/students" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to students">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">New Student</h1>
            <p className="mt-1 text-xs text-white/70">Create a student profile for class assignment and attendance tracking.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="enterprise-panel p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="auth-label">Full name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required className="enterprise-input mt-1.5" placeholder="e.g. Adwoa Aggrey" />
          </label>

          <label className="block">
            <span className="auth-label">Class</span>
            {classesLoading ? (
              <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Loading classes...</p>
            ) : classes.length > 0 ? (
              <select value={classId} onChange={(event) => setClassId(event.target.value)} className="enterprise-input mt-1.5">
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={classValue(item)}>
                    {item.name} {item.classId ? `(${item.classId})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input value={classId} onChange={(event) => setClassId(event.target.value)} className="enterprise-input mt-1.5" placeholder="e.g. Grade 1A" />
            )}
          </label>

          <label className="block">
            <span className="auth-label">Student ID</span>
            <input value={studentId} onChange={(event) => setStudentId(event.target.value)} className="enterprise-input mt-1.5" placeholder="e.g. STU-045 (leave empty to auto-generate)" />
          </label>

          <label className="block">
            <span className="auth-label">Roll no (optional)</span>
            <input value={rollNo} onChange={(event) => setRollNo(event.target.value)} className="enterprise-input mt-1.5" placeholder="e.g. 12" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" disabled={saving} className="enterprise-button-primary">
            {saving ? "Creating..." : "Create student"}
          </button>
          <button type="button" onClick={() => navigate("/students")} className="enterprise-button-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

