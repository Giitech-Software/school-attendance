import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listClasses, type ClassRecord } from "../services/classes";
import { listStudents } from "../services/students";
import { listStaff } from "../services/staff";
import { listTerms } from "../services/terms";
import { listWeeks } from "../services/weeks";
import { getSchoolLocationReadiness, type SchoolLocationReadiness } from "../services/locationGuard";

type AdminIconName = "book" | "location" | "calendar" | "students" | "move" | "staff" | "qr" | "classes" | "users" | "clock" | "settings" | "warning" | "chevron";

type AdminSection = {
  label: string;
  href: string;
  description: string;
  meta: string;
  tone: string;
  icon: AdminIconName;
  iconTone: string;
};

const adminSections: AdminSection[] = [
  { label: "User Manual", href: "/admin/user-manual", description: "Open concise guide for all app pages.", meta: "Support", tone: "border-l-blue-500", icon: "book", iconTone: "bg-blue-100 text-blue-800" },
  { label: "Activity Logs", href: "/admin/activity-logs", description: "Review recent user and admin actions.", meta: "Audit", tone: "border-l-slate-500", icon: "clock", iconTone: "bg-slate-100 text-slate-800" },
  { label: "School Location", href: "/admin/setup-school-location", description: "Configure the geofence used for trusted check-ins.", meta: "Security", tone: "border-l-red-500", icon: "location", iconTone: "bg-red-100 text-red-800" },
  { label: "Manage Terms", href: "/terms", description: "Create, edit and delete academic terms.", meta: "Calendar", tone: "border-l-amber-500", icon: "calendar", iconTone: "bg-amber-100 text-amber-800" },
  { label: "Manage Students", href: "/students", description: "Enroll or assign students to classes.", meta: "Registry", tone: "border-l-sky-500", icon: "students", iconTone: "bg-sky-100 text-sky-800" },
  { label: "Promote Students", href: "/admin/promote-students", description: "Move selected students from one class to another.", meta: "Term operations", tone: "border-l-cyan-500", icon: "move", iconTone: "bg-cyan-100 text-cyan-800" },
  { label: "Manage Staff", href: "/staff", description: "Enroll staff and manage attendance access.", meta: "Registry", tone: "border-l-orange-500", icon: "staff", iconTone: "bg-orange-100 text-orange-800" },
  { label: "Student QR Cards", href: "/students/qr-generator", description: "Generate signed QR codes for students.", meta: "QR", tone: "border-l-violet-500", icon: "qr", iconTone: "bg-violet-100 text-violet-800" },
  { label: "Staff QR Cards", href: "/attendance/staff-qr-generator", description: "Generate signed QR payloads for staff.", meta: "QR", tone: "border-l-indigo-500", icon: "qr", iconTone: "bg-indigo-100 text-indigo-800" },
  { label: "Manage Classes", href: "/admin/classes", description: "Create, edit and delete classes.", meta: "Academic structure", tone: "border-l-emerald-500", icon: "classes", iconTone: "bg-emerald-100 text-emerald-800" },
  { label: "Manage Users", href: "/users", description: "Assign wards, roles and edit users.", meta: "Identity", tone: "border-l-rose-500", icon: "users", iconTone: "bg-rose-100 text-rose-800" },
  { label: "Attendance Settings", href: "/admin/attendance-settings", description: "Control late windows, close times and timezone.", meta: "Policy", tone: "border-l-slate-500", icon: "clock", iconTone: "bg-slate-100 text-slate-800" },
];

const marqueeItems = [
  { text: "Manage Terms", className: "text-red-300 ring-red-300/20" },
  { text: "Manage Students", className: "text-blue-300 ring-blue-300/20" },
  { text: "Generate QRs", className: "text-yellow-300 ring-yellow-300/20" },
  { text: "Manage Classes", className: "text-emerald-300 ring-emerald-300/20" },
  { text: "Manage Users", className: "text-white ring-white/20" },
  { text: "Assign Students", className: "text-red-200 ring-red-200/20" },
  { text: "Set Attendance Time", className: "text-sky-300 ring-sky-300/20" },
];

function AdminIcon({ name, className = "h-5 w-5" }: { name: AdminIconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ariaHidden: true,
  };

  switch (name) {
    case "book":
      return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" /></svg>;
    case "location":
      return <svg {...common}><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case "calendar":
      return <svg {...common}><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="5" width="18" height="18" rx="2" /><path d="M3 10h18" /></svg>;
    case "students":
      return <svg {...common}><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg>;
    case "move":
      return <svg {...common}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /><path d="M5 6v12" /></svg>;
    case "staff":
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="9" r="2.2" /><path d="M8 16c1-2 7-2 8 0" /></svg>;
    case "qr":
      return <svg {...common}><rect x="3" y="3" width="6" height="6" /><rect x="15" y="3" width="6" height="6" /><rect x="3" y="15" width="6" height="6" /><path d="M15 15h2v2h-2z" /><path d="M20 15h1v5h-5v-1" /><path d="M12 7h1" /><path d="M12 12h1" /><path d="M7 12h1" /></svg>;
    case "classes":
      return <svg {...common}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><path d="M7 4v16" /></svg>;
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c1.2-3 9.8-3 11 0" /><circle cx="17" cy="9" r="2" /><path d="M15.5 15.5c2.2.2 4 .9 5 2.5" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "settings":
      return <svg {...common}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "warning":
      return <svg {...common}><path d="M12 3 2 21h20L12 3z" /><path d="M12 9v5" /><path d="M12 17h.01" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    default:
      return null;
  }
}

