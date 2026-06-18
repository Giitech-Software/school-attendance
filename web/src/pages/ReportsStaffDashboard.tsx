import { Link } from "react-router-dom";

const staffLinks = [
  { label: "Staff daily report", href: "/reports/staff-daily", meta: "Daily", description: "Generate one-day staff attendance summaries." },
  { label: "Staff weekly report", href: "/reports/staff-weekly", meta: "Weekly", description: "Review staff attendance across a selected week." },
  { label: "Staff monthly report", href: "/reports/staff-monthly", meta: "Monthly", description: "Export monthly staff attendance results." },
  { label: "Staff termly report", href: "/reports/staff-termly", meta: "Termly", description: "Summarize staff attendance for a term." },
];

export default function ReportsStaffDashboard() {
  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/reports" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to reports">
                Back
              </Link>
              <h1 className="truncate text-xl font-extrabold">Staff reports dashboard</h1>
            </div>
            <p className="mt-1 text-xs text-white/70">Choose a staff report to generate attendance summaries for your staff team.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {staffLinks.map((link) => (
          <Link key={link.href} to={link.href} className="enterprise-panel p-4 transition hover:border-primary hover:bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-extrabold text-slate-950">{link.label}</h2>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{link.meta}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{link.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}



