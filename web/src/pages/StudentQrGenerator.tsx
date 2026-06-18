import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getStudentById, listStudents } from "../services/students";
import type { Student } from "../types";

type QrPayload = {
  userId: string;
  role: "student";
  classId?: string;
  ts: number;
  sig: string;
};

async function sha256(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function generateQrPayload(userId: string, role: "student", classId?: string): Promise<QrPayload> {
  const ts = Date.now();
  const base = `${userId}|${role}|${classId ?? ""}|${ts}`;
  return { userId, role, classId, ts, sig: await sha256(base) };
}

function studentLabel(student: Student) {
  return student.name ?? student.studentId ?? student.rollNo ?? student.id;
}

export default function StudentQrGenerator() {
  const { id } = useParams<{ id: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [query, setQuery] = useState("");
  const [payloadJson, setPayloadJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        if (id) {
          const student = await getStudentById(id);
          if (!active) return;
          if (!student) {
            setError("Student not found.");
            return;
          }
          setSelected(student);
          const payload = await generateQrPayload(student.studentId ?? student.id, "student", student.classId);
          if (active) setPayloadJson(JSON.stringify(payload));
        } else {
          const rows = await listStudents();
          if (active) setStudents(rows);
        }
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load students.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      [student.name, student.studentId, student.rollNo, student.classId].some((value) => (value ?? "").toLowerCase().includes(q))
    );
  }, [query, students]);

  async function openQrForStudent(student: Student) {
    setSelected(student);
    const payload = await generateQrPayload(student.studentId ?? student.id, "student", student.classId);
    setPayloadJson(JSON.stringify(payload));
    setCopied(false);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function exportClassPayloads() {
    setExporting(true);
    try {
      const rows = await Promise.all(
        filtered.map(async (student) => ({
          name: studentLabel(student),
          studentId: student.studentId ?? student.id,
          classId: student.classId ?? "",
          payload: await generateQrPayload(student.studentId ?? student.id, "student", student.classId),
        }))
      );
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student-qr-payloads.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Could not export student QR payloads.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading students...</div>;
  }

  if (error) {
    return (
      <div className="enterprise-panel p-4">
        <p className="text-sm font-semibold text-red-700">{error}</p>
        <Link to="/students" className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
          Back to students
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/students" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to students">
                Back
              </Link>
              <h1 className="truncate text-xl font-extrabold">Student QR Generator</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Generate signed QR payloads linked to student profiles.</p>
          </div>
          {!id ? (
            <button type="button" onClick={exportClassPayloads} disabled={exporting || filtered.length === 0} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
              {exporting ? "Exporting..." : "Export JSON"}
            </button>
          ) : null}
        </div>
      </section>

      {!id ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Students", students.length],
            ["Filtered", filtered.length],
            ["Selected", selected ? studentLabel(selected) : "None"],
          ].map(([label, value]) => (
            <div key={label} className="enterprise-panel p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 truncate text-2xl font-extrabold text-slate-950">{value}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-[1fr_26rem]">
        {!id ? (
          <div className="enterprise-panel p-3">
            <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <h2 className="text-base font-extrabold text-slate-950">Students</h2>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, roll, ID, or class" className="enterprise-input lg:w-96" />
            </div>
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">No students found.</div>
            ) : (
              <div className="grid gap-2">
                {filtered.map((student) => (
                  <button key={student.id} type="button" onClick={() => openQrForStudent(student)} className={`rounded-lg border p-3 text-left transition ${selected?.id === student.id ? "border-primary bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-primary"}`}>
                    <p className="font-bold text-slate-950">{studentLabel(student)}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded bg-white px-2 py-1">ID: {student.studentId ?? student.id}</span>
                      <span className="rounded bg-white px-2 py-1">Class: {student.classId ?? "Unassigned"}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <aside className="enterprise-panel p-4">
          {selected ? (
            <>
              <h2 className="text-base font-extrabold text-slate-950">{studentLabel(selected)}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded bg-slate-50 px-2 py-1">Class: {selected.classId ?? "Unassigned"}</span>
                <span className="rounded bg-slate-50 px-2 py-1">Roll No: {selected.rollNo ?? "N/A"}</span>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-700">QR payload JSON</p>
                <div className="max-h-48 overflow-auto break-all rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs">{payloadJson}</div>
                <button type="button" onClick={copyToClipboard} className="mt-3 w-full enterprise-button-secondary">
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
              </div>

              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                Use this payload with the web manual QR screen or mobile QR scanner.
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a student to generate a QR payload.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

