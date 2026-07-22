import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStaff, STAFF_ROLE_OPTIONS, type StaffRoleType } from "../services/staff";
import { getUserByEmail, upsertUser } from "../services/users";

type StaffIdMode = "auto" | "manual";

export default function StaffCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [roleType, setRoleType] = useState<StaffRoleType>("teacher");
  const [staffIdMode, setStaffIdMode] = useState<StaffIdMode>("auto");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !email.trim()) {
      alert("Name and Email are required");
      return;
    }

    if (staffIdMode === "manual" && !staffId.trim()) {
      alert("Enter a Staff ID or choose auto-generate.");
      return;
    }

    setSaving(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const linkedUser = await getUserByEmail(normalizedEmail);
      const requestedStaffId = staffIdMode === "manual" ? staffId.trim().toUpperCase() : undefined;

      const staff = await createStaff({
        name: name.trim(),
        staffId: requestedStaffId,
        email: normalizedEmail,
        role: roleType,
        roleType,
        userUid: linkedUser?.id,
      });

      if (linkedUser?.id) {
        await upsertUser({
          uid: linkedUser.uid ?? linkedUser.id,
          id: linkedUser.id,
          approved: true,
          ...(linkedUser.role === "admin" || linkedUser.role === "super_admin" ? {} : { role: roleType }),
        });
      }

      alert(
        linkedUser
          ? `This staff profile has been linked to the matching user account. Staff ID: ${staff.staffId}`
          : `No matching user account was found for this email, so the staff profile was created without an app login link. Staff ID: ${staff.staffId}`
      );
      navigate("/staff");
    } catch (err: any) {
      alert(err?.message ?? "Unable to create staff member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/staff" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to staff">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">New Staff</h1>
            <p className="mt-1 text-xs text-white/70">Create a staff profile and link it to an approved user account when one exists.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="enterprise-panel p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="auth-label">Full name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="enterprise-input mt-1.5" placeholder="e.g. John Doe" required />
          </label>

          <label className="block">
            <span className="auth-label">Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="enterprise-input mt-1.5" placeholder="e.g. john@example.com" required />
          </label>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
          <div className="admin-field-card">
            <p className="auth-label">Staff Role</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAFF_ROLE_OPTIONS.map((option) => (
                <button key={option.value} type="button" onClick={() => setRoleType(option.value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${roleType === option.value ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-field-card">
            <p className="auth-label">Staff ID</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStaffIdMode("auto")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${staffIdMode === "auto" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                Auto-create
              </button>
              <button type="button" onClick={() => setStaffIdMode("manual")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${staffIdMode === "manual" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                Add staff ID
              </button>
            </div>
          </div>
        </div>

        {staffIdMode === "manual" ? (
          <label className="mt-4 block max-w-md">
            <span className="auth-label">Staff ID</span>
            <input value={staffId} onChange={(event) => setStaffId(event.target.value.toUpperCase())} className="enterprise-input mt-1.5" placeholder={roleType === "teacher" ? "e.g. TCH-0001" : "e.g. NST-0001"} />
          </label>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Leave empty. A Staff ID will be created automatically.</div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" disabled={saving} className="enterprise-button-primary">
            {saving ? "Creating..." : "Create Staff"}
          </button>
          <button type="button" onClick={() => navigate("/staff")} className="enterprise-button-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}


