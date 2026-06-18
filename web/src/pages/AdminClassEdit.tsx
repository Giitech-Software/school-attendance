import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getClassById, upsertClass, type SchoolClass } from "../services/classes";
import { listStaff, type Staff } from "../services/staff";

export default function AdminClassEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<SchoolClass | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedStaffUids, setAssignedStaffUids] = useState<string[]>([]);
  const [staffOptions, setStaffOptions] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getClassById(id)
      .then((data) => {
        if (data) {
          setItem(data);
          setName(data.name ?? "");
          setDescription(data.description ?? "");
          setAssignedStaffUids(data.assignedStaffUids ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    let active = true;
    listStaff()
      .then((rows) => {
        if (active) setStaffOptions(rows.filter((staff) => Boolean(staff.userUid)));
      })
      .catch((err) => console.warn("Failed to load staff options", err));
    return () => {
      active = false;
    };
  }, []);

  function toggleAssignedStaff(uid?: string) {
    if (!uid) return;
    setAssignedStaffUids((current) =>
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    if (!name.trim()) {
      alert("Name is required.");
      return;
    }
    setSaving(true);

    try {
      await upsertClass({
        ...item,
        name: name.trim(),
        description: description.trim() || undefined,
        assignedStaffUids,
      });
      navigate("/admin/classes");
    } catch (err: any) {
      alert(err?.message ?? "Unable to update class.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/admin/classes" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to classes">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">Edit class</h1>
            <p className="mt-1 text-xs text-white/70">Update class details and staff permissions for attendance capture.</p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="enterprise-panel p-4 text-sm text-slate-500">Loading class...</div>
      ) : !item ? (
        <div className="enterprise-panel p-4 text-sm text-slate-500">Class not found.</div>
      ) : (
        <form onSubmit={handleSubmit} className="enterprise-panel p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_0.85fr]">
            <div className="grid gap-3">
              <label className="block">
                <span className="auth-label">Class name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required className="enterprise-input mt-1.5" />
              </label>

              <label className="block">
                <span className="auth-label">Description (optional)</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="enterprise-input mt-1.5 min-h-24" />
              </label>
            </div>

            <div className="admin-field-card">
              <div className="flex items-center justify-between gap-3">
                <p className="auth-label">Attendance staff</p>
                <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{assignedStaffUids.length} selected</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {staffOptions.length === 0 ? (
                  <p className="text-sm text-slate-500">No linked staff profiles found.</p>
                ) : (
                  staffOptions.map((staff) => {
                    const selected = Boolean(staff.userUid && assignedStaffUids.includes(staff.userUid));
                    return (
                      <button key={staff.id ?? staff.userUid} type="button" onClick={() => toggleAssignedStaff(staff.userUid)} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selected ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                        {staff.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button type="submit" disabled={saving} className="enterprise-button-primary">
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button type="button" onClick={() => navigate("/admin/classes")} className="enterprise-button-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

