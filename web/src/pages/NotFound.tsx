import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <h1 className="text-xl font-extrabold">Page not found</h1>
        <p className="mt-1 text-xs text-white/70">The page you were looking for does not exist yet, or the link is incorrect.</p>
      </div>
      <div className="p-4">
        <Link to="/" className="enterprise-button-primary">
          Back to home
        </Link>
      </div>
    </div>
  );
}

