import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteClass, listClasses, type SchoolClass } from "../services/classes";

export default function AdminClasses() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadClasses() {
    setLoading(true);
    try {
      setClasses(await listClasses());
    } catch (err) {
      console.error(err);
      alert("Unable to load classes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  const assignedStaffLinks = useMemo(() => classes.reduce((sum, item) => sum + (item.assignedStaffUids?.length ?? 0), 0), [classes]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete class. Are you sure?")) return;
    setDeleting(id);
    try {
      await deleteClass(id);
      setClasses((current) => current.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(err?.message ?? "Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold">Classes</h1>
            <p className="mt-1 text-xs text-white/70">Manage class groups, assigned staff, and student assignment readiness.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadClasses} disabled={loading} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link to="/admin/classes/create" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
              Add
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total classes", classes.length],
          ["Assigned staff", assignedStaffLinks],
          ["Status", loading ? "Loading" : "Ready"],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-3">
        {loading ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading classes...</p>
        ) : classes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="font-semibold text-slate-800">No classes yet.</p>
            <p className="mt-1 text-sm text-slate-500">Create the first class to begin assigning students and attendance staff.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {classes.map((cls) => (
              <div key={cls.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <Link to={`/admin/classes/${cls.id}`} className="text-base font-extrabold text-slate-950 hover:text-primary">
                      {cls.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded bg-white px-2 py-1">ID: {cls.classId ?? cls.id}</span>
                      <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Assigned staff: {cls.assignedStaffUids?.length ?? 0}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{cls.description ?? "No description added."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link to={`/admin/classes/${cls.id}`} className="enterprise-button-secondary">
                      Assign students
                    </Link>
                    <Link to={`/admin/classes/edit/${cls.id}`} className="enterprise-button-primary">
                      Edit
                    </Link>
                    <button type="button" onClick={() => handleDelete(cls.id)} disabled={deleting === cls.id} className="enterprise-button-danger">
                      {deleting === cls.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

