import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import landingHowItWorks from "../assets/landing-how-it-works.jpg";
import useCurrentUser from "../hooks/useCurrentUser";
import { useAssignedStudentClasses } from "../hooks/useAssignedStudentClasses";
import { getAttendanceSettings } from "../services/attendanceSettings";

function formatTime(time?: string) {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

type IconName =
  | "admin"
  | "arrowRight"
  | "badge"
  | "chart"
  | "clipboardCheck"
  | "face"
  | "fingerprint"
  | "login"
  | "logout"
  | "qr"
  | "report"
  | "scan"
  | "staff"
  | "studentPlus";

type DashboardLink = {
  title: string;
  subtitle: string;
  href: string;
  icon: IconName;
  iconTone: string;
  show: boolean;
};

type FeatureBadge = {
  label: string;
  icon: IconName;
};

const featureBadges: FeatureBadge[] = [
  { label: "QR", icon: "qr" },
  { label: "Biometric", icon: "fingerprint" },
  { label: "Facial", icon: "face" },
  { label: "ID", icon: "badge" },
];

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>
      {name === "admin" ? (
        <>
          <path d="M12 3l7 3v5c0 4.6-2.9 8.2-7 10-4.1-1.8-7-5.4-7-10V6l7-3Z" />
          <path d="M9.5 12.5l1.7 1.7 3.6-4" />
        </>
      ) : null}
      {name === "arrowRight" ? <path d="M5 12h14M13 6l6 6-6 6" /> : null}
      {name === "badge" ? (
        <>
          <path d="M8 4h8l1 3v12H7V7l1-3Z" />
          <path d="M9 9h6M9 17h6" />
          <circle cx="12" cy="13" r="2" />
        </>
      ) : null}
      {name === "chart" ? (
        <>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-5" />
          <path d="M12 16V8" />
          <path d="M16 16v-7" />
        </>
      ) : null}
      {name === "clipboardCheck" ? (
        <>
          <path d="M9 4h6l1 2h3v15H5V6h3l1-2Z" />
          <path d="M9 13l2 2 4-5" />
        </>
      ) : null}
      {name === "face" ? (
        <>
          <path d="M8 3H6a3 3 0 0 0-3 3v2" />
          <path d="M16 3h2a3 3 0 0 1 3 3v2" />
          <path d="M8 21H6a3 3 0 0 1-3-3v-2" />
          <path d="M16 21h2a3 3 0 0 0 3-3v-2" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M9.5 15c1.4 1 3.6 1 5 0" />
        </>
      ) : null}
      {name === "fingerprint" ? (
        <>
          <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0" />
          <path d="M6 14.5v-4a6 6 0 0 1 12 0v1.5" />
          <path d="M9 20c1.5-2 2-3.8 2-6v-3a1 1 0 0 1 2 0v2.5" />
          <path d="M15 20c.7-1.4 1-2.8 1-4.5" />
          <path d="M4 13v-2.5a8 8 0 0 1 16 0" />
        </>
      ) : null}
      {name === "login" ? (
        <>
          <path d="M15 3h4v18h-4" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
        </>
      ) : null}
      {name === "logout" ? (
        <>
          <path d="M9 21H5V3h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </>
      ) : null}
      {name === "qr" ? (
        <>
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
          <path d="M14 14h2v2h-2zM18 14h2v6h-4v-2M14 18v2" />
        </>
      ) : null}
      {name === "report" ? (
        <>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v5h5" />
          <path d="M10 17v-4M13 17v-6M16 17v-2" />
        </>
      ) : null}
      {name === "scan" ? (
        <>
          <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2" />
          <path d="M7 12h10" />
        </>
      ) : null}
      {name === "staff" ? (
        <>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20a7 7 0 0 1 14 0" />
          <path d="M18 5l2 2M20 5l-2 2" />
        </>
      ) : null}
      {name === "studentPlus" ? (
        <>
          <path d="M12 4 3 8l9 4 9-4-9-4Z" />
          <path d="M6 10.5V15c1.7 1.3 3.7 2 6 2 1.1 0 2.2-.2 3.2-.5" />
          <path d="M18 14v6M15 17h6" />
        </>
      ) : null}
    </svg>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { userDoc, loading } = useCurrentUser();
  const [actor, setActor] = useState<"student" | "staff">("student");
  const [settings, setSettings] = useState({ lateAfter: "08:00", closeAfter: "16:00", timezone: "Africa/Accra" });
  const { hasAssignedClasses } = useAssignedStudentClasses(
    userDoc?.approved === true || userDoc?.role === "admin" ? userDoc?.uid ?? userDoc?.id : null
  );

  useEffect(() => {
    let active = true;
    getAttendanceSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((err) => console.warn("Failed to load attendance settings", err));

    return () => {
      active = false;
    };
  }, []);

  const isAdmin = userDoc?.role === "admin";
  const isApproved = isAdmin || userDoc?.approved === true;
  const canTakeStudentAttendance =
    isAdmin ||
    (isApproved && userDoc?.canTakeStudentAttendance === true) ||
    (isApproved && hasAssignedClasses);
  const canTakeStaffAttendance = isAdmin || (isApproved && userDoc?.canTakeStaffAttendance === true);
  const canTakeSelectedAttendance = actor === "staff" ? canTakeStaffAttendance : canTakeStudentAttendance;
  const isStaffUser =
    userDoc?.role === "teacher" ||
    userDoc?.role === "staff" ||
    userDoc?.role === "non_teaching_staff" ||
    userDoc?.role === "general_staff";
  const canUseStaffSelfService = isStaffUser || isAdmin;

  const dashboardLinks = useMemo<DashboardLink[]>(
    () => [
      {
        title: "My Attendance",
        subtitle: "Check in/out",
        href: "/staff/my-attendance",
        icon: "clipboardCheck",
        iconTone: "bg-emerald-500/10 text-emerald-700",
        show: canUseStaffSelfService,
      },
      {
        title: "My Report",
        subtitle: "Own attendance",
        href: "/staff/my-report",
        icon: "chart",
        iconTone: "bg-indigo-500/10 text-indigo-700",
        show: canUseStaffSelfService,
      },
      {
        title: "Scan QR",
        subtitle: "Fast student check-in/out",
        href: "/attendance/checkin?actor=student",
        icon: "scan",
        iconTone: "bg-primary/10 text-primary",
        show: canTakeStudentAttendance,
      },
      {
        title: "Staff Check-In",
        subtitle: "Staff attendance tracking",
        href: "/attendance/checkin?actor=staff",
        icon: "staff",
        iconTone: "bg-blue-500/10 text-blue-700",
        show: canTakeStaffAttendance,
      },
      {
        title: "Reports",
        subtitle: "Daily, weekly, monthly, termly",
        href: `/reports?type=${actor}`,
        icon: "report",
        iconTone: "bg-secondary/20 text-yellow-700",
        show: Boolean(isAdmin),
      },
      {
        title: "Admin",
        subtitle: "Setup terms, classes & users",
        href: "/admin",
        icon: "admin",
        iconTone: "bg-primary/10 text-primary",
        show: Boolean(isAdmin),
      },
      {
        title: "Add Student",
        subtitle: "Enroll new student",
        href: "/students",
        icon: "studentPlus",
        iconTone: "bg-red/10 text-red-600",
        show: Boolean(isAdmin),
      },
    ],
    [actor, canTakeStaffAttendance, canTakeStudentAttendance, canUseStaffSelfService, isAdmin]
  );

  const visibleLinks = dashboardLinks.filter((item) => item.show);

  function handleStart() {
    if (!canTakeStudentAttendance && !canTakeStaffAttendance) {
      alert("You are approved, but you have not been authorized to take attendance.");
      return;
    }
    const nextActor = canTakeSelectedAttendance ? actor : canTakeStudentAttendance ? "student" : "staff";
    navigate(`/attendance/checkin?actor=${nextActor}`);
  }

  if (loading) {
    return <div className="rounded-2xl bg-white p-4 text-slate-600 shadow">Loading dashboard...</div>;
  }

  return (
    <div className="-m-3 min-h-[calc(100vh-5rem)] bg-blue-900 text-slate-950 sm:-m-4 lg:-m-5">
      <div className="mx-auto max-w-6xl">
        <section className="bg-slate-800 px-4 py-3 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">Manage check-in, check-out, reports</h1>
            </div>

            <button
              type="button"
              onClick={handleStart}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-extrabold text-blue-900 shadow-sm transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-200 sm:ml-auto sm:w-36"
            >
              Start
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {featureBadges.map((item) => (
              <span key={item.label} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10">
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </span>
            ))}
          </div>
        </section>

        <div className="bg-white">
          <img src={landingHowItWorks} alt="Attendance workflow" className="h-[190px] w-full object-fill sm:h-[240px] lg:h-[300px]" />
        </div>

        <main className="space-y-5 px-4 py-4 sm:px-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleLinks.map((item) => (
              <Link key={item.href} to={item.href} className="flex min-h-24 items-center rounded-2xl bg-white p-4 shadow transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className={`mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${item.iconTone}`}>
                  <Icon name={item.icon} className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-dark">{item.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-neutral">{item.subtitle}</span>
                </span>
              </Link>
            ))}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-semibold text-dark">Select Actor</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["student", "staff"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActor(value)}
                  className={`rounded-xl border border-slate-200 py-3 text-sm font-semibold transition ${
                    actor === value ? "bg-primary text-white" : "bg-white text-dark hover:bg-slate-50"
                  }`}
                >
                  {value === "student" ? "Students" : "Staff"}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-dark">Quick Actions</h2>
              <span className="text-sm text-neutral">Today</span>
            </div>

            <div className="space-y-3">
              {canTakeSelectedAttendance ? (
                <>
                  <Link to={`/attendance/checkin?actor=${actor}&mode=in`} className="flex items-center justify-between gap-3 rounded-lg bg-primary/5 p-3 text-dark transition hover:bg-primary/10">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon name="login" className="h-4 w-4" />
                      </span>
                      <span className="truncate">{actor === "student" ? "Start class check-in" : "Start staff check-in"}</span>
                    </span>
                    <span className="shrink-0 text-sm text-neutral">- {formatTime(settings.lateAfter)}</span>
                  </Link>

                  <Link to={`/attendance/checkin?actor=${actor}&mode=out`} className="flex items-center justify-between gap-3 rounded-lg bg-red/5 p-3 text-dark transition hover:bg-red/10">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red/10 text-red-600">
                        <Icon name="logout" className="h-4 w-4" />
                      </span>
                      <span className="truncate">{actor === "student" ? "End of class check-out" : "End of staff check-out"}</span>
                    </span>
                    <span className="shrink-0 text-sm text-neutral">- {formatTime(settings.closeAfter)}</span>
                  </Link>
                </>
              ) : (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-neutral">Attendance access is not enabled for this actor.</div>
              )}

              {isAdmin ? (
                <Link to={`/reports?type=${actor}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-dark transition hover:bg-slate-50">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800">
                      <Icon name="report" className="h-4 w-4" />
                    </span>
                    <span className="truncate">View weekly report</span>
                  </span>
                  <span className="shrink-0 text-sm text-neutral">- {actor === "student" ? 5 : 30} days</span>
                </Link>
              ) : null}
            </div>
          </section>

          <footer className="pb-4 text-center text-xs text-blue-100/90">
            <p>Developer - Solomon K. Aggrey</p>
            <p>M'Salem Attendance - Web app</p>
            <p>Version 2.0</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
