import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTerm } from "../services/terms";
import { autoGenerateWeeksForTerm } from "../services/weeks";

export default function TermCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  function isWeekend(dateStr: string) {
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      alert("Name, start date and end date are required.");
      return;
    }
    if (isWeekend(startDate) || isWeekend(endDate)) {
      alert("The term start or end date falls on a weekend. Weeks will still be generated from Monday to Friday.");
    }

    setSaving(true);
    try {
      const term = await createTerm({ name: name.trim(), startDate, endDate });
      if (term.id) await autoGenerateWeeksForTerm(term.id, startDate, endDate);
      navigate("/terms");
    } catch (err: any) {
      alert(err?.message ?? "Unable to create term.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/terms" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">New Term</h1>
            <p className="mt-1 text-xs text-white/70">Create a term and automatically generate Monday to Friday reporting weeks.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="enterprise-panel p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="auth-label">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required className="enterprise-input mt-1.5" placeholder="e.g. Term 2" />
          </label>

          <label className="block">
            <span className="auth-label">Start date</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required className="enterprise-input mt-1.5" />
          </label>

          <label className="block">
            <span className="auth-label">End date</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required className="enterprise-input mt-1.5" />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Weeks are generated automatically from the term dates and follow Monday to Friday.
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" disabled={saving} className="enterprise-button-primary">
            {saving ? "Saving..." : "Create term"}
          </button>
          <button type="button" onClick={() => navigate("/terms")} className="enterprise-button-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

