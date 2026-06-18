import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteTerm, getTermById, updateTerm } from "../services/terms";
import { autoGenerateWeeksForTerm, listWeeksForTerm } from "../services/weeks";
import type { Term, Week } from "../types";

function isWeekend(dateStr: string) {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

export default function TermDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [term, setTerm] = useState<Term | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const originalDates = useRef({ startDate: "", endDate: "" });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const termRow = await getTermById(id);
      setTerm(termRow);
      if (termRow) {
        originalDates.current = { startDate: termRow.startDate, endDate: termRow.endDate };
        setWeeks(await listWeeksForTerm(id));
      }
    } catch (err) {
      console.error(err);
      alert("Unable to load term details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!term?.id) return;
    if (!term.name.trim() || !term.startDate || !term.endDate) {
      alert("All fields are required.");
      return;
    }

    if (isWeekend(term.startDate) || isWeekend(term.endDate)) {
      alert("This term includes weekend dates. Generated weeks will still follow Monday-Friday.");
    }

    const datesChanged = term.startDate !== originalDates.current.startDate || term.endDate !== originalDates.current.endDate;

    setSaving(true);
    try {
      await updateTerm(term.id, { name: term.name.trim(), startDate: term.startDate, endDate: term.endDate });
      if (datesChanged) await autoGenerateWeeksForTerm(term.id, term.startDate, term.endDate);
      await load();
      alert(datesChanged ? "Term updated and weeks regenerated." : "Term updated successfully.");
    } catch (err: any) {
      alert(err?.message ?? "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateWeeks() {
    if (!term?.id) return;
    if (isWeekend(term.startDate) || isWeekend(term.endDate)) {
      alert("This term includes weekend dates. Generated weeks will still follow Monday-Friday.");
    }
    if (!window.confirm("This will automatically create all weeks for this term. Continue?")) return;

    setGenerating(true);
    try {
      const count = await autoGenerateWeeksForTerm(term.id, term.startDate, term.endDate);
      setWeeks(await listWeeksForTerm(term.id));
      alert(`${count} weeks created.`);
    } catch (err: any) {
      alert(err?.message ?? "Failed to generate weeks.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!term?.id) return;
    if (!window.confirm("Delete this term? This action cannot be undone.")) return;
    try {
      await deleteTerm(term.id);
      navigate("/terms");
    } catch (err: any) {
      alert(err?.message ?? "Delete failed.");
    }
  }

  if (loading) return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading term...</div>;
  if (!term) return <div className="enterprise-panel p-4 text-sm text-slate-500">Term not found.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link to="/terms" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10">
              Back
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">Edit Term</h1>
              <p className="mt-1 text-xs text-white/70">Update term dates and manage generated reporting weeks.</p>
            </div>
          </div>
          <button type="button" onClick={handleDelete} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Delete term
          </button>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1fr_20rem]">
        <form onSubmit={handleSubmit} className="enterprise-panel p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="auth-label">Name</span>
              <input value={term.name} onChange={(event) => setTerm({ ...term, name: event.target.value })} className="enterprise-input mt-1.5" />
            </label>

            <label className="block">
              <span className="auth-label">Start date</span>
              <input type="date" value={term.startDate} onChange={(event) => setTerm({ ...term, startDate: event.target.value })} className="enterprise-input mt-1.5" />
            </label>

            <label className="block">
              <span className="auth-label">End date</span>
              <input type="date" value={term.endDate} onChange={(event) => setTerm({ ...term, endDate: event.target.value })} className="enterprise-input mt-1.5" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="submit" disabled={saving} className="enterprise-button-primary">
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button type="button" onClick={handleGenerateWeeks} disabled={generating} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
              {generating ? "Generating..." : "Auto-generate weeks"}
            </button>
          </div>
        </form>

        <aside className="enterprise-panel p-4">
          <h2 className="text-base font-bold text-slate-950">Weeks</h2>
          <p className="mt-1 text-sm text-slate-500">{weeks.length} generated week{weeks.length === 1 ? "" : "s"}</p>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-auto pr-1">
            {weeks.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No weeks generated yet.</p>
            ) : (
              weeks.map((week) => (
                <div key={week.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-900">Week {week.weekNumber}</p>
                  <p className="text-xs text-slate-500">{week.startDate} to {week.endDate}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

