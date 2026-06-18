import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClass } from "../services/classes";
import { listStaff, type Staff } from "../services/staff";

export default function AdminClassCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedStaffUids, setAssignedStaffUids] = useState<string[]>([]);
  const [staffOptions, setStaffOptions] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);

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

  function makeClassId(value: string) {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .substring(0, 30) || `class-${Date.now()}`
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      alert("Name is required.");
      return;
    }

    setSaving(true);

    try {
      const trimmed = name.trim();
      await createClass({
        name: trimmed,
        classId: makeClassId(trimmed),
        assignedStaffUids,
        description: description.trim() || undefined,
      });
      navigate("/admin/classes");
    } catch (err: any) {
      alert(err?.message ?? "Unable to create class.");
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
            <h1 className="text-xl font-extrabold">Create class</h1>
            <p className="mt-1 text-xs text-white/70">Add a class group and choose staff who can take attendance for it.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="enterprise-panel p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_0.85fr]">
          <div className="grid gap-3">
            <label className="block">
              <span className="auth-label">Class name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required className="enterprise-input mt-1.5" placeholder="Grade 4A" />
            </label>

            <label className="block">
              <span className="auth-label">Description (optional)</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="enterprise-input mt-1.5 min-h-24" placeholder="Short description" />
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
            {saving ? "Saving..." : "Create class"}
          </button>
          <button type="button" onClick={() => navigate("/admin/classes")} className="enterprise-button-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

