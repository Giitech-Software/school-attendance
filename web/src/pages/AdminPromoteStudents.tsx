import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listClasses, type SchoolClass } from "../services/classes";
import { listStudents, updateStudent, type Student } from "../services/students";

function classLabel(cls: SchoolClass | undefined) {
  return cls?.name ?? "Unknown class";
}

function classValue(cls: SchoolClass | undefined) {
  return cls?.classId ?? cls?.id ?? "";
}

function studentLabel(student: Student) {
  return student.name ?? student.studentId ?? student.id;
}

export default function AdminPromoteStudents() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sourceClassId, setSourceClassId] = useState<string>("");
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [classRows, studentRows] = await Promise.all([
          listClasses().catch(() => []),
          listStudents().catch(() => []),
        ]);
        if (!active) return;
        setClasses(classRows);
        setStudents(studentRows);

        if (classRows.length > 0) {
          setSourceClassId(classValue(classRows[0]));
          setTargetClassId(classValue(classRows[1] ?? classRows[0]));
        }
      } catch (err) {
        console.error("load promotion data", err);
        if (active) setError("Unable to load classes or students.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const sourceClass = useMemo(
    () => classes.find((cls) => cls.id === sourceClassId || cls.classId === sourceClassId),
    [classes, sourceClassId]
  );

  const targetClass = useMemo(
    () => classes.find((cls) => cls.id === targetClassId || cls.classId === targetClassId),
    [classes, targetClassId]
  );

  const sourceStudents = useMemo(
    () =>
      students
        .filter(
          (student) =>
            student.isActive !== false &&
            (student.classId === sourceClassId || student.classDocId === sourceClass?.id)
        )
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [students, sourceClass?.id, sourceClassId]
  );

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sourceStudents;
    return sourceStudents.filter((student) =>
      (student.name ?? "").toLowerCase().includes(query) ||
      student.rollNo?.toLowerCase().includes(query) ||
      student.studentId?.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query)
    );
  }, [search, sourceStudents]);

  useEffect(() => {
    setSelectedStudentIds(new Set(sourceStudents.map((student) => student.id)));
  }, [sourceStudents]);

  async function promoteSelected() {
    if (!sourceClass || !targetClass) {
      setError("Choose both a source class and a destination class.");
      return;
    }

    if (sourceClass.id === targetClass.id) {
      setError("Choose different classes for promotion.");
      return;
    }

    const selected = sourceStudents.filter((student) => selectedStudentIds.has(student.id));
    if (selected.length === 0) {
      setError("Select at least one student to promote.");
      return;
    }

    if (!window.confirm(`Move ${selected.length} student(s) from ${sourceClass.name} to ${targetClass.name}?`)) {
      return;
    }

    setError(null);
    setStatus(null);
    setSaving(true);

    const promotedIds = new Set<string>();
    const failures: string[] = [];

    for (const student of selected) {
      try {
        await updateStudent(student.id, {
          classId: targetClass.classId ?? targetClass.id,
          classDocId: targetClass.id,
          isActive: true,
        });
        promotedIds.add(student.id);
      } catch (err) {
        failures.push(student.name ?? student.studentId ?? student.id);
      }
    }

    setStudents((current) =>
      current.map((student) =>
        promotedIds.has(student.id)
          ? { ...student, classId: targetClass.classId ?? targetClass.id, classDocId: targetClass.id, isActive: true }
          : student
      )
    );

    setSaving(false);

    if (failures.length > 0) {
      setError(`Some promotions failed: ${failures.slice(0, 5).join(", ")}`);
    } else {
      setStatus(`Promoted ${selected.length} student(s) to ${targetClass.name}.`);
    }
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/admin" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to admin">
                Back
              </Link>
              <h1 className="truncate text-xl font-extrabold">Promote Students</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Move students from one class to another while preserving attendance history.</p>
          </div>
          <button type="button" onClick={promoteSelected} disabled={saving || selectedStudentIds.size === 0 || !targetClassId || !sourceClassId} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {saving ? "Promoting..." : "Promote selected"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Source students", sourceStudents.length],
          ["Selected", selectedStudentIds.size],
          ["Filtered", filteredStudents.length],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="auth-label">From class</span>
            <select value={sourceClassId} onChange={(event) => setSourceClassId(event.target.value)} className="enterprise-input mt-1.5">
              {classes.map((cls) => (
                <option key={cls.id} value={classValue(cls)}>
                  {cls.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="auth-label">To class</span>
            <select value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)} className="enterprise-input mt-1.5">
              {classes.map((cls) => (
                <option key={cls.id} value={classValue(cls)} disabled={classValue(cls) === sourceClassId}>
                  {cls.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="font-semibold text-slate-950">
            {classLabel(sourceClass)} to {classLabel(targetClass)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {selectedStudentIds.size} of {sourceStudents.length} active student(s) selected.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <label className="block">
            <span className="auth-label">Search students</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, roll number, or ID" className="enterprise-input mt-1.5" />
          </label>
          <button type="button" onClick={() => setSelectedStudentIds(new Set(sourceStudents.map((student) => student.id)))} className="enterprise-button-secondary">
            Select all
          </button>
          <button type="button" onClick={() => setSelectedStudentIds(new Set())} className="enterprise-button-secondary">
            Clear
          </button>
        </div>

        {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {status ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status}</div> : null}
      </section>

      <section className="enterprise-panel p-3">
        {filteredStudents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
            No students found in the selected source class.
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredStudents.map((student) => {
              const selected = selectedStudentIds.has(student.id);
              return (
                <button
                  type="button"
                  key={student.id}
                  onClick={() => {
                    setSelectedStudentIds((current) => {
                      const next = new Set(current);
                      if (next.has(student.id)) next.delete(student.id);
                      else next.add(student.id);
                      return next;
                    });
                  }}
                  className={`rounded-lg border p-3 text-left transition ${selected ? "border-primary bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-primary"}`}
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">{studentLabel(student)}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                        <span className="rounded bg-white px-2 py-1">Roll: {student.rollNo ?? "N/A"}</span>
                        <span className="rounded bg-white px-2 py-1">ID: {student.studentId ?? student.id}</span>
                      </div>
                    </div>
                    <span className={`rounded px-2.5 py-1 text-xs font-bold ${selected ? "bg-primary text-white" : "bg-white text-slate-600"}`}>
                      {selected ? "Selected" : "Select"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

