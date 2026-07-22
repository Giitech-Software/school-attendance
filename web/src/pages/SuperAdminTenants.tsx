import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import useCurrentUser from "../hooks/useCurrentUser";
import {
  assignTenantAdminByEmail,
  createTenant,
  listTenants,
  updateTenantStatus,
  type Tenant,
  type TenantStatus,
  type TenantType,
} from "../services/tenants";

const tenantTypes: { label: string; value: TenantType }[] = [
  { label: "School", value: "school" },
  { label: "Institution", value: "institution" },
  { label: "Company", value: "company" },
];

const tenantStatuses: { label: string; value: TenantStatus }[] = [
  { label: "Trial", value: "trial" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
];

function formatDate(value: any) {
  const date = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusClass(status: TenantStatus) {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "suspended") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function signupInviteLink(code?: string | null) {
  if (!code) return null;
  return `${window.location.origin}/signup?invite=${encodeURIComponent(code)}`;
}

export default function SuperAdminTenants() {
  const { userDoc, loading: authLoading } = useCurrentUser();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<TenantType>("school");
  const [status, setStatus] = useState<TenantStatus>("trial");
  const [subscriptionPlan, setSubscriptionPlan] = useState("standard");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminEmailByTenant, setAdminEmailByTenant] = useState<Record<string, string>>({});

  const isSuperAdmin = userDoc?.role === "super_admin";
  const activeCount = useMemo(() => tenants.filter((tenant) => tenant.status === "active").length, [tenants]);
  const suspendedCount = useMemo(() => tenants.filter((tenant) => tenant.status === "suspended").length, [tenants]);

  async function loadTenants() {
    setLoading(true);
    setError(null);
    try {
      setTenants(await listTenants());
    } catch (err: any) {
      setError(err?.message ?? "Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && isSuperAdmin) void loadTenants();
    if (!authLoading && !isSuperAdmin) setLoading(false);
  }, [authLoading, isSuperAdmin]);

  async function handleCreateTenant(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createTenant({ name, type, status, subscriptionPlan, contactEmail, contactPhone, adminEmail });
      setName("");
      setType("school");
      setStatus("trial");
      setSubscriptionPlan("standard");
      setContactEmail("");
      setContactPhone("");
      setAdminEmail("");
      setMessage("Tenant created successfully.");
      await loadTenants();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create tenant.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(tenant: Tenant, nextStatus: TenantStatus) {
    setError(null);
    setMessage(null);
    try {
      await updateTenantStatus(tenant.id, nextStatus);
      setTenants((current) => current.map((row) => (row.id === tenant.id ? { ...row, status: nextStatus } : row)));
      setMessage(`${tenant.name} status updated.`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to update tenant status.");
    }
  }

  async function handleAssignAdmin(tenant: Tenant) {
    const email = (adminEmailByTenant[tenant.id] ?? tenant.adminEmail ?? "").trim();
    if (!email) {
      setError("Enter an admin email first.");
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await assignTenantAdminByEmail(tenant.id, tenant.name, email, tenant.type);
      setTenants((current) => current.map((row) => (row.id === tenant.id ? { ...row, adminEmail: email.toLowerCase() } : row)));
      setMessage(`${email.toLowerCase()} is now admin for ${tenant.name}.`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign tenant admin.");
    }
  }

  if (authLoading || loading) {
    return <div className="enterprise-panel px-5 py-4 text-sm font-semibold text-slate-600">Loading tenants...</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="admin-card">
        <p className="text-sm font-bold uppercase tracking-wide text-red-600">Access denied</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-950">Super admin required</h1>
        <p className="mt-2 text-sm text-slate-600">Only users with role super_admin can manage renting tenants.</p>
        <Link to="/" className="enterprise-button-secondary mt-4 inline-flex">Back home</Link>
      </div>
    );
  }

  return (
    <div className="-m-3 min-h-[calc(100vh-5rem)] bg-slate-100 p-3 sm:-m-4 sm:p-4 lg:-m-5 lg:p-5">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-white shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Renting</p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Super Admin Tenants</h1>
              <p className="mt-1 text-sm text-slate-300">Create renters, assign tenant admins, and control subscription status.</p>
            </div>
            <button type="button" onClick={loadTenants} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Refresh
            </button>
          </div>
        </section>

        {(error || message) && (
          <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error ?? message}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          {[
            ["Total tenants", tenants.length, "bg-slate-900 text-white"],
            ["Active", activeCount, "bg-emerald-100 text-emerald-800"],
            ["Suspended", suspendedCount, "bg-red-100 text-red-800"],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`mt-2 w-fit rounded px-2 py-1 text-2xl font-extrabold ${tone}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[390px_1fr]">
          <form onSubmit={handleCreateTenant} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-950">Create tenant</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Name</span>
                <input required value={name} onChange={(event) => setName(event.target.value)} className="enterprise-input mt-1" placeholder="ASTEM School" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Type</span>
                  <select value={type} onChange={(event) => setType(event.target.value as TenantType)} className="enterprise-input mt-1">
                    {tenantTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value as TenantStatus)} className="enterprise-input mt-1">
                    {tenantStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Plan</span>
                <input value={subscriptionPlan} onChange={(event) => setSubscriptionPlan(event.target.value)} className="enterprise-input mt-1" placeholder="standard" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Contact email</span>
                <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="enterprise-input mt-1" placeholder="owner@example.com" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Contact phone</span>
                <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="enterprise-input mt-1" placeholder="+233..." />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tenant admin email</span>
                <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} className="enterprise-input mt-1" placeholder="admin@example.com" />
              </label>
            </div>
            <button type="submit" disabled={saving} className="enterprise-button-primary mt-4 w-full justify-center disabled:opacity-60">
              {saving ? "Creating..." : "Create Tenant"}
            </button>
          </form>

          <div className="space-y-3">
            {tenants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No tenants created yet.</div>
            ) : tenants.map((tenant) => (
              <article key={tenant.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-extrabold text-slate-950">{tenant.name}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${statusClass(tenant.status)}`}>{tenant.status}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold capitalize text-slate-700">{tenant.type}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">ID: {tenant.id}</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                      <p><span className="font-bold text-slate-800">Plan:</span> {tenant.subscriptionPlan ?? "standard"}</p>
                      <p><span className="font-bold text-slate-800">Created:</span> {formatDate(tenant.createdAt)}</p>
                      <p><span className="font-bold text-slate-800">Contact:</span> {tenant.contactEmail || "None"}</p>
                      <p><span className="font-bold text-slate-800">Phone:</span> {tenant.contactPhone || "None"}</p>
                      <p className="md:col-span-2"><span className="font-bold text-slate-800">Admin:</span> {tenant.adminEmail || "Not assigned"}</p>
                      <p><span className="font-bold text-slate-800">Invite code:</span> {tenant.inviteCode || "Not generated"}</p>
                      <p className="break-all"><span className="font-bold text-slate-800">Signup link:</span> {signupInviteLink(tenant.inviteCode) ?? "Not generated"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 xl:w-80">
                    <select value={tenant.status} onChange={(event) => handleStatusChange(tenant, event.target.value as TenantStatus)} className="enterprise-input">
                      {tenantStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={adminEmailByTenant[tenant.id] ?? tenant.adminEmail ?? ""}
                        onChange={(event) => setAdminEmailByTenant((current) => ({ ...current, [tenant.id]: event.target.value }))}
                        className="enterprise-input min-w-0 flex-1"
                        placeholder="admin@example.com"
                      />
                      <button type="button" onClick={() => handleAssignAdmin(tenant)} className="enterprise-button-secondary shrink-0">Assign</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


