import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createStaff, listStaff, STAFF_ROLE_OPTIONS, type StaffRoleType } from "../services/staff";
import { getUserByEmail, upsertUser } from "../services/users";

const SAMPLE = `name,email,role,staffId
Ama Teacher,ama@example.com,teacher,TCH-0008
Kofi Staff,kofi@example.com,non_teaching_staff,`;

const STAFF_ROLES = new Set<string>(STAFF_ROLE_OPTIONS.map((option) => option.value));

type ParsedCsvRow = Record<string, string>;

type StaffImportRow = {
  name: string;
  email: string;
  roleType: StaffRoleType;
  staffId?: string;
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


function normalizeRole(role?: string): StaffRoleType {
  const normalized = role?.trim() || "teacher";
  return STAFF_ROLES.has(normalized) ? (normalized as StaffRoleType) : "teacher";
}

function getRows(csvText: string): StaffImportRow[] {
  return parseCsvRows(csvText)
    .map((row) => ({
      name: pickCsvValue(row, ["name", "fullName", "staffName"]),
      email: pickCsvValue(row, ["email", "emailAddress"]).toLowerCase(),
      roleType: normalizeRole(pickCsvValue(row, ["role", "roleType", "staffRole"])),
      staffId: pickCsvValue(row, ["staffId", "staffCode", "id"]) || undefined,
    }))
    .filter((row) => row.name || row.email || row.staffId);
}

export default function StaffBulkImport() {
  const [csvText, setCsvText] = useState(SAMPLE);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const rows = useMemo(() => getRows(csvText), [csvText]);
  const validRows = rows.filter((row) => row.name.trim() && row.email.trim());

  async function handleImport() {
    if (validRows.length === 0) {
      setErrors(["Each staff row needs a name and email."]);
      return;
    }

    setImporting(true);
    setResult(null);
    setErrors([]);

    const existing = await listStaff().catch(() => []);
    const existingEmails = new Set(existing.map((staff) => staff.email?.toLowerCase()).filter(Boolean));
    const existingStaffIds = new Set(existing.map((staff) => staff.staffId).filter(Boolean));
    const seenEmails = new Set<string>();
    const seenStaffIds = new Set<string>();
    const nextErrors: string[] = [];
    let created = 0;

    try {
      for (let index = 0; index < validRows.length; index += 1) {
        const row = validRows[index];
        const line = index + 2;
        const email = row.email.trim().toLowerCase();
        const staffId = row.staffId?.trim().toUpperCase();

        if (existingEmails.has(email) || seenEmails.has(email)) {
          nextErrors.push(`Line ${line}: duplicate email ${email}`);
          continue;
        }

        if (staffId && (existingStaffIds.has(staffId) || seenStaffIds.has(staffId))) {
          nextErrors.push(`Line ${line}: duplicate Staff ID ${staffId}`);
          continue;
        }

        seenEmails.add(email);
        if (staffId) seenStaffIds.add(staffId);

        try {
          const linkedUser = await getUserByEmail(email);
          const staff = await createStaff({
            name: row.name.trim(),
            email,
            staffId: staffId || undefined,
            role: row.roleType,
            roleType: row.roleType,
            userUid: linkedUser?.id,
          });

          if (linkedUser?.id) {
            await upsertUser({
              uid: linkedUser.uid ?? linkedUser.id,
              id: linkedUser.id,
              approved: true,
              ...(linkedUser.role === "admin" ? {} : { role: row.roleType }),
            });
          }

          if (staff.staffId) existingStaffIds.add(staff.staffId);
          existingEmails.add(email);
          created += 1;
        } catch (error) {
          nextErrors.push(`Line ${line}: ${error instanceof Error ? error.message : "could not create staff"}`);
        }
      }

      setErrors(nextErrors);
      setResult(`Created ${created} staff profile${created === 1 ? "" : "s"}${nextErrors.length ? `; ${nextErrors.length} skipped.` : "."}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link to="/staff" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to staff">
              Back
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">Bulk Import Staff</h1>
              <p className="mt-1 text-xs text-white/70">Paste CSV with headers: name, email, role, staffId. Staff ID is optional.</p>
            </div>
          </div>
          <button type="button" onClick={() => setCsvText(SAMPLE)} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
            Load sample
          </button>
        </div>
      </section>

      {result ? <div className="status-success">{result}</div> : null}
      {errors.length ? <div className="status-error whitespace-pre-line">{errors.slice(0, 6).join("\n")}</div> : null}

      <section className="grid gap-3 xl:grid-cols-[1fr_24rem]">
        <div className="enterprise-panel p-4">
          <label className="block">
            <span className="auth-label">Staff CSV</span>
            <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} className="mt-1.5 min-h-[20rem] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-blue-900/10" spellCheck={false} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={handleImport} disabled={importing || validRows.length === 0} className="enterprise-button-primary">
              {importing ? "Importing..." : "Import Staff"}
            </button>
            <Link to="/staff" className="enterprise-button-secondary">
              Cancel
            </Link>
          </div>
        </div>

        <aside className="enterprise-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Preview</h2>
              <p className="mt-1 text-xs text-slate-500">Roles: teacher, non_teaching_staff, staff, general_staff.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{validRows.length}</span>
          </div>

          <div className="mt-3 space-y-2">
            {validRows.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No valid rows yet.</p>
            ) : (
              validRows.slice(0, 8).map((row, index) => (
                <div key={`${row.email}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="truncate text-sm font-bold text-slate-950">{index + 1}. {row.name}</p>
                  <p className="truncate text-xs text-slate-600">{row.email}</p>
                  <p className="text-xs text-slate-600">Role: {row.roleType}</p>
                  <p className="text-xs text-slate-600">ID: {row.staffId ?? "Auto"}</p>
                </div>
              ))
            )}
            {validRows.length > 8 ? <p className="text-xs text-slate-500">And {validRows.length - 8} more...</p> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}


