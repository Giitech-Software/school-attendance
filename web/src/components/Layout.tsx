import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOutUser } from "../services/auth";
import useCurrentUser from "../hooks/useCurrentUser";

const mainLinks = [
  { to: "/", label: "Home" },
  { to: "/attendance/checkin", label: "Attendance" },
  { to: "/reports", label: "Reports", adminOnly: true },
  { to: "/students", label: "Students", adminOnly: true },
  { to: "/staff", label: "Staff", adminOnly: true },
  { to: "/admin", label: "Administration", adminOnly: true },
];

const adminLinks = [
  { to: "/admin/classes", label: "Classes" },
  { to: "/terms", label: "Terms" },
  { to: "/users", label: "Users" },
  { to: "/admin/attendance-settings", label: "Settings" },
];

const publicRoutes = new Set(["/login", "/forgot-password", "/signup"]);

function initialsFromEmail(email?: string | null) {
  if (!email) return "U";
  return (email.split("@")[0] || "U").slice(0, 2).toUpperCase();
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center rounded-md px-2.5 py-1.5 text-sm font-semibold transition ${
    isActive ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
  }`;
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Home";
  const parts = pathname.split("/").filter(Boolean);
  return (parts[parts.length - 1] ?? parts[0] ?? "Home")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, userDoc, loading } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const isPublicRoute = publicRoutes.has(location.pathname);
  const isAdmin = userDoc?.role === "admin";
  const isApproved = isAdmin || userDoc?.approved === true;
  const visibleMainLinks = useMemo(() => mainLinks.filter((link) => !link.adminOnly || isAdmin), [isAdmin]);
  const visibleAdminLinks = isAdmin ? adminLinks : [];

  useEffect(() => {
    if (loading || isPublicRoute) return;
    if (!authUser) navigate("/login", { replace: true });
  }, [authUser, isPublicRoute, loading, navigate]);

  useEffect(() => {
    if (loading || isPublicRoute || !authUser || !userDoc) return;
    if (!isApproved) navigate("/login", { replace: true });
  }, [authUser, isApproved, isPublicRoute, loading, navigate, userDoc]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    try {
      await signOutUser();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error(error);
      alert("Unable to sign out. Please try again.");
    }
  }

  if (isPublicRoute) return <Outlet />;

  if (loading || !authUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="enterprise-panel px-5 py-3 text-sm font-semibold text-slate-600">Loading workspace...</div>
      </div>
    );
  }

  const pageTitle = getPageTitle(location.pathname);
  const accountLabel = userDoc?.displayName ?? authUser.email ?? "Signed in user";
  const avatarText = initialsFromEmail(authUser.email);

  const sidebar = (
    <aside className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-3 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Workspace</p>
        <p className="mt-1 truncate text-sm font-extrabold text-slate-950">{pageTitle}</p>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        <div>
          <p className="px-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Main</p>
          <div className="mt-2 space-y-1">
            {visibleMainLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {visibleAdminLinks.length ? (
          <div>
            <p className="px-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Admin</p>
            <div className="mt-2 space-y-1">
              {visibleAdminLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-slate-200 p-2.5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <p className="truncate text-xs font-bold text-slate-900">{accountLabel}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              {userDoc?.role ?? "user"}
            </span>
            <button type="button" onClick={handleSignOut} className="text-xs font-bold text-slate-500 hover:text-red-600">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-50 bg-gradient-to-b from-primary to-accent1 text-white shadow-sm">
        <div className="relative mx-auto flex h-14 max-w-[1440px] items-center justify-between px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-white/15 px-3 text-sm font-bold text-white hover:bg-white/25 lg:hidden"
            aria-label="Open navigation"
          >
            Menu
          </button>

          <div className="hidden w-32 lg:block" />

          <Link to="/" className="absolute left-14 right-14 text-center sm:left-20 sm:right-20">
            <span className="block truncate text-lg font-extrabold tracking-tight sm:text-xl">M'SALEM Attendance Register</span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-48 truncate text-xs font-bold text-white">{accountLabel}</p>
              <p className="text-[11px] font-semibold text-white/75">{isApproved ? "Approved" : "Pending"}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-primary text-sm font-extrabold text-white shadow-sm">
              {avatarText}
            </div>
          </div>
        </div>
      </header>

      <div className="hidden lg:fixed lg:bottom-0 lg:left-0 lg:top-14 lg:block lg:w-60 lg:border-r lg:border-slate-200">{sidebar}</div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-slate-950/40" onClick={() => setMenuOpen(false)} />
          <div className="relative h-full w-80 max-w-[86vw] border-r border-slate-200 pt-14 shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <main className="mx-auto max-w-[1440px] px-3 py-3 sm:px-4 lg:py-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
