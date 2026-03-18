export const cls = (...values) => values.filter(Boolean).join(" ");

export function Field({ label, type = "text", value, onChange, placeholder, step, min, rows, inputRef, accept, disabled, readOnly }) {
  const shared = {
    className: "app-input mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none transition",
    value,
    onChange,
    placeholder,
    disabled,
    readOnly
  };

  return (
    <label className="app-label block text-sm">
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea {...shared} rows={rows || 4} />
      ) : type === "file" ? (
        <input
          ref={inputRef}
          className="app-file-input mt-2 block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-900"
          type="file"
          accept={accept}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <input {...shared} type={type} step={step} min={min} />
      )}
    </label>
  );
}

export function MetricCard({ label, value, note }) {
  return (
    <div className="metric-card rounded-[20px] p-5">
      <p className="metric-label text-xs uppercase tracking-[0.24em]">{label}</p>
      <p className="metric-value mt-3 text-xl font-semibold leading-tight lg:text-2xl">{value}</p>
      {note ? <p className="metric-note mt-2 text-sm">{note}</p> : null}
    </div>
  );
}

export function Banner({ tone = "info", children }) {
  const tones = {
    info: "border-sky-400/25 bg-sky-400/10 text-sky-100",
    warn: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    danger: "border-rose-400/25 bg-rose-400/10 text-rose-100",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
  };

  return <div className={cls("rounded-2xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function SectionCard({ title, eyebrow, children, actions }) {
  return (
    <section className="dashboard-shell min-w-0 rounded-[28px] border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">{eyebrow}</p> : null}
          <h2 className="section-title mt-2 text-2xl font-semibold">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state rounded-[22px] border border-dashed px-5 py-8 text-center">
      <p className="section-title text-lg font-semibold">{title}</p>
      <p className="section-copy mx-auto mt-2 max-w-xl text-sm leading-6">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
