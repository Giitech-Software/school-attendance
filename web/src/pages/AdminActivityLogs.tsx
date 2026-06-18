import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminLogs, type AdminLog } from "../services/adminLogs";

function formatLogTime(log: AdminLog) {
  const value = log.createdAt;
  const date = value && typeof value.toDate === "function" ? value.toDate() : null;
  if (!date) return "Pending sync";
  return date.toLocaleString();
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueTargetTypes(logs: AdminLog[]) {
  return Array.from(new Set(logs.map((log) => log.targetType).filter(Boolean))).sort();
}

function LogIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8v5l3 2" />
      <circle cx="12" cy="12" r="9" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("");

  async function loadLogs(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setLogs(await listAdminLogs(150));
    } catch (err: any) {
      console.error("listAdminLogs", err);
      setError(err?.message ?? "Unable to load activity logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const targetTypes = useMemo(() => uniqueTargetTypes(logs), [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (targetType && log.targetType !== targetType) return false;
      if (!q) return true;
      return [log.action, log.description, log.actorName, log.actorUid, log.actorRole, log.targetType, log.targetId]
        .some((value) => (value ?? "").toLowerCase().includes(q));
    });
  }, [logs, search, targetType]);

  return (
    <div className="-m-3 min-h-[calc(100vh-5rem)] bg-slate-500 p-3 sm:-m-4 sm:p-4 lg:-m-5 lg:p-5">
      <div className="mx-auto max-w-6xl space-y-3">
        <section className="overflow-hidden rounded-lg border border-blue-900/40 bg-[#0B1C33] text-white shadow-xl shadow-slate-900/20">
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/admin" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to admin">
                Back
              </Link>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300 ring-1 ring-blue-300/20">
                <LogIcon />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold">Activity Logs</h1>
                <p className="mt-1 text-sm text-blue-200">Recent user and admin actions</p>
              </div>
            </div>
            <button type="button" onClick={() => loadLogs(true)} disabled={refreshing || loading} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Total logs", logs.length],
            ["Showing", filteredLogs.length],
            ["Types", targetTypes.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-md shadow-slate-900/10">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-md shadow-slate-900/10">
          <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
            <label className="block">
              <span className="auth-label">Search logs</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, description, actor, target..." className="enterprise-input mt-1.5" />
            </label>
            <label className="block">
              <span className="auth-label">Target type</span>
              <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="enterprise-input mt-1.5">
                <option value="">All types</option>
                {targetTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-md shadow-slate-900/10">
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">Loading activity logs...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">No activity yet.</div>
          ) : (
            <div className="grid gap-2">
              {filteredLogs.map((log) => (
                <article key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="min-w-0">
                      <h2 className="font-extrabold text-slate-950">{formatAction(log.action)}</h2>
                      <p className="mt-1 text-sm text-slate-700">{log.description}</p>
                    </div>
                    <span className="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                      {log.targetType}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 border-t border-slate-200 pt-3 text-xs text-slate-500 sm:grid-cols-[1fr_auto]">
                    <div>
                      <p>{formatLogTime(log)}</p>
                      <p className="mt-1">
                        By {log.actorName ?? log.actorUid}
                        {log.actorRole ? ` (${log.actorRole})` : ""}
                      </p>
                    </div>
                    {log.targetId ? <p className="break-all text-slate-400 sm:text-right">Target: {log.targetId}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
