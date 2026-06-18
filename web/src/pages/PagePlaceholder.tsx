import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PagePlaceholderProps {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  children?: ReactNode;
}

export default function PagePlaceholder({ title, description, actionHref, actionLabel, children }: PagePlaceholderProps) {
  return (
    <div className="enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <h1 className="text-xl font-extrabold">{title}</h1>
        {description ? <p className="mt-1 text-xs text-white/70">{description}</p> : null}
      </div>
      <div className="p-4">
        {children}
        {actionHref ? (
          <Link to={actionHref} className="mt-4 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            {actionLabel ?? "Open page"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

