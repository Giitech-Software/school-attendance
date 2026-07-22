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

function qrImageUrl(value: string, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=H&margin=12&data=${encodeURIComponent(value)}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function StudentQrGenerator() {
  const { id } = useParams<{ id: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [query, setQuery] = useState("");
  const [payloadJson, setPayloadJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  }

  async function printStudentCards(studentsToPrint: Student[]) {
    if (studentsToPrint.length === 0) return;
    setExporting(true);
    try {
      const cards = await Promise.all(studentsToPrint.map(async (student) => {
        const payload = JSON.stringify(await generateQrPayload(student.studentId ?? student.id, "student", student.classId));
        const name = escapeHtml(studentLabel(student));
        const studentId = escapeHtml(student.studentId ?? student.id);
        const classId = escapeHtml(student.classId ?? "Unassigned");
        return `
          <article class="card">
            <div class="brand">ASTEM Attendance Register</div>
            <img src="${qrImageUrl(payload, 240)}" alt="Student QR for ${name}" />
            <h2>${name}</h2>
            <div class="meta">Student ID: ${studentId}</div>
            <div class="meta">Class: ${classId}</div>
            <div class="footer">Student Attendance QR</div>
          </article>`;
      }));
      const win = window.open("", "_blank");
      if (!win) throw new Error("Popup blocked. Allow popups and try again.");
      win.opener = null;
      win.document.open();
      win.document.write(`<!doctype html><html><head><title>Student QR Cards</title><style>
        @page { size: A4; margin: 12mm; } * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
        .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .card { break-inside: avoid; min-height: 335px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; text-align: center; }
        .brand { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #1e3a8a; }
        img { display: block; width: 180px; height: 180px; margin: 14px auto 10px; }
        h2 { margin: 0 0 7px; font-size: 16px; line-height: 1.2; }
        .meta { margin-top: 4px; font-size: 12px; font-weight: 700; color: #475569; }
        .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 9px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
      </style></head><body><main class="sheet">${cards.join("")}</main><script>
        window.addEventListener('load', async () => { await Promise.all(Array.from(document.images).map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; }))); setTimeout(() => window.print(), 250); });
      </script></body></html>`);
      win.document.close();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Could not prepare student QR cards.");
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
            <p className="mt-1 text-xs text-white/70">Generate secure, printable student attendance QR cards.</p>
          </div>
          {!id ? (
            <button type="button" onClick={() => printStudentCards(filtered)} disabled={exporting || filtered.length === 0} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
              {exporting ? "Preparing..." : "Print / PDF"}
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

              <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 text-center shadow-sm">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">ASTEM Attendance Register</p>
                <img src={qrImageUrl(payloadJson)} alt={`Student QR for ${studentLabel(selected)}`} className="mx-auto mt-4 h-64 w-64 rounded-xl border-4 border-blue-50 bg-white p-3" />
                <p className="mt-4 text-sm font-bold text-slate-600">Student ID: {selected.studentId ?? selected.id}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">Class: {selected.classId ?? "Unassigned"}</p>
                <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Student Attendance QR</p>
              </div>

              <button type="button" onClick={() => printStudentCards([selected])} disabled={exporting} className="mt-3 w-full enterprise-button-primary">
                Print selected card
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a student to generate a QR payload.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