export default function AdminIndex() {
  const [loading, setLoading] = useState(true);
  const [termsCount, setTermsCount] = useState(0);
  const [weeksCount, setWeeksCount] = useState(0);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [locationReadiness, setLocationReadiness] = useState<SchoolLocationReadiness | null>(null);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [terms, weeks, classRows, students, staff, readiness] = await Promise.all([
        listTerms().catch(() => []),
        listWeeks().catch(() => []),
        listClasses().catch(() => []),
        listStudents().catch(() => []),
        listStaff().catch(() => []),
        getSchoolLocationReadiness().catch(() => null),
      ]);
      setTermsCount(terms.length);
      setWeeksCount(weeks.length);
      setClasses(classRows);
      setStudentsCount(students.length);
      setStaffCount(staff.length);
      setLocationReadiness(readiness);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const attendanceReady = Boolean(locationReadiness?.configured) || Boolean(locationReadiness?.emergencyBypassActive);
  const assignedStaffLinks = useMemo(() => classes.reduce((sum, cls) => sum + (cls.assignedStaffUids?.length ?? 0), 0), [classes]);

  return (
    <div className="-m-3 min-h-[calc(100vh-5rem)] bg-slate-500 p-3 sm:-m-4 sm:p-4 lg:-m-5 lg:p-5">
      <div className="mx-auto max-w-7xl space-y-3">
        <section className="overflow-hidden rounded-lg border border-blue-900/40 bg-[#0B1C33] text-white shadow-xl shadow-slate-900/20">
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300 ring-1 ring-blue-300/20">
                  <AdminIcon name="settings" />
                </span>
                <h1 className="text-2xl font-extrabold sm:text-3xl">Admin</h1>
              </div>
              <p className="mt-1 text-sm text-blue-300">Setup terms, classes, users</p>
            </div>
            <button type="button" onClick={loadDashboard} disabled={loading} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg bg-[#0B1C33] py-2 shadow-lg shadow-slate-900/15" aria-label="Quick setup shortcuts">
          <div className="motion-marquee px-3">
            {[...marqueeItems, ...marqueeItems].map((item, index) => (
              <span key={`${item.text}-${index}`} className={`motion-marquee-item ${item.className}`}>
                {item.text}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Terms", termsCount, "bg-red-50 text-red-700", "calendar"],
            ["Weeks", weeksCount, "bg-amber-50 text-amber-700", "clock"],
            ["Classes", classes.length, "bg-emerald-50 text-emerald-700", "classes"],
            ["Students", studentsCount, "bg-blue-50 text-blue-700", "students"],
            ["Staff", staffCount, "bg-orange-50 text-orange-700", "staff"],
          ].map(([label, value, tone, icon]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-md shadow-slate-900/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
                  <AdminIcon name={icon as AdminIconName} className="h-4 w-4" />
                </span>
              </div>
              <p className={`mt-1 w-fit rounded px-2 py-1 text-2xl font-extrabold ${tone}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className={`rounded-lg border p-4 shadow-md shadow-slate-900/10 ${attendanceReady ? "border-emerald-200 bg-emerald-100" : "border-red-200 bg-red-100"}`}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70 text-slate-800">
                <AdminIcon name={attendanceReady ? "location" : "warning"} />
              </div>
              <div>
                <h2 className={`text-base font-extrabold ${attendanceReady ? "text-emerald-800" : "text-red-800"}`}>Attendance Readiness</h2>
                <p className="mt-1 text-sm text-slate-700">
                  {attendanceReady
                    ? locationReadiness?.emergencyBypassActive
                      ? "Emergency mode active: GPS checks bypassed for the approved period."
                      : "School geofence configured and ready."
                    : "Blocked: school location is not configured."}
                </p>
                <p className="mt-1 text-xs text-slate-600">Assigned staff links: {assignedStaffLinks}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/setup-school-location" className={attendanceReady ? "enterprise-button-secondary" : "enterprise-button-primary"}>
                {attendanceReady ? "Review location" : "Set Location"}
              </Link>
              {!attendanceReady ? (
                <Link to="/admin/setup-school-location" className="enterprise-button-danger">
                  Bypass Options
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {adminSections.map((item) => (
            <Link key={item.href} to={item.href} className={`rounded-lg border border-slate-200 border-l-4 bg-white p-4 shadow-md shadow-slate-900/10 transition hover:-translate-y-0.5 hover:shadow-lg ${item.tone}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.iconTone}`}>
                    <AdminIcon name={item.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.meta}</p>
                    <h2 className="mt-1 truncate text-base font-extrabold text-slate-950">{item.label}</h2>
                  </div>
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-600">
                  <AdminIcon name="chevron" className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-600">{item.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

