import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteTerm, listTerms } from "../services/terms";
import type { Term } from "../types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentTerm(term: Term) {
  const today = todayIso();
  return term.isCurrent || (term.startDate <= today && term.endDate >= today);
}

export default function Terms() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadTerms() {
    setLoading(true);
    try {
      setTerms(await listTerms());
    } catch (err) {
      console.error(err);
      alert("Unable to load terms.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTerms();
  }, []);

  const counts = useMemo(
    () => ({
      total: terms.length,
      current: terms.filter(isCurrentTerm).length,
      upcoming: terms.filter((term) => term.startDate > todayIso()).length,
      ended: terms.filter((term) => term.endDate < todayIso()).length,
    }),
    [terms]
  );

  async function handleDelete(term: Term) {
    if (!term.id) return;
    if (!window.confirm(`Are you sure you want to delete "${term.name}"?\nThis action cannot be undone.`)) return;

    setDeletingId(term.id);
    try {
      await deleteTerm(term.id);
      setTerms((current) => current.filter((item) => item.id !== term.id));
    } catch (err: any) {
      alert(err?.message ?? "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold">Terms</h1>
            <p className="mt-1 text-xs text-white/70">Manage academic terms and auto-generated reporting weeks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadTerms} disabled={loading} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link to="/terms/create" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
              Add term
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total", counts.total, "border-l-blue-500"],
          ["Current", counts.current, "border-l-emerald-500"],
          ["Upcoming", counts.upcoming, "border-l-indigo-500"],
          ["Ended", counts.ended, "border-l-slate-400"],
        ].map(([label, value, accent]) => (
          <div key={label} className={`enterprise-panel min-h-28 border-l-4 p-4 ${accent}`}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{value}</p>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100"><div className="h-full w-1/2 rounded-full bg-current opacity-30" /></div>
          </div>
        ))}
      </section>

      <section className="enterprise-panel p-3">
        {loading ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading terms...</p>
        ) : terms.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">No terms yet.</p>
        ) : (
          <div className="grid gap-2">
            {terms.map((term) => (
              <div key={term.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/terms/${term.id}`} className="truncate text-base font-bold text-slate-950 hover:text-primary">
                        {term.name}
                      </Link>
                      {isCurrentTerm(term) ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Current term</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{term.startDate} to {term.endDate}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Link to={`/terms/${term.id}`} className="enterprise-button-secondary">
                      Edit
                    </Link>
                    <button type="button" onClick={() => handleDelete(term)} disabled={deletingId === term.id} className="enterprise-button-danger">
                      {deletingId === term.id ? "Deleting..." : "Delete"}
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

