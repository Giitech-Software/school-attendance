import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUserById, upsertUser, type AppUser, type UserRole } from "../services/users";

const USER_ROLES: UserRole[] = ["parent", "teacher", "non_teaching_staff", "general_staff", "staff", "admin"];

function roleLabel(role?: string | null) {
  return (role ?? "teacher").replaceAll("_", " ");
}

function isStaffAccount(user: AppUser | null) {
  return (
    user?.role === "teacher" ||
    user?.role === "non_teaching_staff" ||
    user?.role === "staff" ||
    user?.role === "general_staff" ||
    user?.role === "admin"
  );
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  function userUid(row: AppUser) {
    return row.uid ?? row.id ?? "";
  }

  useEffect(() => {
    let active = true;
    if (!id) return;
    getUserById(id)
      .then((row) => {
        if (active) setUser(row);
      })
      .catch((err) => {
        console.error(err);
        alert("Unable to load user.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    try {
      const uid = userUid(user);
      if (!uid) throw new Error("User UID is missing.");
      await upsertUser({ ...user, uid });
      navigate("/users");
    } catch (err: any) {
      alert(err?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePromoteToAdmin() {
    if (!user?.id) return;
    if (!window.confirm(`Give admin role to ${user.displayName ?? user.email}?`)) return;
    setPromoting(true);
    try {
      const next = { ...user, role: "admin" as const, approved: true };
      const uid = userUid(next);
      if (!uid) throw new Error("User UID is missing.");
      await upsertUser({ ...next, uid });
      setUser(next);
      alert("User promoted to admin. They should re-login to refresh their profile.");
    } catch (err: any) {
      alert(err?.message ?? "Promotion failed.");
    } finally {
      setPromoting(false);
    }
  }

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading user...</div>;
  }

  if (!user) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">User not found.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/users" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to users">
              Back
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold">Edit User</h1>
              <p className="mt-1 truncate text-xs text-white/70">{user.email ?? user.uid ?? user.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className={`rounded px-2 py-1 ${user.approved ? "bg-emerald-500/20 text-emerald-100" : "bg-red-500/20 text-red-100"}`}>{user.approved ? "Approved" : "Not approved"}</span>
            <span className="rounded bg-white/10 px-2 py-1 text-white">{roleLabel(user.role)}</span>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="enterprise-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
          <div className="grid gap-3">
            <label className="block">
              <span className="auth-label">Display name</span>
              <input
                value={user.displayName ?? ""}
                onChange={(event) => setUser({ ...user, displayName: event.target.value })}
                className="enterprise-input mt-1.5"
                placeholder="Full name"
              />
            </label>

            <label className="block">
              <span className="auth-label">Role</span>
              <select
                value={user.role ?? "teacher"}
                onChange={(event) => setUser({ ...user, role: event.target.value as UserRole })}
                className="enterprise-input mt-1.5"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-field-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="auth-label">Approval</p>
                  <p className="mt-1 text-sm text-slate-500">Controls whether this account can enter the app after sign-in.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUser({ ...user, approved: !user.approved })}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${user.approved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {user.approved ? "Approved" : "Not Approved"}
                </button>
              </div>
            </div>
          </div>

          <aside className="grid gap-3 content-start">
            <div className="admin-field-card">
              <p className="auth-label">Account</p>
              <dl className="mt-2 grid gap-2 text-sm text-slate-600">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Email</dt>
                  <dd className="break-all font-semibold text-slate-800">{user.email ?? "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">UID</dt>
                  <dd className="break-all font-mono text-xs text-slate-700">{user.uid ?? user.id ?? "N/A"}</dd>
                </div>
              </dl>
            </div>

            <div className="admin-field-card">
              <p className="auth-label">Attendance Permissions</p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => setUser({ ...user, canTakeStudentAttendance: !user.canTakeStudentAttendance })}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${user.canTakeStudentAttendance ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {user.canTakeStudentAttendance ? "Can take student attendance" : "Cannot take student attendance"}
                </button>

                <button
                  type="button"
                  onClick={() => setUser({ ...user, canTakeStaffAttendance: !user.canTakeStaffAttendance })}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${user.canTakeStaffAttendance ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {user.canTakeStaffAttendance ? "Can take staff attendance" : "Cannot take staff attendance"}
                </button>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" disabled={saving} className="enterprise-button-primary">
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={() => navigate("/users")} className="enterprise-button-secondary">
            Cancel
          </button>
          {isStaffAccount(user) && user.id ? (
            <Link to="/staff/create" className="enterprise-button-secondary">
              Create / Link Staff Profile
            </Link>
          ) : null}
          {user.role !== "admin" ? (
            <button type="button" onClick={handlePromoteToAdmin} disabled={promoting} className="enterprise-button-danger">
              {promoting ? "Promoting..." : "Promote to Admin"}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

