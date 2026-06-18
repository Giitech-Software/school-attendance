import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createStudent, listStudents } from "../services/students";
import { listClasses, type ClassRecord } from "../services/classes";

const SAMPLE = `name,classId,studentId,rollNo
Adwoa Mensah,grade-1a,STU-045,12
Kwame Boateng,grade-1a,,13`;

type ParsedCsvRow = Record<string, string>;

type StudentImportRow = {
  name: string;
  classId?: string;
  className?: string;
  classDocId?: string;
  studentId?: string;
  rollNo?: string;
  isActive?: boolean;
};

type ResolvedStudentImportRow = StudentImportRow & {
  resolvedClass?: ClassRecord;
  resolvedClassId?: string;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}

function parseCsvRows(input: string): ParsedCsvRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<ParsedCsvRow>((row, header, index) => {
      row[header] = cells[index]?.trim() ?? "";
      return row;
    }, {});
  });
}

function pickCsvValue(row: ParsedCsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value.trim();
  }
  return "";
}

function normalizeKey(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeBoolean(value?: string) {
  const normalized = normalizeKey(value);
  if (!normalized) return undefined;
  if (["true", "yes", "y", "1", "active"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "inactive"].includes(normalized)) return false;
  return undefined;
}

function getRows(csvText: string): StudentImportRow[] {
  return parseCsvRows(csvText)
    .map((row) => ({
      name: pickCsvValue(row, ["name", "fullName", "studentName"]),
      classId: pickCsvValue(row, ["classId", "classCode"]) || undefined,
      className: pickCsvValue(row, ["className", "class"]) || undefined,
      classDocId: pickCsvValue(row, ["classDocId", "classDocumentId"]) || undefined,
      studentId: pickCsvValue(row, ["studentId", "studentCode", "id"]) || undefined,
      rollNo: pickCsvValue(row, ["rollNo", "roll", "rollNumber"]) || undefined,
      isActive: normalizeBoolean(pickCsvValue(row, ["isActive", "active", "status"])),
    }))
    .filter((row) => row.name || row.classId || row.className || row.classDocId || row.studentId || row.rollNo);
}

function resolveClass(row: StudentImportRow, classes: ClassRecord[]) {
  const classDocId = normalizeKey(row.classDocId);
  const classId = normalizeKey(row.classId);
  const className = normalizeKey(row.className);

  return classes.find(
    (cls) => normalizeKey(cls.id) === classDocId || normalizeKey(cls.classId) === classId || normalizeKey(cls.name) === className
  );
}

function resolveRows(rows: StudentImportRow[], classes: ClassRecord[]): ResolvedStudentImportRow[] {
  return rows.map((row) => {
    const resolvedClass = resolveClass(row, classes);
    return {
      ...row,
      resolvedClass,
      resolvedClassId: resolvedClass?.classId ?? row.classId?.trim(),
    };
  });
}

export default function StudentsBulkImport() {
  const [csvText, setCsvText] = useState(SAMPLE);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const rows = useMemo(() => getRows(csvText), [csvText]);
  const resolvedRows = useMemo(() => resolveRows(rows, classes), [classes, rows]);
  const validRows = resolvedRows.filter((row) => row.name.trim());

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await listClasses();
        if (active) setClasses(data);
      } catch (error) {
        console.error("listClasses error", error);
        setErrors(["Student import can still run, but class validation is limited because classes could not be loaded."]);
      } finally {
        if (active) setLoadingClasses(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleImport() {
    if (validRows.length === 0) {
      setErrors(["Add at least one row with a student name."]);
      return;
    }

    setImporting(true);
    setResult(null);
    setErrors([]);

    const existing = await listStudents().catch(() => []);
    const existingStudentIds = new Set(existing.map((student) => normalizeKey(student.studentId)).filter(Boolean));
    const existingRollKeys = new Set(
      existing
        .map((student) => (student.rollNo && student.classId ? `${normalizeKey(student.classId)}:${normalizeKey(student.rollNo)}` : ""))
        .filter(Boolean)
    );
    const seenStudentIds = new Set<string>();
    const seenRollKeys = new Set<string>();
    const nextErrors: string[] = [];
    let created = 0;

    try {
      for (let index = 0; index < validRows.length; index += 1) {
        const row = validRows[index];
        const line = index + 2;
        const studentId = row.studentId?.trim();
        const studentIdKey = normalizeKey(studentId);
        const classValue = row.resolvedClassId?.trim();
        const rollNo = row.rollNo?.trim();
        const hasClassReference = Boolean(row.classId || row.className || row.classDocId);
        const classReferenceNotResolved = hasClassReference && (!classValue || (classes.length > 0 && !row.resolvedClass));

        if (classReferenceNotResolved) {
          nextErrors.push(`Line ${line}: class not found (${row.classId ?? row.className ?? row.classDocId})`);
          continue;
        }

        if (studentId) {
          if (existingStudentIds.has(studentIdKey) || seenStudentIds.has(studentIdKey)) {
            nextErrors.push(`Line ${line}: duplicate Student ID ${studentId}`);
            continue;
          }
          seenStudentIds.add(studentIdKey);
        }

        const rollKey = classValue && rollNo ? `${normalizeKey(classValue)}:${normalizeKey(rollNo)}` : "";
        if (rollKey) {
          if (existingRollKeys.has(rollKey) || seenRollKeys.has(rollKey)) {
            nextErrors.push(`Line ${line}: duplicate roll no ${rollNo} in ${classValue}`);
            continue;
          }
          seenRollKeys.add(rollKey);
        }

        try {
          const student = await createStudent({
            name: row.name.trim(),
            classId: classValue || undefined,
            studentId: studentId || undefined,
            rollNo: rollNo || undefined,
            isActive: row.isActive,
          });

          if (student.studentId) existingStudentIds.add(normalizeKey(student.studentId));
          if (student.rollNo && student.classId) existingRollKeys.add(`${normalizeKey(student.classId)}:${normalizeKey(student.rollNo)}`);
          created += 1;
        } catch (error) {
          nextErrors.push(`Line ${line}: ${error instanceof Error ? error.message : "could not create student"}`);
        }
      }

      setErrors(nextErrors);
      setResult(`Created ${created} student${created === 1 ? "" : "s"}${nextErrors.length ? `; ${nextErrors.length} skipped.` : "."}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link to="/students" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to students">
              Back
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">Bulk Import Students</h1>
              <p className="mt-1 text-xs text-white/70">Paste CSV with headers: name, classId, studentId, rollNo. Student ID is optional.</p>
            </div>
          </div>
          <button type="button" onClick={() => setCsvText(SAMPLE)} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
            Load sample
          </button>
        </div>
      </section>

      {result ? <div className="status-success">{result}</div> : null}
      {errors.length ? <div className="status-error">{errors.slice(0, 6).join("\n")}</div> : null}

      <section className="grid gap-3 xl:grid-cols-[1fr_24rem]">
        <div className="enterprise-panel p-4">
          <label className="block">
            <span className="auth-label">Student CSV</span>
            <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} className="mt-1.5 min-h-[20rem] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-900/10" spellCheck={false} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={handleImport} disabled={importing || validRows.length === 0} className="enterprise-button-primary">
              {importing ? "Importing..." : "Import Students"}
            </button>
            <Link to="/students" className="enterprise-button-secondary">
              Cancel
            </Link>
          </div>
        </div>

        <aside className="enterprise-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Preview</h2>
              <p className="mt-1 text-xs text-slate-500">Class can be matched by classId, className, or classDocId.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{validRows.length}</span>
          </div>

          {loadingClasses ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Checking classes...</p> : null}

          <div className="mt-3 space-y-2">
            {validRows.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No valid rows yet.</p>
            ) : (
              validRows.slice(0, 8).map((row, index) => {
                const hasClassReference = Boolean(row.classId || row.className || row.classDocId);
                const unresolved = hasClassReference && classes.length > 0 && !row.resolvedClass;
                return (
                  <div key={`${row.name}-${index}`} className={`rounded-lg border p-3 ${unresolved ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                    <p className="truncate text-sm font-bold text-slate-950">{index + 1}. {row.name}</p>
                    <p className="mt-1 text-xs text-slate-600">Class: {row.resolvedClassId ?? row.className ?? row.classDocId ?? "-"}</p>
                    <p className="text-xs text-slate-600">ID: {row.studentId ?? "Auto"}{row.rollNo ? ` | Roll ${row.rollNo}` : ""}</p>
                    {unresolved ? <p className="mt-1 text-xs font-semibold text-amber-700">Class not found</p> : null}
                  </div>
                );
              })
            )}
            {validRows.length > 8 ? <p className="text-xs text-slate-500">And {validRows.length - 8} more...</p> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}

