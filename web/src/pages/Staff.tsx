import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteStaff, listStaff, type Staff } from "../services/staff";

function enrollmentTone(staff: Staff) {
  const face = Boolean(staff.faceId || staff.faceEnrolled);
  const fingerprint = Boolean(staff.fingerprintId);
  if (face && fingerprint) return "border-emerald-300 bg-emerald-50";
  if (face || fingerprint) return "border-amber-300 bg-amber-50";
  return "border-red-200 bg-red-50";
}

function enrollmentLabel(staff: Staff) {
  const face = Boolean(staff.faceId || staff.faceEnrolled);
  const fingerprint = Boolean(staff.fingerprintId);
  if (face && fingerprint) return "Face + fingerprint enrolled";
  if (face) return "Face enrolled";
  if (fingerprint) return "Fingerprint enrolled";
  return "Enrollment missing";
}

export default function Staff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadStaff() {
    setLoading(true);
    try {
      setStaff(await listStaff());
    } catch (err) {
      console.error(err);
      alert("Unable to load staff members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((item) => [item.name, item.staffId, item.email, item.roleType, item.role].some((value) => (value ?? "").toLowerCase().includes(q)));
  }, [search, staff]);

  const counts = useMemo(() => {
    return staff.reduce(
      (acc, item) => {
        acc.total += 1;
        const face = Boolean(item.faceId || item.faceEnrolled);
        const fingerprint = Boolean(item.fingerprintId);
        if (face) acc.face += 1;
        if (fingerprint) acc.fingerprint += 1;
        if (face && fingerprint) acc.complete += 1;
        return acc;
      },
      { total: 0, face: 0, fingerprint: 0, complete: 0 }
    );
  }, [staff]);

  async function handleDelete(item: Staff) {
    if (!item.id) return;
    if (!window.confirm(`Are you sure you want to delete "${item.name ?? "this staff"}"?`)) return;

    setDeletingId(item.id);
    try {
      await deleteStaff(item.id);
      setStaff((current) => current.filter((row) => row.id !== item.id));
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
              <h1 className="text-xl font-extrabold">Staff ({search ? `${filteredStaff.length} of ${staff.length}` : staff.length})</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Manage staff profiles, login links, and enrollment status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/staff/bulk-import" className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600">
              Import
            </Link>
            <Link to="/staff/create" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
              Add
            </Link>
            <Link to="/attendance/staff-qr-generator" className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Staff QRs
            </Link>
          </div>
        </div>

        <div className="grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="auth-label">Search staff</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff..." className="enterprise-input mt-1.5" />
          </label>
          <button type="button" onClick={loadStaff} disabled={loading} className="enterprise-button-secondary">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", counts.total],
          ["Face", counts.face],
          ["Fingerprint", counts.fingerprint],
          ["Complete", counts.complete],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-3">
        {loading ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading staff...</p>
        ) : filteredStaff.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">No staff found.</p>
        ) : (
          <div className="grid gap-2">
            {filteredStaff.map((item) => {
              const face = Boolean(item.faceId || item.faceEnrolled);
              const fingerprint = Boolean(item.fingerprintId);
              return (
                <div key={item.id} className={`rounded-lg border p-3 ${enrollmentTone(item)}`}>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <Link to={`/staff/${item.id}`} className="truncate text-base font-bold text-slate-950 hover:text-primary">
                        {item.name ?? "Staff member"}
                      </Link>
                      <div className="mt-1 grid gap-1 text-sm text-slate-600 md:grid-cols-3">
                        <p>ID: {item.staffId ?? item.id}</p>
                        <p className="truncate">{item.email ?? "No email"}</p>
                        <p>{item.roleType ?? item.role ?? "staff"}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className={face ? "text-emerald-700" : "text-slate-500"}>Face: {face ? "Enrolled" : "Not enrolled"}</span>
                        <span className={fingerprint ? "text-blue-700" : "text-slate-500"}>Fingerprint: {fingerprint ? "Enrolled" : "Not enrolled"}</span>
                        <span className="text-slate-600">{enrollmentLabel(item)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link to={`/staff/${item.id}`} className="enterprise-button-secondary">
                        Edit
                      </Link>
                      <Link to={`/reports/staff/${item.id}`} className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
                        Report
                      </Link>
                      <button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.id} className="enterprise-button-danger">
                        {deletingId === item.id ? "Deleting..." : "Delete"}
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

