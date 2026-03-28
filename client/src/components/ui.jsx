import { useId, useRef } from "react";
import { Link } from "react-router-dom";

export const cls = (...values) => values.filter(Boolean).join(" ");

export function QuickLink({ to, label, tone = "ghost", note }) {
  return (
    <Link className={tone === "primary" ? "primary-btn inline-flex items-center gap-2" : "ghost-btn inline-flex items-center gap-2"} to={to}>
      <span>{label}</span>
      {note ? <span className="text-xs opacity-70">{note}</span> : null}
    </Link>
  );
}

export function Field({ label, type = "text", value, onChange, placeholder, step, min, rows, inputRef, accept, multiple, disabled, readOnly, fileName, name, autoComplete, spellCheck }) {
  const fileRef = useRef(null);
  const fileId = useId();
  const shared = {
    className: "app-input mt-1.5 w-full px-3 py-2 text-sm outline-none transition",
    value,
    onChange,
    placeholder,
    disabled,
    readOnly,
    ...(name !== undefined && { name }),
    ...(autoComplete !== undefined && { autoComplete }),
    ...(spellCheck !== undefined && { spellCheck })
  };

  if (type === "file") {
    return (
      <div className="app-label block">
        <span>{label}</span>
        <input
          id={fileId}
          ref={inputRef || fileRef}
          className="hidden"
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={onChange}
          disabled={disabled}
        />
        <div className="mt-1.5 flex items-center gap-3">
          <label
            htmlFor={fileId}
            className={`ghost-btn shrink-0 px-4 py-2 text-sm cursor-pointer${disabled ? " opacity-50 pointer-events-none" : ""}`}
          >
            Choose File
          </label>
          <span className="text-sm text-slate-400 truncate">{fileName || "No file chosen"}</span>
        </div>
      </div>
    );
  }

  return (
    <label className="app-label block">
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea {...shared} rows={rows || 4} />
      ) : (
        <input {...shared} type={type} step={step} min={min} />
      )}
    </label>
  );
}

export function MetricCard({ label, value, note }) {
  return (
    <div className="metric-card min-w-0 rounded-lg p-4">
      <p className="metric-label truncate">{label}</p>
      <p className="metric-value mt-2 truncate text-lg font-semibold leading-tight lg:text-xl">{value}</p>
      {note ? <p className="metric-note mt-1.5 truncate text-xs">{note}</p> : null}
    </div>
  );
}

export function Banner({ tone = "info", children }) {
  const tones = {
    info: "border-sky-400/20 bg-sky-400/8 text-sky-200",
    warn: "border-amber-400/20 bg-amber-400/8 text-amber-200",
    danger: "border-rose-400/20 bg-rose-400/8 text-rose-200",
    success: "border-emerald-400/20 bg-emerald-400/8 text-emerald-200"
  };

  return <div className={cls("rounded-lg border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function SectionCard({ title, eyebrow, children, actions }) {
  return (
    <section className="dashboard-shell min-w-0 rounded-xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
          <h2 className="section-title mt-1.5 text-xl font-semibold">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state rounded-lg border border-dashed px-5 py-8 text-center">
      <p className="section-title text-base font-semibold">{title}</p>
      <p className="section-copy mx-auto mt-2 max-w-xl text-sm">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ActionMenu({ label = "Tools", items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <details className="relative">
      <summary className="ghost-btn inline-flex list-none cursor-pointer items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        {label}
        <svg className="h-3 w-3 opacity-60 transition-transform [[open]_&]:rotate-180" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-lg border border-white/10 bg-slate-950/98 p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-950/98">
        <div className="grid gap-0.5">
          {items.map((item) =>
            item.to ? (
              <Link
                key={`${item.label}-${item.to}`}
                className="rounded-md px-3 py-2 text-sm text-slate-200 transition hover:bg-white/8 hover:text-white"
                to={item.to}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                className="rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                onClick={item.onClick}
                disabled={item.disabled}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      </div>
    </details>
  );
}
