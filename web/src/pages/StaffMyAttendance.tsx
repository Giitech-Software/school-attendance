import { Link } from "react-router-dom";
import { useCurrentStaff } from "../hooks/useCurrentStaff";

export default function StaffMyAttendance() {
  const { staff, loading } = useCurrentStaff();

  if (loading) {
    return <div className="enterprise-panel p-4 text-sm text-slate-500">Loading staff profile...</div>;
  }

  if (!staff) {
    return (
      <div className="mx-auto max-w-lg enterprise-panel p-6 text-center">
        <h1 className="text-xl font-extrabold text-slate-950">Staff profile not linked</h1>
        <p className="mt-2 text-sm text-slate-500">Ask an administrator to link your user account to a staff record.</p>
      </div>
    );
  }

  const actions = [
    {
      title: "QR Attendance",
      text: "Scan the QR code linked to your staff profile.",
      inHref: "/attendance/qr?actor=staff&mode=in&self=1",
      outHref: "/attendance/qr?actor=staff&mode=out&self=1",
      meta: "Signed QR",
    },
    {
      title: "Face Recognition",
      text: "Verify your face with the front camera.",
      inHref: "/attendance/face?actor=staff&mode=in&self=1",
      outHref: "/attendance/face?actor=staff&mode=out&self=1",
      meta: "Camera",
    },
    {
      title: "Staff ID Attendance",
      text: "Use your staff ID on the web check-in screen.",
      inHref: "/attendance/checkin?actor=staff&mode=in",
      outHref: "/attendance/checkin?actor=staff&mode=out",
      meta: "Manual ID",
    },
  ];

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold">My Attendance</h1>
            <p className="mt-1 text-xs text-white/70">Check in or check out using your approved staff profile.</p>
          </div>
          <Link to="/staff/my-report" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            My Report
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Staff", staff.name],
          ["Staff ID", staff.staffId ?? staff.id],
          ["Status", "Ready"],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 truncate text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {actions.map((action) => (
          <div key={action.title} className="enterprise-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-950">{action.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{action.text}</p>
              </div>
              <span className="rounded bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">{action.meta}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to={action.inHref} className="enterprise-button-primary justify-center">
                Check-In
              </Link>
              <Link to={action.outHref} className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700">
                Check-Out
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

