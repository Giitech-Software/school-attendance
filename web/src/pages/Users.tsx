import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteUser, listUsers, type AppUser } from "../services/users";

function roleLabel(role?: string | null) {
  return role?.replaceAll("_", " ") ?? "-";
}

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch (err) {
      console.error(err);
      alert("Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => [user.displayName, user.email, user.role].some((value) => (value ?? "").toLowerCase().includes(q)));
  }, [search, users]);

  const counts = useMemo(
    () => ({
      total: users.length,
      approved: users.filter((user) => user.role === "admin" || user.approved).length,
      pending: users.filter((user) => user.role !== "admin" && !user.approved).length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [users]
  );

  async function handleDelete(user: AppUser) {
    if (!user.id) return;
    if (!window.confirm(`Delete ${user.displayName ?? user.email ?? "this user"}?\n\nThis action cannot be undone.`)) return;

    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
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
            <h1 className="text-xl font-extrabold">Manage Users</h1>
            <p className="mt-1 text-xs text-white/70">Approve accounts, assign roles, and grant attendance permissions.</p>
          </div>
          <button type="button" onClick={loadUsers} disabled={loading} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="p-3">
          <label className="block">
            <span className="auth-label">Search users</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="enterprise-input mt-1.5" />
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", counts.total],
          ["Approved", counts.approved],
          ["Pending", counts.pending],
          ["Admins", counts.admins],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-3">
        {loading ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">No users found.</p>
        ) : (
          <div className="grid gap-2">
            {filteredUsers.map((user) => {
              const approved = user.role === "admin" || user.approved;
              return (
                <div key={user.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/users/${user.id}`} className="truncate text-base font-bold text-slate-950 hover:text-primary">
                          {user.displayName ?? user.email ?? "User"}
                        </Link>
                        <span className={approved ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700" : "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"}>
                          {approved ? "Approved" : "Pending approval"}
                        </span>
                      </div>
                      <div className="mt-1 grid gap-1 text-sm text-slate-600 sm:grid-cols-3">
                        <p className="truncate">{user.email ?? "No email"}</p>
                        <p>Role: {roleLabel(user.role)}</p>
                        <p>{user.canTakeStudentAttendance || user.canTakeStaffAttendance ? "Attendance access" : "No attendance access"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link to={`/users/${user.id}`} className="enterprise-button-secondary">
                        Edit
                      </Link>
                      {user.role === "parent" ? (
                        <Link to={`/admin/parents/${user.id}`} className="rounded-lg bg-teal-100 px-3.5 py-2 text-sm font-semibold text-teal-800 shadow-sm hover:bg-teal-200">
                          Wards
                        </Link>
                      ) : null}
                      <button type="button" onClick={() => handleDelete(user)} disabled={deletingId === user.id} className="enterprise-button-danger">
                        {deletingId === user.id ? "Deleting..." : "Delete"}
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

