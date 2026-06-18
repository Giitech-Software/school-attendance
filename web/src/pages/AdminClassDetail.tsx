import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getClassById, listClasses, type SchoolClass } from "../services/classes";
import { listStudents, upsertStudent, type Student } from "../services/students";

export default function AdminClassDetail() {
  const { id } = useParams<{ id: string }>();
  const [cls, setCls] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [classDoc, studentRows, allClasses] = await Promise.all([getClassById(id), listStudents(), listClasses()]);
      setCls(classDoc);
      setStudents(studentRows);
      const map: Record<string, string> = {};
      allClasses.forEach((item) => {
        map[item.id] = item.name;
      });
      setClassMap(map);
    } catch (err: any) {
      alert(err?.message ?? "Failed to load class details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function getClassName(classDocId?: string) {
    if (!classDocId) return "another class";
    return classMap[classDocId] ?? "another class";
  }

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((student) => student.isActive !== false)
      .filter((student) => {
        if (!q) return true;
        return [student.name, student.studentId, student.rollNo].some((value) => (value ?? "").toLowerCase().includes(q));
      });
  }, [search, students]);

  const assignedHereCount = useMemo(() => students.filter((student) => student.classDocId === cls?.id || student.classId === cls?.classId).length, [students, cls]);
  const availableCount = useMemo(() => students.filter((student) => student.isActive !== false && !student.classDocId).length, [students]);

  async function forceAssign(student: Student, unassign = false) {
    if (!cls?.id) return;
    setSavingId(student.id);
    try {
      await upsertStudent({
        id: student.id,
        classDocId: unassign ? undefined : cls.id,
        classId: unassign ? undefined : cls.classId,
        isActive: unassign ? false : true,
      });

      setStudents((current) =>
        current.map((item) =>
          item.id === student.id
            ? {
                ...item,
                classDocId: unassign ? undefined : cls.id,
                classId: unassign ? undefined : cls.classId,
                isActive: unassign ? false : true,
              }
            : item
        )
      );
    } catch (err: any) {
      alert(err?.message ?? "Assignment failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleAssign(student: Student) {
    if (!cls?.id) return;
    const assignedHere = student.classDocId === cls.id || student.classId === cls.classId;
    const assignedElsewhere = student.classDocId && student.classDocId !== cls.id;

    if (assignedElsewhere) {
      const otherClassName = getClassName(student.classDocId);
      if (!window.confirm(`${student.name ?? "Student"} is already assigned to "${otherClassName}". Move them to "${cls.name}"?`)) return;
      await forceAssign(student);
      return;
    }

    await forceAssign(student, assignedHere);
  }

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading class details...</div>;
  }

  if (!cls) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Class not found.</div>;
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/admin/classes" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to classes">
                Back
              </Link>
              <h1 className="truncate text-xl font-extrabold">Class: {cls.name}</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Class ID: {cls.classId ?? cls.id}</p>
          </div>
          <Link to={`/admin/classes/edit/${cls.id}`} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            Edit class
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Assigned students", assignedHereCount],
          ["Available students", availableCount],
          ["Attendance staff", cls.assignedStaffUids?.length ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Assign students</h2>
            <p className="mt-1 text-sm text-slate-500">{cls.description ?? "Move students into this class for attendance reporting."}</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search students..."
            className="enterprise-input lg:w-80"
          />
        </div>

        <div className="mt-3 grid gap-2">
          {filteredStudents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <p className="font-semibold text-slate-800">No students yet.</p>
              <p className="mt-1 text-sm text-slate-500">Create or import students, then assign them to this class.</p>
            </div>
          ) : (
            filteredStudents.map((student) => {
              const assignedHere = student.classDocId === cls.id || student.classId === cls.classId;
              const assignedElsewhere = student.classDocId && student.classDocId !== cls.id;
              return (
                <div key={student.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">
                        {student.name ?? "Student"} {student.studentId ? `(${student.studentId})` : student.rollNo ? `(${student.rollNo})` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                        {assignedHere ? <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Assigned to this class</span> : null}
                        {assignedElsewhere ? <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Assigned to {getClassName(student.classDocId)}</span> : null}
                        {!assignedHere && !assignedElsewhere ? <span className="rounded bg-white px-2 py-1 text-slate-600">Unassigned</span> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAssign(student)}
                      disabled={savingId === student.id}
                      className={`${assignedHere ? "enterprise-button-primary" : assignedElsewhere ? "inline-flex items-center justify-center rounded-md bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-200 disabled:opacity-60" : "enterprise-button-secondary"}`}
                    >
                      {savingId === student.id ? "Saving..." : assignedHere ? "Assigned" : assignedElsewhere ? "Move" : "Assign"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

