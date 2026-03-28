import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createClientId, formatCurrency, number } from "../lib/app.js";
import { EmptyState, Field, MetricCard, SectionCard, Banner } from "../components/ui.jsx";
import { DISCIPLINES, STANDARDS, refinePromptWithStandards } from "../lib/disciplines.js";
import { workspaceApi } from "../lib/workspaceApi.js";

const ESTIMATE_FIELD_SEQUENCE = ["material", "quantity", "unit", "unitPrice", "category", "payItem", "remarks"];

function QuickLink({ to, label, tone = "ghost" }) {
  return <Link className={tone === "primary" ? "primary-btn inline-flex items-center" : "ghost-btn inline-flex items-center"} to={to}>{label}</Link>;
}

function MiniStat({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/20 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
      <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">{label}</p>
      <p className="surface-title mt-2 text-base font-semibold">{value}</p>
      {note ? <p className="surface-copy mt-1 text-xs">{note}</p> : null}
    </div>
  );
}

function CommandChip({ active = false, children, ...props }) {
  return (
    <button
      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-sky-400/30 bg-sky-400/12 text-sky-200"
          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.06]"
      }`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

const DEMO_PROMPT_EXAMPLES = [
  "Generate a standard 60 sqm bungalow house estimate in Quezon City with 2 bedrooms, 1 bathroom, and complete residential finishes.",
  "Generate a premium 120 sqm 2-storey house estimate in Pasig City with 4 bedrooms, 3 bathrooms, and higher-end finishes.",
  "Generate a shell-only 120 sqm house estimate in Pasig City. Exclude electrical, plumbing, painting, doors, and windows.",
  "Generate an office fit-out estimate for a 180 sqm workspace in Makati with ceiling, lighting, flooring, and partitions.",
  "Generate a warehouse estimate for a 450 sqm storage building in Valenzuela with structural steel, rib-type roofing, and roll-up doors."
];


function buildPromptQuality(prompt = "", discipline = "") {
  const trimmed = prompt.trim();
  const value = trimmed.toLowerCase();
  const warnings = [];

  if (!trimmed) {
    warnings.push("Add a prompt so the draft generator has something to work from.");
    return { warnings, isReady: false };
  }

  // Civil/site works prompts use meters not sqm — skip area/type/finish checks
  const isCivil = discipline === "civil" ||
    /(waterline|drainage|road|rcp|manhole|catch basin|hydrant|gate valve|civil works|site development|subdivision)/i.test(value);
  if (isCivil) {
    return { warnings, isReady: true };
  }

  if (!/(\d+(?:\.\d+)?)\s*(sqm|sq\.?\s?m|m2)/i.test(trimmed)) {
    warnings.push("Include an area like 60 sqm so quantities scale more accurately.");
  }

  if (!/\bin\s+[a-zA-Z0-9,\s-]+/i.test(trimmed)) {
    warnings.push("Add a location so the draft reads like a real project brief.");
  }

  if (!/(house|bungalow|residential|fit out|fitout|office|warehouse|industrial|storage|retail|commercial)/i.test(value)) {
    warnings.push("Mention the project type, like bungalow, fit-out, office, or warehouse.");
  }

  if (!/(basic|standard|premium|high end|luxury|shell only|exclude)/i.test(value)) {
    warnings.push("Include a finish level or exclusions so the scope is clearer.");
  }

  return {
    warnings,
    isReady: warnings.length === 0
  };
}

function createPromptTemplateLabel(prompt) {
  return prompt
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 7)
    .join(" ");
}

function inferEstimateCategory({ name = "", unit = "" }) {
  const value = `${name} ${unit}`.toLowerCase();

  if (/(labor|worker|manpower|carpenter|mason|foreman|crew)/.test(value)) {
    return "Labor";
  }

  if (/(equipment|rental|excavator|mixer|vibrator|scaffold|scaffolding|backhoe|tool)/.test(value)) {
    return "Equipment";
  }

  return "Materials";
}

function ExportMenu({ exportBusy, disabled, onExportCsv, onExportPdf, onExportSummaryPdf, onExportDpwhPdf }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handle = (fn) => () => { setOpen(false); fn(); };

  return (
    <div className="relative" ref={ref}>
      <button
        className="ghost-btn"
        type="button"
        disabled={disabled || exportBusy}
        onClick={() => setOpen((v) => !v)}
      >
        {exportBusy ? "Exporting..." : "Export ▾"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-white/10 bg-[#1a1f2e] py-1 shadow-xl">
          {[
            { label: "Export CSV", fn: onExportCsv },
            { label: "Export PDF", fn: onExportPdf },
            { label: "Summary PDF", fn: onExportSummaryPdf },
            { label: "DPWH BOQ", fn: onExportDpwhPdf }
          ].map(({ label, fn }) => (
            <button
              key={label}
              className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06] transition"
              type="button"
              onClick={handle(fn)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EstimateWorkspaceHeader({
  selectedEstimate,
  currencyCode,
  data,
  selectedEstimateId,
  setSelectedEstimateId,
  onDeleteEstimate,
  hasUnsavedChanges,
  patchBusy,
  saveDisabled,
  onPatchEstimate,
  exportBusy,
  marketRefreshBusy,
  canRefreshMarketPrices,
  onRefreshEstimateMarketPrices,
  onExportSummaryPdf,
  onExportDpwhPdf
}) {
  const finalPrice = selectedEstimate?.finalContractPrice || 0;
  const location = selectedEstimate?.location;
  const status = selectedEstimate?.status || "Draft";
  const statusClass =
    status === "Approved"
      ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : status === "Reviewed"
        ? "border border-sky-400/20 bg-sky-400/10 text-sky-200"
        : "border border-sky-400/20 bg-sky-400/10 text-sky-200";

  return (
    <div className="hero-panel rounded-[28px] p-6">
      <div className="relative z-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Estimate Workspace</p>
            <p className="hero-title mt-2 text-3xl font-semibold leading-tight">
              {selectedEstimate
                ? formatCurrency(finalPrice, currencyCode, location)
                : "No estimate yet"}
            </p>
            {selectedEstimate ? (
              <p className="hero-copy mt-2 max-w-2xl text-sm leading-6 line-clamp-2">{selectedEstimate.prompt}</p>
            ) : (
              <p className="hero-copy mt-2 text-sm">Generate a draft in Step 1 to unlock the workspace.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedEstimate ? (
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusClass}`}>
                {status}
              </span>
            ) : null}
            {data.estimates.length > 1 ? (
              <EstimateSwitcher
                estimates={data.estimates}
                selectedId={selectedEstimateId || data.estimates[0]?.id}
                onSelect={setSelectedEstimateId}
                onDelete={onDeleteEstimate}
              />
            ) : null}
            <button
              className="ghost-btn"
              type="button"
              onClick={onRefreshEstimateMarketPrices}
              disabled={marketRefreshBusy || !canRefreshMarketPrices || !selectedEstimate}
            >
              {marketRefreshBusy ? "Refreshing..." : "Refresh Prices"}
            </button>
            <ExportMenu
              exportBusy={exportBusy}
              disabled={!selectedEstimate}
              onExportCsv={() => onPatchEstimate("csv")}
              onExportPdf={() => onPatchEstimate("pdf")}
              onExportSummaryPdf={onExportSummaryPdf}
              onExportDpwhPdf={onExportDpwhPdf}
            />
            <button
              className="primary-btn"
              type="button"
              onClick={() => onPatchEstimate(false)}
              disabled={saveDisabled}
            >
              {patchBusy ? "Saving..." : hasUnsavedChanges ? "Save Changes" : "Saved"}
            </button>
          </div>
        </div>
        {selectedEstimate ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Direct Cost" value={formatCurrency(selectedEstimate.directCost || 0, currencyCode, location)} />
            <MetricCard label="Final Price" value={formatCurrency(selectedEstimate.finalContractPrice || 0, currencyCode, location)} />
            <MetricCard label="Waste" value={`${number.format(selectedEstimate.wasteFactorPercent || 0)}%`} />
            <MetricCard label="Labor" value={formatCurrency(selectedEstimate.laborCost || 0, currencyCode, location)} />
            <MetricCard label="Equipment" value={formatCurrency(selectedEstimate.equipmentCost || 0, currencyCode, location)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}



function InsightCard({ eyebrow, title, children, aside }) {
  return (
    <div className="surface-card rounded-[22px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">{eyebrow}</p> : null}
          <h3 className="surface-title mt-2 text-lg font-semibold">{title}</h3>
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EstimateContextPanel({ selectedEstimate, data, currencyCode }) {
  if (!selectedEstimate) {
    return null;
  }

  const project = data.projects.find((entry) => entry.id === selectedEstimate.projectId) || data.currentProject;
  const baseLocation = selectedEstimate.location || project?.location;
  const template = data.templates[0] || null;
  const categoryTotals = (selectedEstimate.items || []).reduce(
    (totals, item) => {
      const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      totals[item.category] = (totals[item.category] || 0) + subtotal;
      return totals;
    },
    { Materials: 0, Labor: 0, Equipment: 0 }
  );
  const directCost = Number(selectedEstimate.directCost) || 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
      <div className="surface-card rounded-[24px] p-5">
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Estimate Basis</p>
        <h3 className="surface-title mt-2 text-xl font-semibold">{project?.name || "Current estimate"}</h3>
        <p className="surface-copy mt-2 text-sm leading-6">{selectedEstimate.prompt}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="surface-meta text-xs uppercase tracking-[0.2em]">Project</p>
            <p className="surface-copy mt-1 text-sm">
              {project ? `${project.location} / ${number.format(project.areaSqm)} sqm` : "No linked project"}
            </p>
          </div>
          <div>
            <p className="surface-meta text-xs uppercase tracking-[0.2em]">Template</p>
            <p className="surface-copy mt-1 text-sm">{template?.name || "Default template"}</p>
          </div>
          <div>
            <p className="surface-meta text-xs uppercase tracking-[0.2em]">Status</p>
            <p className="surface-copy mt-1 text-sm">{selectedEstimate.status || "Draft"}</p>
          </div>
          <div>
            <p className="surface-meta text-xs uppercase tracking-[0.2em]">Created</p>
            <p className="surface-copy mt-1 text-sm">{selectedEstimate.createdAt ? new Date(selectedEstimate.createdAt).toLocaleString() : "N/A"}</p>
          </div>
          <div>
            <p className="surface-meta text-xs uppercase tracking-[0.2em]">Items</p>
            <p className="surface-copy mt-1 text-sm">{number.format(selectedEstimate.items?.length || 0)} BOQ rows</p>
          </div>
          {selectedEstimate.documentId ? (() => {
            const srcDoc = data.documents?.find((d) => d.id === selectedEstimate.documentId);
            return (
              <div>
                <p className="surface-meta text-xs uppercase tracking-[0.2em]">Source Document</p>
                <p className="surface-copy mt-1 text-sm">{srcDoc ? srcDoc.filename : "Linked document"}</p>
              </div>
            );
          })() : null}
          {selectedEstimate.discipline ? (
            <div>
              <p className="surface-meta text-xs uppercase tracking-[0.2em]">Discipline</p>
              <p className="surface-copy mt-1 text-sm capitalize">{selectedEstimate.discipline}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="surface-card rounded-[24px] p-5">
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Cost Review</p>
        <h3 className="surface-title mt-2 text-xl font-semibold">Current draft mix</h3>
        <div className="mt-4 space-y-3">
          {["Materials", "Labor", "Equipment"].map((category) => {
            const total = categoryTotals[category] || 0;
            const share = directCost > 0 ? Math.round((total / directCost) * 100) : 0;
            return (
              <div key={category} className="rounded-[18px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <p className="surface-title text-sm font-semibold">{category}</p>
                  <p className="surface-title text-sm font-semibold">{formatCurrency(total, currencyCode, baseLocation)}</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-black/10 dark:bg-white/8">
                  <div className="h-full rounded-full bg-sky-500/80" style={{ width: `${Math.min(share, 100)}%` }} />
                </div>
                <p className="surface-meta mt-2 text-xs uppercase tracking-[0.2em]">{share}% of direct cost</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatEstimateSaveTime(value) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EstimateSaveStatus({ hasUnsavedChanges, invalidRowsExist, patchBusy, selectedEstimate, currencyCode }) {
  const lastSavedAt = selectedEstimate?.updatedAt || selectedEstimate?.createdAt;
  const saveState = patchBusy
    ? "Saving estimate..."
    : invalidRowsExist
      ? "Action needed"
      : hasUnsavedChanges
        ? "Unsaved changes"
        : "All changes saved";

  const saveTone = patchBusy ? "info" : invalidRowsExist ? "warn" : hasUnsavedChanges ? "info" : "success";
  const draftValue = selectedEstimate?.finalContractPrice || 0;

  return (
    <div className="dashboard-shell rounded-xl border p-4 space-y-4">
      <Banner tone={saveTone}>
        <p className="text-[11px] uppercase tracking-[0.12em] opacity-70">Save Status</p>
        <p className="mt-1 text-sm font-semibold">{saveState}</p>
        <p className="mt-1 text-xs opacity-80">
          {patchBusy
            ? "Recalculating totals and syncing."
            : invalidRowsExist
              ? "Resolve the highlighted rows before saving."
              : hasUnsavedChanges
                ? "BOQ edits are local until you save."
                : "This draft matches the latest saved estimate."}
        </p>
      </Banner>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Last Saved" value={formatEstimateSaveTime(lastSavedAt)} />
        <MetricCard label="Draft Value" value={formatCurrency(draftValue, currencyCode, selectedEstimate?.location)} />
        <MetricCard
          label="Export"
          value={invalidRowsExist ? "Blocked" : hasUnsavedChanges ? "Needs Save" : "Ready"}
          note={invalidRowsExist ? "Fix rows first" : hasUnsavedChanges ? "Save first" : "PDF aligned"}
        />
      </div>
    </div>
  );
}

function EstimateApprovalPanel({
  selectedEstimate,
  onUpdateEstimateStatus,
  statusBusy,
  canManageStatus,
  canApproveEstimate,
  isReadOnlyApproved
}) {
  if (!selectedEstimate) {
    return null;
  }

  const status = selectedEstimate.status || "Draft";
  const statusTone = status === "Approved" ? "success" : status === "Reviewed" ? "info" : "warn";
  const availableActions = [
    status !== "Draft" ? { label: "Mark Draft", value: "Draft", allowed: canManageStatus } : null,
    status !== "Reviewed" ? { label: "Mark Reviewed", value: "Reviewed", allowed: canManageStatus } : null,
    status !== "Approved" ? { label: "Approve Estimate", value: "Approved", allowed: canApproveEstimate } : null
  ].filter(Boolean);

  return (
    <InsightCard
      eyebrow="Approval"
      title="Sign-off status"
      aside={
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
          status === "Approved"
            ? "bg-emerald-400/10 text-emerald-200 border border-emerald-400/20"
            : status === "Reviewed"
              ? "bg-sky-400/10 text-sky-200 border border-sky-400/20"
              : "bg-sky-400/10 text-sky-200 border border-sky-400/20"
        }`}>
          {status}
        </span>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <MetricCard label="Status" value={status} />
        <MetricCard label="Reviewed" value={selectedEstimate.reviewedAt ? formatEstimateSaveTime(selectedEstimate.reviewedAt) : "Not yet"} />
        <MetricCard label="Approved" value={selectedEstimate.approvedAt ? formatEstimateSaveTime(selectedEstimate.approvedAt) : "Not yet"} />
        <MetricCard label="Approval Lock" value={isReadOnlyApproved ? "Read only" : "Editable"} />
      </div>
      <div className="mt-4">
        <Banner tone={statusTone}>
          {status === "Approved"
            ? "This estimate is approved. Estimators can review and export it, while admins can still reopen it if changes are required."
            : status === "Reviewed"
              ? "This estimate is ready for admin approval once the totals and scope are confirmed."
              : "This estimate is still a draft and can be refined before review."}
        </Banner>
      </div>
      {availableActions.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {availableActions.map((action) => (
            <button
              key={action.value}
              className={action.value === "Approved" ? "primary-btn" : "ghost-btn"}
              type="button"
              onClick={() => onUpdateEstimateStatus(selectedEstimate.id, action.value)}
              disabled={statusBusy || !action.allowed}
            >
              {statusBusy ? "Updating..." : action.allowed ? action.label : action.value === "Approved" ? "Admin Approval Only" : "Status Locked"}
            </button>
          ))}
        </div>
      ) : null}
    </InsightCard>
  );
}

function MarketRefreshReview({ result, currencyCode, location }) {
  if (!result) {
    return null;
  }

  const modeLabel = result.mode === "catalog" ? "Workspace catalog" : "Live web search";

  return (
    <InsightCard
      eyebrow="Live Market Refresh"
      title="Recent price update"
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
            {modeLabel}
          </span>
          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
            {result.refreshedCount} rows updated
          </span>
        </div>
      }
    >
      <p className="surface-copy text-sm leading-6">{result.summary}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MetricCard label="Rows Refreshed" value={number.format(result.refreshedCount || 0)} />
        <MetricCard label="Source Count" value={number.format(result.sources?.length || 0)} />
      </div>
      {result.updates?.length ? (
        <div className="mt-4 rounded-[18px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">Sample updates</p>
          <div className="mt-3 grid gap-2">
            {result.updates.slice(0, 4).map((update) => (
              <div key={`${update.index}-${update.unitPrice}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-black/5 bg-white/30 px-3 py-2 text-sm dark:border-white/8 dark:bg-white/[0.04]">
                <div>
                  <p className="surface-title font-semibold">Row {update.index + 1}</p>
                  <p className="surface-copy text-xs">{update.supplier || "Market average"} / {update.rationale}</p>
                </div>
                <p className="surface-title font-semibold">{formatCurrency(update.unitPrice || 0, currencyCode, location)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {result.sources?.length ? (
        <div className="mt-4">
          <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">Sources</p>
          <div className="mt-3 flex flex-col gap-2">
            {result.sources.slice(0, 6).map((source) => (
              <a
                key={source.url}
                className="rounded-[14px] border border-black/5 bg-white/20 px-4 py-3 text-sm transition hover:border-sky-400/30 hover:bg-white/30 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                <p className="surface-title font-semibold">{source.title}</p>
                <p className="surface-copy mt-1 break-all text-xs">{source.siteName || source.url}</p>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </InsightCard>
  );
}

function GeneratedDraftReview({ estimate, data, currencyCode }) {
  if (!estimate) {
    return null;
  }

  const project = data.projects.find((entry) => entry.id === estimate.projectId);
  const categoryCounts = estimate.items.reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + 1;
    return totals;
  }, { Materials: 0, Labor: 0, Equipment: 0 });

  return (
    <div className="surface-card rounded-[20px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">New Draft Review</p>
          <h3 className="surface-title mt-2 text-base font-semibold">
            {project?.name || "Generated estimate"} is ready to refine
          </h3>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          Generated
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Rows" value={number.format(estimate.items.length)} />
        <MetricCard label="Direct Cost" value={formatCurrency(estimate.directCost || 0, currencyCode, estimate.location)} />
        <MetricCard label="Final Price" value={formatCurrency(estimate.finalContractPrice || 0, currencyCode, estimate.location)} />
        <MetricCard label="Location" value={estimate.location || "Metro Manila"} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[16px] border border-black/5 bg-white/20 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
          <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">Materials</p>
          <p className="surface-title mt-2 text-sm font-semibold">{number.format(categoryCounts.Materials || 0)} line items</p>
        </div>
        <div className="rounded-[16px] border border-black/5 bg-white/20 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
          <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">Labor</p>
          <p className="surface-title mt-2 text-sm font-semibold">{number.format(categoryCounts.Labor || 0)} line items</p>
        </div>
        <div className="rounded-[16px] border border-black/5 bg-white/20 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
          <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">Equipment</p>
          <p className="surface-title mt-2 text-sm font-semibold">{number.format(categoryCounts.Equipment || 0)} line items</p>
        </div>
      </div>
    </div>
  );
}

function validateEstimateItem(item) {
  const issues = [];

  if (!String(item.material || "").trim()) {
    issues.push("Material name is required");
  }

  if (!(Number(item.quantity) > 0)) {
    issues.push("Quantity must be greater than 0");
  }

  if (!String(item.unit || "").trim()) {
    issues.push("Unit is required");
  }

  if (!(Number(item.unitPrice) >= 0)) {
    issues.push("Unit price cannot be negative");
  }

  return issues;
}

function hasInvalidEstimateRows(items = []) {
  return items.some((item) => validateEstimateItem(item).length);
}

function normalizeEstimateForCompare(estimate = {}) {
  return JSON.stringify({
    location: estimate.location || "",
    areaSqm: String(estimate.areaSqm ?? ""),
    wasteFactorPercent: String(estimate.wasteFactorPercent ?? ""),
    overheadPercent: String(estimate.overheadPercent ?? ""),
    profitPercent: String(estimate.profitPercent ?? ""),
    contingencyPercent: String(estimate.contingencyPercent ?? ""),
    items: (estimate.items || []).map((item) => ({
      material: item.material || "",
      quantity: String(item.quantity ?? ""),
      unit: item.unit || "",
      unitPrice: String(item.unitPrice ?? ""),
      category: item.category || "Materials"
    }))
  });
}

function getPriceRefreshMeta(item) {
  if (!item?._priceRefresh) {
    return null;
  }

  const previous = Number(item._priceRefresh.previousUnitPrice);
  const current = Number(item.unitPrice);

  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === current) {
    return null;
  }

  return {
    previous,
    current,
    delta: current - previous,
    supplier: item._priceRefresh.supplier || "",
    rationale: item._priceRefresh.rationale || ""
  };
}

function PriceDeltaBadge({ item, currencyCode, location, compact = false }) {
  const meta = getPriceRefreshMeta(item);

  if (!meta) {
    return null;
  }

  const increased = meta.delta > 0;
  const toneClass = increased
    ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";

  return (
    <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
      {increased ? "+" : ""}{formatCurrency(meta.delta, currencyCode, location)}
      {!compact ? ` vs ${formatCurrency(meta.previous, currencyCode, location)}` : ""}
    </div>
  );
}

function PriceRefreshRowActions({ item, onAccept, onUndo }) {
  const meta = getPriceRefreshMeta(item);

  if (!meta) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button className="ghost-btn px-3 py-1.5 text-[11px]" type="button" onClick={onAccept}>
        Keep Change
      </button>
      <button className="ghost-btn px-3 py-1.5 text-[11px]" type="button" onClick={onUndo}>
        Undo Change
      </button>
    </div>
  );
}

function RowActionButton({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-100 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-sky-400/40 dark:hover:bg-sky-400/10 ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

function ActionIcon({ type }) {
  const iconClassName = "h-3.5 w-3.5";

  if (type === "copy") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClassName} aria-hidden="true">
        <rect x="5" y="3" width="8" height="10" rx="2" />
        <path d="M3 11V5a2 2 0 0 1 2-2" />
      </svg>
    );
  }

  if (type === "up") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClassName} aria-hidden="true">
        <path d="M8 12V4" />
        <path d="m4.5 7.5 3.5-3.5 3.5 3.5" />
      </svg>
    );
  }

  if (type === "down") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClassName} aria-hidden="true">
        <path d="M8 4v8" />
        <path d="m4.5 8.5 3.5 3.5 3.5-3.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={iconClassName} aria-hidden="true">
      <path d="m4 4 8 8" />
      <path d="M12 4 4 12" />
    </svg>
  );
}

function EstimateRowFields({
  item,
  index,
  setEditEstimate,
  currencyCode,
  baseLocation,
  compact = false,
  onFieldKeyDown,
  editable = true,
  onAcceptPriceRefresh,
  onUndoPriceRefresh
}) {
  const issues = validateEstimateItem(item);
  const hasMaterialIssue = issues.some((issue) => issue.includes("Material"));
  const hasQuantityIssue = issues.some((issue) => issue.includes("Quantity"));
  const hasUnitIssue = issues.some((issue) => issue.includes("Unit is required"));
  const hasUnitPriceIssue = issues.some((issue) => issue.includes("Unit price"));
  const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

  const updateItem = (updates) =>
    setEditEstimate((current) => ({
      ...current,
      items: current.items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...updates } : entry))
    }));

  if (!compact) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <p className="surface-meta text-[11px] uppercase tracking-[0.2em]">Material</p>
        <input
          className={`app-input w-full rounded-xl px-3 py-2 ${hasMaterialIssue ? "border-rose-400/60" : ""}`}
          value={item.material}
          disabled={!editable}
          onChange={(event) => updateItem({ material: event.target.value })}
          onKeyDown={(event) => onFieldKeyDown?.(event, { rowId: item._rowId, rowIndex: index, field: "material", category: item.category })}
          data-estimate-row-id={item._rowId}
          data-estimate-field="material"
        />
        {hasMaterialIssue ? <p className="mt-2 text-xs text-rose-300">Material name is required</p> : null}
      </div>
      <div className="space-y-2">
        <p className="surface-meta text-[11px] uppercase tracking-[0.2em]">Quantity</p>
        <input
          className={`app-input w-full rounded-xl px-3 py-2 ${hasQuantityIssue ? "border-rose-400/60" : ""}`}
          type="number"
          min="0"
          step="0.01"
          value={item.quantity}
          disabled={!editable}
          onChange={(event) => updateItem({ quantity: event.target.value })}
          onKeyDown={(event) => onFieldKeyDown?.(event, { rowId: item._rowId, rowIndex: index, field: "quantity", category: item.category })}
          data-estimate-row-id={item._rowId}
          data-estimate-field="quantity"
        />
        {hasQuantityIssue ? <p className="mt-2 text-xs text-rose-300">Use a quantity above 0</p> : null}
      </div>
      <div className="space-y-2">
        <p className="surface-meta text-[11px] uppercase tracking-[0.2em]">Unit</p>
        <input
          className={`app-input w-full rounded-xl px-3 py-2 ${hasUnitIssue ? "border-rose-400/60" : ""}`}
          value={item.unit}
          disabled={!editable}
          onChange={(event) => updateItem({ unit: event.target.value })}
          onKeyDown={(event) => onFieldKeyDown?.(event, { rowId: item._rowId, rowIndex: index, field: "unit", category: item.category })}
          data-estimate-row-id={item._rowId}
          data-estimate-field="unit"
        />
        {hasUnitIssue ? <p className="mt-2 text-xs text-rose-300">Unit is required</p> : null}
      </div>
      <div className="space-y-2">
        <p className="surface-meta text-[11px] uppercase tracking-[0.2em]">Unit Price</p>
        <input
          className={`app-input w-full rounded-xl px-3 py-2 ${hasUnitPriceIssue ? "border-rose-400/60" : ""}`}
          type="number"
          min="0"
          step="0.01"
          value={item.unitPrice}
          disabled={!editable}
          onChange={(event) => updateItem({ unitPrice: event.target.value })}
          onKeyDown={(event) => onFieldKeyDown?.(event, { rowId: item._rowId, rowIndex: index, field: "unitPrice", category: item.category })}
          data-estimate-row-id={item._rowId}
          data-estimate-field="unitPrice"
        />
        {hasUnitPriceIssue ? <p className="mt-2 text-xs text-rose-300">Unit price cannot be negative</p> : null}
      </div>
      <div className="space-y-2">
        <p className="surface-meta text-[11px] uppercase tracking-[0.2em]">Category</p>
        <select
          className="app-input w-full rounded-xl px-3 py-2"
          value={item.category}
          disabled={!editable}
          onChange={(event) => updateItem({ category: event.target.value })}
          onKeyDown={(event) => onFieldKeyDown?.(event, { rowId: item._rowId, rowIndex: index, field: "category", category: item.category })}
          data-estimate-row-id={item._rowId}
          data-estimate-field="category"
        >
          {["Materials", "Labor", "Equipment"].map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-[18px] border border-black/5 bg-white/20 px-4 py-3 sm:col-span-2 dark:border-white/8 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="surface-meta text-[11px] uppercase tracking-[0.2em]">Subtotal</p>
            <p className="surface-title text-sm font-semibold">{formatCurrency(subtotal, currencyCode, baseLocation)}</p>
          </div>
          <div className="flex items-center gap-2">
            {item._aiSuggested ? (
              <span className="rounded border border-sky-400/20 bg-sky-400/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-300">
                AI
              </span>
            ) : null}
            <PriceDeltaBadge item={item} currencyCode={currencyCode} location={baseLocation} compact />
          </div>
        </div>
        <p className="surface-meta mt-1 text-xs uppercase tracking-[0.2em]">
          {Number(item.quantity) || 0} x {formatCurrency(item.unitPrice || 0, currencyCode, baseLocation)}
        </p>
        {getPriceRefreshMeta(item)?.supplier ? (
          <p className="surface-copy mt-2 text-xs">{getPriceRefreshMeta(item).supplier} / {getPriceRefreshMeta(item).rationale}</p>
        ) : null}
        {editable && (onAcceptPriceRefresh || onUndoPriceRefresh) ? (
          <PriceRefreshRowActions item={item} onAccept={() => onAcceptPriceRefresh?.(index)} onUndo={() => onUndoPriceRefresh?.(index)} />
        ) : null}
      </div>
    </div>
  );
}

function LockIcon({ locked }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
      {locked ? (
        <>
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5 7V5a3 3 0 0 1 6 0v2" />
        </>
      ) : (
        <>
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5 7V5a3 3 0 0 1 5.5-.5" />
        </>
      )}
    </svg>
  );
}

function EstimateRowActions({ index, totalItems, setEditEstimate, item, compact = false, editable = true }) {
  const isLocked = item?.locked || false;

  const toggleLock = () =>
    setEditEstimate((current) => ({
      ...current,
      items: current.items.map((entry, i) => i === index ? { ...entry, locked: !entry.locked } : entry)
    }));

  const duplicate = () =>
    setEditEstimate((current) => {
      const nextItems = [...current.items];
      nextItems.splice(index + 1, 0, {
        ...current.items[index],
        _rowId: createClientId("estimate-row")
      });
      return { ...current, items: nextItems };
    });

  const moveUp = () =>
    setEditEstimate((current) => {
      if (index === 0) {
        return current;
      }
      const nextItems = [...current.items];
      [nextItems[index - 1], nextItems[index]] = [nextItems[index], nextItems[index - 1]];
      return { ...current, items: nextItems };
    });

  const moveDown = () =>
    setEditEstimate((current) => {
      if (index === current.items.length - 1) {
        return current;
      }
      const nextItems = [...current.items];
      [nextItems[index + 1], nextItems[index]] = [nextItems[index], nextItems[index + 1]];
      return { ...current, items: nextItems };
    });

  const remove = () =>
    setEditEstimate((current) => ({
      ...current,
      items: current.items.filter((_, entryIndex) => entryIndex !== index)
    }));

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "inline-flex items-center rounded-full border border-white/8 bg-white/[0.02] px-1.5 py-1 gap-1"}>
      <RowActionButton
        aria-label={isLocked ? "Unlock row quantity" : "Lock row quantity"}
        title={isLocked ? "Locked — click to unlock quantity" : "Lock quantity (skip bulk reprice)"}
        onClick={toggleLock}
        className={isLocked ? "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:border-amber-400/60" : ""}
      >
        <LockIcon locked={isLocked} />
      </RowActionButton>
      <RowActionButton aria-label="Copy row" title="Copy row" onClick={duplicate} disabled={!editable}><ActionIcon type="copy" /></RowActionButton>
      <RowActionButton aria-label="Move row up" title="Move row up" onClick={moveUp} disabled={!editable || index === 0}><ActionIcon type="up" /></RowActionButton>
      <RowActionButton aria-label="Move row down" title="Move row down" onClick={moveDown} disabled={!editable || index === totalItems - 1}><ActionIcon type="down" /></RowActionButton>
      <RowActionButton aria-label="Delete row" title="Delete row" onClick={remove} disabled={!editable}><ActionIcon type="delete" /></RowActionButton>
    </div>
  );
}

function EditableEstimateTable({ editEstimate, setEditEstimate, currencyCode, baseLocation, editable = true }) {
  const [collapsedGroups, setCollapsedGroups] = useState({
    Materials: false,
    Labor: false,
    Equipment: false
  });
  const itemTotal = (item) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const estimateTotal = (editEstimate.items || []).reduce((sum, item) => sum + itemTotal(item), 0);
  const invalidRowCount = (editEstimate.items || []).filter((item) => validateEstimateItem(item).length).length;
  const refreshedRowCount = (editEstimate.items || []).filter((item) => getPriceRefreshMeta(item)).length;
  const refreshedRows = (editEstimate.items || []).filter((item) => getPriceRefreshMeta(item));
  const totalRefreshDelta = refreshedRows.reduce((sum, item) => {
    const meta = getPriceRefreshMeta(item);
    const quantity = Number(item.quantity) || 0;
    return sum + ((meta?.delta || 0) * quantity);
  }, 0);
  const refreshedMaterialsCount = new Set(refreshedRows.map((item) => item.material)).size;
  const acceptPriceRefresh = (rowIndex) =>
    setEditEstimate((current) => ({
      ...current,
      items: current.items.map((item, index) => {
        if (index !== rowIndex || !item._priceRefresh) {
          return item;
        }

        const nextItem = { ...item };
        delete nextItem._priceRefresh;
        return nextItem;
      })
    }));
  const undoPriceRefresh = (rowIndex) =>
    setEditEstimate((current) => ({
      ...current,
      items: current.items.map((item, index) => {
        if (index !== rowIndex || !item._priceRefresh) {
          return item;
        }

        const nextItem = {
          ...item,
          unitPrice: item._priceRefresh.previousUnitPrice
        };
        delete nextItem._priceRefresh;
        return nextItem;
      })
    }));
  const acceptAllPriceRefreshes = () =>
    setEditEstimate((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (!item._priceRefresh) {
          return item;
        }

        const nextItem = { ...item };
        delete nextItem._priceRefresh;
        return nextItem;
      })
    }));
  const undoAllPriceRefreshes = () =>
    setEditEstimate((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (!item._priceRefresh) {
          return item;
        }

        const nextItem = {
          ...item,
          unitPrice: item._priceRefresh.previousUnitPrice
        };
        delete nextItem._priceRefresh;
        return nextItem;
      })
    }));
  const focusEstimateField = (rowId, field) => {
    window.requestAnimationFrame(() => {
      const candidates = Array.from(
        document.querySelectorAll(`[data-estimate-row-id="${rowId}"][data-estimate-field="${field}"]`)
      );
      const target = candidates.find((entry) => entry.offsetParent !== null) || candidates[0];
      if (!target) {
        return;
      }
      target.focus();
      if (typeof target.select === "function") {
        target.select();
      }
    });
  };
  const onEstimateFieldKeyDown = (event, { rowIndex, field, category }) => {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    const currentFieldIndex = ESTIMATE_FIELD_SEQUENCE.indexOf(field);
    const nextFieldIndex = currentFieldIndex + direction;
    const currentItems = editEstimate.items || [];

    if (nextFieldIndex >= 0 && nextFieldIndex < ESTIMATE_FIELD_SEQUENCE.length) {
      focusEstimateField(currentItems[rowIndex]?._rowId, ESTIMATE_FIELD_SEQUENCE[nextFieldIndex]);
      return;
    }

    const nextRow = currentItems[rowIndex + direction];
    if (nextRow) {
      const targetField = direction === 1 ? ESTIMATE_FIELD_SEQUENCE[0] : ESTIMATE_FIELD_SEQUENCE[ESTIMATE_FIELD_SEQUENCE.length - 1];
      focusEstimateField(nextRow._rowId, targetField);
      return;
    }

    if (direction === 1) {
      const newRowId = createClientId("estimate-row");
      setEditEstimate((current) => ({
        ...current,
        items: [
          ...current.items,
          {
            _rowId: newRowId,
            material: "",
            quantity: 1,
            unit: "",
            unitPrice: 0,
            category: category || "Materials",
            remarks: "",
            payItem: "",
            locked: false,
            qtoFormula: ""
          }
        ]
      }));
      focusEstimateField(newRowId, ESTIMATE_FIELD_SEQUENCE[0]);
    }
  };
  const addRowToCategory = (category) => {
    const newRowId = createClientId("estimate-row");
    setEditEstimate((current) => ({
      ...current,
      items: [
        ...current.items,
        { _rowId: newRowId, material: "", quantity: 1, unit: "", unitPrice: 0, category, remarks: "", payItem: "", locked: false, qtoFormula: "" }
      ]
    }));
    focusEstimateField(newRowId, ESTIMATE_FIELD_SEQUENCE[0]);
  };
  const groupedItems = ["Materials", "Labor", "Equipment"].map((category) => ({
    category,
    items: (editEstimate.items || [])
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.category === category),
    total: (editEstimate.items || [])
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + itemTotal(item), 0)
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Row Count" value={number.format(editEstimate.items?.length || 0)} />
        <MetricCard
          label="Draft Total"
          value={formatCurrency(estimateTotal, currencyCode, baseLocation)}
          note="Live — updates before save"
        />
        {groupedItems.map((group) => (
          <MetricCard
            key={group.category}
            label={`${group.category}`}
            value={formatCurrency(group.total, currencyCode, baseLocation)}
            note={`${number.format(group.items.length)} rows`}
          />
        ))}
      </div>
      {invalidRowCount ? (
        <Banner tone="warn">
          {number.format(invalidRowCount)} estimate row{invalidRowCount === 1 ? "" : "s"} need attention before save.
        </Banner>
      ) : null}
      {refreshedRowCount ? (
        <Banner tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {number.format(refreshedRowCount)} BOQ row{refreshedRowCount === 1 ? "" : "s"} have refreshed market pricing. Review the blue-highlighted unit prices before saving.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="ghost-btn px-3 py-1.5 text-[11px]" type="button" onClick={acceptAllPriceRefreshes}>
                Keep All
              </button>
              <button className="ghost-btn px-3 py-1.5 text-[11px]" type="button" onClick={undoAllPriceRefreshes}>
                Undo All
              </button>
            </div>
          </div>
        </Banner>
      ) : null}
      {refreshedRowCount ? (
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Refreshed Rows" value={number.format(refreshedRowCount)} note={`${number.format(refreshedMaterialsCount)} unique materials`} />
          <MetricCard
            label="Refresh Impact"
            value={formatCurrency(totalRefreshDelta, currencyCode, baseLocation)}
            note={totalRefreshDelta >= 0 ? "Increase vs previous draft pricing" : "Decrease vs previous draft pricing"}
          />
          <MetricCard
            label="Current Draft Total"
            value={formatCurrency(estimateTotal, currencyCode, baseLocation)}
            note="Includes refreshed prices that are still pending review"
          />
        </div>
      ) : null}
      <div className="rounded-[18px] border border-dashed border-black/10 bg-white/30 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-300">
        Press <span className="font-semibold">Enter</span> to move to the next field, <span className="font-semibold">Shift + Enter</span> to move back, and pressing Enter on the last field creates a new row.
      </div>
      <div className="space-y-5">
        {groupedItems.map((group) => (
          <div key={group.category} className="table-shell overflow-x-auto rounded-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-4 dark:border-white/8">
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300 dark:text-sky-200">
                  {group.category}
                </div>
                <div>
                  <p className="surface-title text-base font-semibold">{formatCurrency(group.total, currencyCode, baseLocation)}</p>
                  <p className="surface-meta mt-1 text-xs uppercase tracking-[0.2em]">{number.format(group.items.length)} rows in this section</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="ghost-btn px-4 py-2 text-xs"
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((current) => ({
                      ...current,
                      [group.category]: !current[group.category]
                    }))
                  }
                >
                  {collapsedGroups[group.category] ? "Expand" : "Collapse"}
                </button>
              </div>
            </div>
            {!collapsedGroups[group.category] ? (
            <>
            <table className="min-w-[1200px] w-full text-[13px] leading-5">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead className="table-head text-left">
                <tr>
                  {["Material", "Qty", "Unit", "Unit Price", "Subtotal", "Category", "Pay Item", "Remarks", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium uppercase tracking-[0.16em]">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.length ? (
                  group.items.map(({ item, index }) => (
                    <tr key={item._rowId || index} className={`table-row align-top hidden md:table-row${item.locked ? " opacity-80 bg-amber-400/[0.03]" : ""}`}>
                      <td className="px-4 py-3">
                        {(() => {
                          const issues = validateEstimateItem(item);
                          const invalid = issues.some((issue) => issue.includes("Material"));
                          return (
                            <>
                              <input
                                className={`app-input w-full min-w-[140px] rounded-xl px-3 py-2 text-sm ${invalid ? "border-rose-400/60" : ""}`}
                                value={item.material}
                                disabled={!editable}
                                onChange={(event) =>
                                  setEditEstimate((current) => ({
                                    ...current,
                                    items: current.items.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, material: event.target.value } : entry
                                    )
                                  }))
                                }
                                onKeyDown={(event) => onEstimateFieldKeyDown(event, { rowId: item._rowId, rowIndex: index, field: "material", category: item.category })}
                                data-estimate-row-id={item._rowId}
                                data-estimate-field="material"
                              />
                              {invalid ? <p className="mt-2 text-xs text-rose-300">Material name is required</p> : null}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const issues = validateEstimateItem(item);
                          const invalid = issues.some((issue) => issue.includes("Quantity"));
                          return (
                            <>
                              <input
                                className={`app-input w-20 rounded-xl px-3 py-2 text-sm ${invalid ? "border-rose-400/60" : ""}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.quantity}
                                disabled={!editable}
                                onChange={(event) =>
                                  setEditEstimate((current) => ({
                                    ...current,
                                    items: current.items.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, quantity: event.target.value } : entry
                                    )
                                  }))
                                }
                                onKeyDown={(event) => onEstimateFieldKeyDown(event, { rowId: item._rowId, rowIndex: index, field: "quantity", category: item.category })}
                                data-estimate-row-id={item._rowId}
                                data-estimate-field="quantity"
                              />
                              {invalid ? <p className="mt-2 text-xs text-rose-300">Use a quantity above 0</p> : null}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const issues = validateEstimateItem(item);
                          const invalid = issues.some((issue) => issue.includes("Unit is required"));
                          return (
                            <>
                              <input
                                className={`app-input w-20 rounded-xl px-3 py-2 text-sm ${invalid ? "border-rose-400/60" : ""}`}
                                value={item.unit}
                                disabled={!editable}
                                onChange={(event) =>
                                  setEditEstimate((current) => ({
                                    ...current,
                                    items: current.items.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, unit: event.target.value } : entry
                                    )
                                  }))
                                }
                                onKeyDown={(event) => onEstimateFieldKeyDown(event, { rowId: item._rowId, rowIndex: index, field: "unit", category: item.category })}
                                data-estimate-row-id={item._rowId}
                                data-estimate-field="unit"
                              />
                              {invalid ? <p className="mt-2 text-xs text-rose-300">Unit is required</p> : null}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const issues = validateEstimateItem(item);
                          const invalid = issues.some((issue) => issue.includes("Unit price"));
                          const priceRefreshMeta = getPriceRefreshMeta(item);
                          return (
                            <>
                              <div className="space-y-2">
                                <input
                                  className={`app-input w-24 rounded-xl px-3 py-2 text-sm ${invalid ? "border-rose-400/60" : ""} ${priceRefreshMeta ? "border-sky-300/30 bg-sky-400/[0.05]" : ""}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  disabled={!editable}
                                  onChange={(event) =>
                                    setEditEstimate((current) => ({
                                      ...current,
                                      items: current.items.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, unitPrice: event.target.value } : entry
                                      )
                                    }))
                                  }
                                  onKeyDown={(event) => onEstimateFieldKeyDown(event, { rowId: item._rowId, rowIndex: index, field: "unitPrice", category: item.category })}
                                  data-estimate-row-id={item._rowId}
                                  data-estimate-field="unitPrice"
                                />
                                <PriceDeltaBadge item={item} currencyCode={currencyCode} location={baseLocation} />
                                {editable ? <PriceRefreshRowActions item={item} onAccept={() => acceptPriceRefresh(index)} onUndo={() => undoPriceRefresh(index)} /> : null}
                              </div>
                              {invalid ? <p className="mt-2 text-xs text-rose-300">Unit price cannot be negative</p> : null}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[94px] space-y-1">
                          <p className="surface-title text-sm font-semibold leading-none">
                            {formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), currencyCode, baseLocation)}
                          </p>
                          <p className="surface-meta mt-2 text-[10px] uppercase tracking-[0.12em]">
                            {Number(item.quantity) || 0} x {formatCurrency(item.unitPrice || 0, currencyCode, baseLocation)}
                          </p>
                          {item.qtoFormula ? (
                            <p className="surface-copy text-[11px] leading-5 italic opacity-70" title={item.qtoFormula}>
                              {item.qtoFormula.length > 32 ? item.qtoFormula.slice(0, 32) + "…" : item.qtoFormula}
                            </p>
                          ) : null}
                          {getPriceRefreshMeta(item)?.supplier ? (
                            <p className="surface-copy text-[11px] leading-5">
                              {getPriceRefreshMeta(item).supplier}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="app-input min-w-[104px] rounded-xl px-3 py-2 text-sm"
                          value={item.category}
                          disabled={!editable}
                          onChange={(event) =>
                            setEditEstimate((current) => ({
                              ...current,
                              items: current.items.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, category: event.target.value } : entry
                              )
                            }))
                          }
                          onKeyDown={(event) => onEstimateFieldKeyDown(event, { rowId: item._rowId, rowIndex: index, field: "category", category: item.category })}
                          data-estimate-row-id={item._rowId}
                          data-estimate-field="category"
                        >
                          {["Materials", "Labor", "Equipment"].map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="app-input w-20 rounded-xl px-3 py-2 text-sm"
                          value={item.payItem || ""}
                          placeholder="Item 800"
                          disabled={!editable}
                          onChange={(event) =>
                            setEditEstimate((current) => ({
                              ...current,
                              items: current.items.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, payItem: event.target.value } : entry
                              )
                            }))
                          }
                          onKeyDown={(event) => onEstimateFieldKeyDown(event, { rowId: item._rowId, rowIndex: index, field: "payItem", category: item.category })}
                          data-estimate-row-id={item._rowId}
                          data-estimate-field="payItem"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="app-input w-full min-w-[120px] rounded-xl px-3 py-2 text-sm"
                          value={item.remarks || ""}
                          placeholder="e.g. as per DP-8"
                          disabled={!editable}
                          onChange={(event) =>
                            setEditEstimate((current) => ({
                              ...current,
                              items: current.items.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, remarks: event.target.value } : entry
                              )
                            }))
                          }
                          onKeyDown={(event) => onEstimateFieldKeyDown(event, { rowId: item._rowId, rowIndex: index, field: "remarks", category: item.category })}
                          data-estimate-row-id={item._rowId}
                          data-estimate-field="remarks"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <EstimateRowActions index={index} totalItems={editEstimate.items.length} setEditEstimate={setEditEstimate} item={item} editable={editable} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="table-row">
                    <td className="px-4 py-6 surface-copy text-sm" colSpan={9}>
                      No rows in {group.category.toLowerCase()} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="space-y-3 p-4 md:hidden">
              {group.items.length ? (
                group.items.map(({ item, index }) => (
                  <div key={item._rowId || index} className="surface-card rounded-[20px] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Row {index + 1}</p>
                        <p className="surface-title mt-1 text-sm font-semibold">{item.material || "New item"}</p>
                      </div>
                      <EstimateRowActions index={index} totalItems={editEstimate.items.length} setEditEstimate={setEditEstimate} item={item} compact editable={editable} />
                    </div>
                    <div className="mt-4">
                      <EstimateRowFields
                        item={item}
                        index={index}
                        setEditEstimate={setEditEstimate}
                        currencyCode={currencyCode}
                        baseLocation={baseLocation}
                        compact
                        onFieldKeyDown={onEstimateFieldKeyDown}
                        editable={editable}
                        onAcceptPriceRefresh={acceptPriceRefresh}
                        onUndoPriceRefresh={undoPriceRefresh}
                      />
                    </div>
                  </div>
                ))
              ) : null}
            </div>
            {editable ? (
              <div className="border-t border-black/5 dark:border-white/8 px-4 py-3">
                <button
                  className="ghost-btn px-3 py-1.5 text-xs"
                  type="button"
                  onClick={() => addRowToCategory(group.category)}
                >
                  + Add {group.category} Row
                </button>
              </div>
            ) : null}
            </>
            ) : (
              <div className="px-4 py-5">
                <p className="surface-copy text-sm">
                  {group.category} is collapsed. Expand to review or edit its rows.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EstimatorMaterialTools({
  open,
  onClose,
  materials,
  setEditEstimate,
  onCreateMaterialInline,
  materialBusy,
  canCreateMaterial,
  currencyCode,
  baseLocation
}) {
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [materialQuery, setMaterialQuery] = useState("");
  const [insertQuantity, setInsertQuantity] = useState("1");
  const [newMaterialInsertQuantity, setNewMaterialInsertQuantity] = useState("1");
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    unit: "",
    averagePrice: "",
    lastMonthPrice: "",
    trend: "Stable",
    suppliers: ""
  });

  const appendItem = (item) =>
    setEditEstimate((current) => ({
      ...current,
      items: [
        ...(current.items || []),
        item
      ]
    }));

  const normalizedQuery = materialQuery.trim().toLowerCase();
  const filteredMaterials = materials.filter((material) => {
    if (!normalizedQuery) {
      return true;
    }

    return [
      material.name,
      material.unit,
      ...(material.suppliers || [])
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const selectedMaterial = materials.find((entry) => entry.id === selectedMaterialId) || null;

  const onAddBlankItem = () =>
    appendItem({
      _rowId: createClientId("estimate-row"),
      material: "",
      quantity: 1,
      unit: "",
      unitPrice: 0,
      category: "Materials"
    });

  const onInsertCatalogMaterial = () => {
    const material = materials.find((entry) => entry.id === selectedMaterialId);
    if (!material) {
      return;
    }

    appendItem({
      _rowId: createClientId("estimate-row"),
      material: material.name,
      quantity: Number(insertQuantity) || 1,
      unit: material.unit,
      unitPrice: material.averagePrice || 0,
      category: inferEstimateCategory(material)
    });
    setSelectedMaterialId("");
    setMaterialQuery("");
    setInsertQuantity("1");
  };

  const onCreateAndInsertMaterial = async (event) => {
    event.preventDefault();
    const created = await onCreateMaterialInline({
      name: newMaterial.name,
      unit: newMaterial.unit,
      averagePrice: newMaterial.averagePrice,
      lastMonthPrice: newMaterial.lastMonthPrice || newMaterial.averagePrice || 0,
      trend: newMaterial.trend,
      suppliers: newMaterial.suppliers.split(",")
    });

    if (!created) {
      return;
    }

    appendItem({
      _rowId: createClientId("estimate-row"),
      material: created.name,
      quantity: Number(newMaterialInsertQuantity) || 1,
      unit: created.unit,
      unitPrice: created.averagePrice || 0,
      category: inferEstimateCategory(created)
    });
    setNewMaterial({
      name: "",
      unit: "",
      averagePrice: "",
      lastMonthPrice: "",
      trend: "Stable",
      suppliers: ""
    });
    setNewMaterialInsertQuantity("1");
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="dashboard-shell mx-auto max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-[24px] border p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Item Builder</p>
            <h3 className="surface-title mt-2 text-lg font-semibold">Add rows fast</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="ghost-btn" type="button" onClick={onClose}>
              Close
            </button>
            <CommandChip onClick={onAddBlankItem}>Blank row</CommandChip>
            <CommandChip active={Boolean(selectedMaterialId)} onClick={onInsertCatalogMaterial} disabled={!selectedMaterialId}>
              Insert selected
            </CommandChip>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[20px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <p className="surface-title text-sm font-semibold">Catalog</p>
            <span className="surface-meta text-[11px] uppercase tracking-[0.18em]">Search to insert</span>
          </div>
          <div className="mt-4 space-y-3">
            <Field
              label="Search"
              value={materialQuery}
              placeholder="Search by material, unit, or supplier"
              onChange={(event) => {
                setMaterialQuery(event.target.value);
                setSelectedMaterialId("");
              }}
            />
            <div className="table-shell rounded-[20px] p-2">
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {filteredMaterials.length ? (
                  filteredMaterials.slice(0, 8).map((material) => {
                    const active = material.id === selectedMaterialId;
                    return (
                      <button
                        key={material.id}
                        className={active ? "accent-card rounded-[16px] px-3 py-3 text-left" : "surface-card rounded-[16px] px-3 py-3 text-left"}
                        type="button"
                        onClick={() => setSelectedMaterialId(material.id)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="surface-title text-sm font-semibold">{material.name}</p>
                            <p className="surface-copy mt-1 text-xs">
                              {material.unit} / {material.trend}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="surface-title text-sm font-semibold">{formatCurrency(material.averagePrice || 0, currencyCode, baseLocation)}</p>
                            <p className="surface-meta mt-1 text-[11px] uppercase tracking-[0.18em]">
                              {(material.suppliers || []).length} suppliers
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="surface-copy px-2 py-3 text-sm">No materials match this search yet.</p>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field
                label="Qty"
                type="number"
                min="0.01"
                step="0.01"
                value={insertQuantity}
                onChange={(event) => setInsertQuantity(event.target.value)}
              />
              <button className="primary-btn md:mb-[1px]" type="button" onClick={onInsertCatalogMaterial} disabled={!selectedMaterialId}>
                Insert
              </button>
            </div>
          </div>
          {selectedMaterial ? (
            <div className="mt-3 rounded-[18px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Material" value={selectedMaterial.name} note={`${selectedMaterial.unit} / ${selectedMaterial.trend}`} />
                <MiniStat label="Unit Price" value={formatCurrency(selectedMaterial.averagePrice || 0, currencyCode, baseLocation)} note={`Qty ${insertQuantity || "1"}`} />
                <MiniStat label="Category" value={inferEstimateCategory(selectedMaterial)} note={(selectedMaterial.suppliers || []).length ? `${(selectedMaterial.suppliers || []).length} suppliers` : "No suppliers"} />
              </div>
              <p className="surface-meta mt-3 text-xs uppercase tracking-[0.2em]">
                {(selectedMaterial.suppliers || []).join(", ") || "No suppliers listed"}
              </p>
            </div>
          ) : null}
        </div>

          <div className="rounded-[20px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="surface-title text-sm font-semibold">Quick add</p>
            </div>
            <span className="surface-meta text-[11px] uppercase tracking-[0.18em]">Create to insert</span>
          </div>
          {!canCreateMaterial ? (
            <div className="mt-4">
              <Banner tone="warn">Only admins and estimators can create catalog materials.</Banner>
            </div>
          ) : (
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onCreateAndInsertMaterial}>
            <Field
              label="Name"
              value={newMaterial.name}
              onChange={(event) => setNewMaterial((current) => ({ ...current, name: event.target.value }))}
            />
            <Field
              label="Unit"
              value={newMaterial.unit}
              onChange={(event) => setNewMaterial((current) => ({ ...current, unit: event.target.value }))}
            />
            <Field
              label="Avg. Price"
              type="number"
              min="0"
              step="0.01"
              value={newMaterial.averagePrice}
              onChange={(event) => setNewMaterial((current) => ({ ...current, averagePrice: event.target.value }))}
            />
            <Field
              label="Prev. Price"
              type="number"
              min="0"
              step="0.01"
              value={newMaterial.lastMonthPrice}
              onChange={(event) => setNewMaterial((current) => ({ ...current, lastMonthPrice: event.target.value }))}
            />
            <label className="app-label block text-sm">
              <span>Trend</span>
              <select
                className="app-input mt-1.5 w-full px-3 py-2"
                value={newMaterial.trend}
                onChange={(event) => setNewMaterial((current) => ({ ...current, trend: event.target.value }))}
              >
                {["Rising", "Stable", "Falling"].map((trend) => (
                  <option key={trend} value={trend}>
                    {trend}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Qty"
              type="number"
              min="0.01"
              step="0.01"
              value={newMaterialInsertQuantity}
              onChange={(event) => setNewMaterialInsertQuantity(event.target.value)}
            />
            <div className="md:col-span-2">
              <Field
                label="Suppliers"
                value={newMaterial.suppliers}
                placeholder="Wilcon Depot, CW Home Depot"
                onChange={(event) => setNewMaterial((current) => ({ ...current, suppliers: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
              <MiniStat label="Category" value={inferEstimateCategory(newMaterial)} note="Auto-suggested" />
              <MiniStat label="Insert Qty" value={newMaterialInsertQuantity || "1"} note="Applied on create" />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button className="primary-btn" type="submit" disabled={materialBusy}>
                {materialBusy ? "Creating..." : "Create + Insert"}
              </button>
              <p className="surface-copy text-sm">Adds to catalog and BOQ in one step.</p>
            </div>
          </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

function scoreConfidence(text) {
  let score = 0;
  if (/(\d+(?:\.\d+)?)\s*(sqm|sq\.?\s?m|m2)/i.test(text)) score += 2;
  if (/\bin\s+[a-zA-Z0-9,\s-]+/i.test(text)) score += 1;
  if (/(house|bungalow|residential|fit.?out|office|warehouse|electrical|plumbing|structural|architectural|fire)/i.test(text)) score += 2;
  if (/(premium|standard|basic|economy|shell only)/i.test(text)) score += 1;
  if (text.trim().split(/\s+/).length > 20) score += 1;
  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

function GenerateFromDocumentModal({ open, onClose, onGenerate, data, estimateForm, busy }) {
  const [form, setForm] = useState({ text: "", areaHint: "", discipline: "", projectId: "", templateId: "", fileName: "" });
  const [selectedDocId, setSelectedDocId] = useState("");
  const fileInputRef = useRef(null);

  if (!open) {
    return null;
  }

  const confidence = form.text.trim() ? scoreConfidence(form.text) : null;
  const uploadedDocs = data.documents || [];

  const loadUploadedDoc = (docId) => {
    setSelectedDocId(docId);
    if (!docId) {
      setForm((c) => ({ ...c, text: "", fileName: "", areaHint: "", projectId: "" }));
      return;
    }
    const doc = uploadedDocs.find((d) => d.id === docId);
    if (!doc) return;
    const parts = [doc.extractionSummary || ""];
    const ex = doc.extracted || {};
    if (ex.roomDimensions?.length) parts.push("Room Dimensions:\n" + ex.roomDimensions.join("\n"));
    if (ex.structuralElements?.length) parts.push("Structural Elements:\n" + ex.structuralElements.join("\n"));
    if (ex.wallLengths) parts.push(`Wall lengths: ${ex.wallLengths}m`);
    if (ex.floorAreas) parts.push(`Floor areas: ${ex.floorAreas} sqm`);
    if (doc.notes) parts.push(`Notes: ${doc.notes}`);
    setForm((c) => ({
      ...c,
      text: parts.filter(Boolean).join("\n\n"),
      fileName: doc.filename,
      areaHint: String(doc.areaHint || ex.floorAreas || "60"),
      projectId: doc.projectId || c.projectId
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setSelectedDocId("");
    setForm((current) => ({ ...current, fileName: file.name }));
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = () =>
        setForm((current) => ({
          ...current,
          text: current.text ? `${current.text}\n\n${reader.result}` : String(reader.result)
        }));
      reader.readAsText(file);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.text.trim()) return;
    const prompt = form.fileName
      ? `[Document: ${form.fileName}] ${form.text}${form.areaHint ? ` Area: ${form.areaHint} sqm.` : ""}`
      : `${form.text}${form.areaHint ? ` Area: ${form.areaHint} sqm.` : ""}`;
    onGenerate({
      prompt,
      discipline: form.discipline || undefined,
      projectId: form.projectId || estimateForm.projectId || undefined,
      templateId: form.templateId || estimateForm.templateId || undefined
    }, form.text);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="dashboard-shell mx-auto max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">AI Analysis</p>
            <h3 className="section-title mt-2 text-2xl font-semibold">Generate from Document</h3>
            <p className="section-copy mt-2 max-w-xl text-sm leading-6">
              Pick an uploaded document, attach a local file, or paste project notes directly.
            </p>
          </div>
          <button className="ghost-btn shrink-0" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {/* Source picker */}
          <div className="space-y-2">
            <p className="app-label">Source</p>
            {uploadedDocs.length > 0 ? (
              <div className="space-y-2">
                <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">Uploaded documents</p>
                <div className="grid gap-2">
                  {uploadedDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className={`flex items-start justify-between gap-3 rounded-[14px] border px-4 py-3 text-left transition ${
                        selectedDocId === doc.id
                          ? "border-sky-400/30 bg-sky-400/[0.06]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                      onClick={() => loadUploadedDoc(selectedDocId === doc.id ? "" : doc.id)}
                    >
                      <div className="min-w-0">
                        <p className="surface-title text-sm font-semibold truncate">{doc.filename}</p>
                        <p className="surface-copy mt-0.5 line-clamp-1 text-xs">{doc.extractionSummary}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        doc.reviewStatus === "Approved"
                          ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : doc.reviewStatus === "Reviewed"
                            ? "border border-sky-400/20 bg-sky-400/10 text-sky-200"
                            : "border border-sky-400/20 bg-sky-400/10 text-sky-300"
                      }`}>
                        {doc.reviewStatus}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="surface-copy text-[11px]">— or attach a local file —</p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button className="ghost-btn" type="button" onClick={() => fileInputRef.current?.click()}>
                Attach Local File
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" className="hidden" onChange={handleFileChange} />
              {form.fileName && !selectedDocId ? (
                <span className="rounded border border-sky-400/20 bg-sky-400/8 px-3 py-1.5 text-xs font-medium text-sky-200">
                  {form.fileName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="app-label">Project Description / Notes</p>
              {confidence ? (
                <span className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  confidence === "High"
                    ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : confidence === "Medium"
                      ? "border border-sky-400/20 bg-sky-400/10 text-sky-300"
                      : "border border-white/10 bg-white/[0.03] text-slate-400"
                }`}>
                  AI Confidence: {confidence}
                </span>
              ) : null}
            </div>
            <textarea
              className="app-input w-full px-3 py-2.5 text-sm"
              rows={5}
              placeholder="e.g. 120 sqm two-storey house in Pasig City, premium finish, 3 bedrooms, 2 bathrooms, complete structural, architectural, electrical, and plumbing works..."
              value={form.text}
              onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="app-label block">
              <span>Floor Area (sqm)</span>
              <input
                className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                type="number"
                min="1"
                step="1"
                value={form.areaHint}
                onChange={(event) => setForm((current) => ({ ...current, areaHint: event.target.value }))}
              />
            </label>
            <label className="app-label block">
              <span>Discipline</span>
              <select
                className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                value={form.discipline}
                onChange={(event) => setForm((current) => ({ ...current, discipline: event.target.value }))}
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="app-label block">
              <span>Project</span>
              <select
                className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                value={form.projectId || estimateForm.projectId}
                onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
              >
                <option value="">Use default project</option>
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>
            <label className="app-label block">
              <span>Template</span>
              <select
                className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                value={form.templateId || estimateForm.templateId}
                onChange={(event) => setForm((current) => ({ ...current, templateId: event.target.value }))}
              >
                <option value="">Use default template</option>
                {data.templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button className="primary-btn" type="submit" disabled={busy || !form.text.trim()}>
              {busy ? "AI is analyzing the document…" : "Generate Estimate from Document"}
            </button>
            <button className="ghost-btn" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AIConfidenceBar({ confidence, aiItemCount, totalItemCount, onAcceptAll, canEdit }) {
  if (!aiItemCount) {
    return null;
  }

  const toneClass =
    confidence === "High"
      ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-200"
      : confidence === "Medium"
        ? "border-sky-400/20 bg-sky-400/8 text-sky-300"
        : "border-sky-400/20 bg-sky-400/8 text-sky-200";

  return (
    <div className={`rounded-lg border px-4 py-3 flex flex-wrap items-center gap-3 ${toneClass}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.14em]">
        AI Confidence: {confidence || "—"}
      </span>
      <span className="text-xs opacity-75">
        {aiItemCount} of {totalItemCount} rows AI-generated
      </span>
      <div className="flex gap-2 ml-auto flex-wrap">
        {canEdit ? (
          <button className="ghost-btn px-3 py-1.5 text-xs" type="button" onClick={onAcceptAll}>
            Accept All
          </button>
        ) : null}
        <span className="surface-copy text-xs self-center">You can manually edit the table below.</span>
      </div>
    </div>
  );
}


const RISK_STYLES = {
  none: "border-sky-400/20 bg-sky-400/[0.05] text-sky-300",
  low: "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300",
  medium: "border-amber-400/20 bg-amber-400/[0.05] text-amber-300",
  high: "border-red-400/20 bg-red-400/[0.05] text-red-300"
};

function EstimateSwitcher({ estimates, selectedId, onSelect, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = estimates.find((e) => e.id === selectedId) || estimates[0];
  const estimateLabel = (e) => {
    const clean = e.prompt.replace(/^\[Document:[^\]]+\]\s*/i, "").trim();
    const date = e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "";
    const price = e.finalContractPrice ? ` · ₱${(e.finalContractPrice / 1000000).toFixed(2)}M` : "";
    return `${date}${price} — ${clean.slice(0, 36)}`;
  };
  const label = selected ? estimateLabel(selected) : "Select estimate";

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="app-input rounded-full px-4 py-2 text-sm flex items-center gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <span className="opacity-50">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-[16px] border border-white/10 bg-[#181c24] shadow-xl py-1">
          {estimates.map((estimate) => {
            const name = estimateLabel(estimate);
            const isActive = estimate.id === selectedId;
            return (
              <div key={estimate.id} className={`flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] ${isActive ? "text-sky-400" : "text-slate-300"}`}>
                <button
                  type="button"
                  className="flex-1 text-left text-sm truncate"
                  onClick={() => { onSelect(estimate.id); setOpen(false); }}
                >
                  {name || "(untitled)"}
                </button>
                {onDelete && (
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-0.5 text-xs text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition"
                    onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${name}"?`)) onDelete(estimate.id); }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionCard({ action, status, onRun }) {
  const style = RISK_STYLES[action.risk] || RISK_STYLES.low;
  return (
    <div className={`rounded-xl border p-3 ${style}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{action.label}</p>
          <p className="text-xs opacity-70 mt-0.5 leading-5">{action.description}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {action.risk === "high" && <span className="text-[10px] uppercase tracking-wider opacity-60">Destructive</span>}
          {status === "done" && <span className="text-[11px] text-emerald-400">Done</span>}
          {status === "error" && <span className="text-[11px] text-red-400">Failed</span>}
          {(status === "running" || (!status && !action.autoRun)) && <span className="text-[11px] opacity-60">Running…</span>}
        </div>
      </div>
    </div>
  );
}

function AgentPanel({ open, onToggle, busy, plan, onSend, onRunAction, onRunAll, onClearPlan, actionStatuses, agentInput, setAgentInput }) {
  return (
    <InsightCard
      eyebrow="AI Agent"
      title="System Control"
      aside={
        <button className="ghost-btn px-3 py-1.5 text-xs" type="button" onClick={onToggle}>
          {open ? "Hide" : "Show"}
        </button>
      }
    >
      {open ? (
        <div className="space-y-3">
          <p className="surface-copy text-xs">Tell the AI what to do. It will execute actions automatically.</p>
          <form className="flex gap-2" onSubmit={onSend}>
            <input
              className="app-input flex-1 px-3 py-2 text-sm"
              placeholder="Create a project, generate an estimate, mark as reviewed…"
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              disabled={busy}
            />
            <button className="ghost-btn px-3 py-2 text-xs" type="submit" disabled={busy || !agentInput.trim()}>
              {busy ? "…" : "Go"}
            </button>
          </form>
          {!agentInput.trim() && !plan ? (
            <div className="flex flex-wrap gap-1.5">
              {[
                "Analyze this BOQ and tell me what's missing",
                "Mark this estimate as Reviewed",
                "Add fire protection scope",
                "Create a project for a 60sqm house in Manila"
              ].map((hint) => (
                <button key={hint} type="button"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-400/30 hover:bg-sky-400/[0.06]"
                  onClick={() => setAgentInput(hint)} disabled={busy}>
                  {hint}
                </button>
              ))}
            </div>
          ) : null}
          {plan ? (
            <div className="space-y-3">
              {plan.reply ? (
                <p className="surface-copy text-sm leading-6 border-l-2 border-sky-400/30 pl-3">{plan.reply}</p>
              ) : null}
              {plan.actions?.length > 0 && (
                <div className="space-y-2">
                  {plan.actions.map((action) => (
                    <ActionCard key={action.id} action={action} status={actionStatuses[action.id]} onRun={onRunAction} />
                  ))}
                </div>
              )}
              <button className="ghost-btn px-3 py-1.5 text-xs" type="button" onClick={onClearPlan}>
                Clear
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="surface-copy text-xs">Let the AI create projects, generate estimates, update statuses, and more — with your approval.</p>
      )}
    </InsightCard>
  );
}

function WhatIfPanel({ proposal, onApply, onDismiss, undoItems, onUndo, currencyCode, location }) {
  if (!proposal && !undoItems) return null;
  const added = proposal?.items.filter((i) => i._aiSuggested) || [];
  const removed = proposal?.removedItems || [];
  return (
    <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/[0.06] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">What-If Analysis</p>
          <h3 className="surface-title mt-1 text-base font-semibold">{proposal?.instruction}</h3>
        </div>
        {undoItems ? (
          <button className="ghost-btn px-3 py-1.5 text-xs shrink-0" type="button" onClick={onUndo}>
            Undo
          </button>
        ) : null}
      </div>
      {proposal ? (
        <>
          <p className="surface-copy text-sm leading-6">{proposal.explanation}</p>
          {removed.length > 0 && (
            <div>
              <p className="surface-meta text-[11px] uppercase tracking-[0.15em] mb-1.5">Removed ({removed.length})</p>
              <div className="space-y-1">
                {removed.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-1.5">
                    <span className="text-xs text-red-300 line-through">{item.material}</span>
                    <span className="text-xs text-red-400/70">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {added.length > 0 && (
            <div>
              <p className="surface-meta text-[11px] uppercase tracking-[0.15em] mb-1.5">Added ({added.length})</p>
              <div className="space-y-1">
                {added.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5">
                    <span className="text-xs text-emerald-300">{item.material}</span>
                    <span className="text-xs text-emerald-400/70">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button className="primary-btn text-xs px-4 py-2" type="button" onClick={onApply}>
              Apply to BOQ
            </button>
            <button className="ghost-btn text-xs px-4 py-2" type="button" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AIAssistantPanel({ assistantOpen, onToggle, input, setInput, onSubmit, busy, history }) {
  return (
    <InsightCard
      eyebrow="AI"
      title="Ask the Assistant"
      aside={
        <button className="ghost-btn px-3 py-1.5 text-xs" type="button" onClick={onToggle}>
          {assistantOpen ? "Hide" : "Show"}
        </button>
      }
    >
      {assistantOpen ? (
        <div className="space-y-3">
          <p className="surface-copy text-xs">Add, remove, analyze, explain, improve, or run what-if scenarios on this estimate.</p>
          <form className="flex gap-2" onSubmit={onSubmit}>
            <input
              className="app-input flex-1 px-3 py-2 text-sm"
              placeholder="Ask anything about this estimate…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={busy}
            />
            <button className="ghost-btn px-3 py-2 text-xs" type="submit" disabled={busy || !input.trim()}>
              {busy ? "…" : "Ask"}
            </button>
          </form>
          {!input.trim() ? (
            <div className="flex flex-wrap gap-1.5">
              {[
                "What if we use AAC block?",
                "Add ceiling works",
                "Explain the labor cost",
                "Remove electrical",
                "Reduce cost by 10%",
                "What's missing from this BOQ?"
              ].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-400/30 hover:bg-sky-400/[0.06]"
                  onClick={() => setInput(hint)}
                  disabled={busy}
                >
                  {hint}
                </button>
              ))}
            </div>
          ) : null}
          {history.length ? (
            <div className="space-y-1.5">
              {history.slice(0, 3).map((entry, index) => (
                <div key={index} className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="surface-copy text-xs leading-5">{entry.instruction}</p>
                  <p className="surface-meta text-[11px] mt-0.5 opacity-70">
                    {[
                      entry.addedCount ? `+${entry.addedCount} added` : null,
                      entry.removedCount ? `−${entry.removedCount} removed` : null,
                      entry.refinedCount ? `${entry.refinedCount} updated` : null
                    ].filter(Boolean).join(" · ") || "Analyzed"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="surface-copy text-xs">Ask the AI to add, remove, analyze, or run what-if scenarios on this estimate.</p>
      )}
    </InsightCard>
  );
}

const TAKEOFF_BUILDING_TYPES = [
  { value: "residential", label: "Residential / House" },
  { value: "fitout", label: "Office Fit-out" },
  { value: "warehouse", label: "Warehouse / Industrial" },
  { value: "structural", label: "Structural Works" },
  { value: "architectural", label: "Architectural Finishes" },
  { value: "electrical", label: "Electrical Works" },
  { value: "plumbing", label: "Plumbing Works" },
  { value: "firePro", label: "Fire Protection" }
];

const ROOM_PRESETS = {
  residential: [
    { name: "Living Room", length: "5", width: "4" },
    { name: "Dining Room", length: "3", width: "3" },
    { name: "Kitchen", length: "3", width: "2.5" },
    { name: "Bedroom 1", length: "3.5", width: "3" },
    { name: "Bedroom 2", length: "3", width: "3" },
    { name: "Toilet & Bath", length: "1.8", width: "2" }
  ],
  fitout: [
    { name: "Reception", length: "4", width: "5" },
    { name: "Open Office", length: "10", width: "8" },
    { name: "Conference Room", length: "5", width: "4" },
    { name: "Pantry", length: "3", width: "2.5" },
    { name: "Toilet", length: "2", width: "2" }
  ],
  warehouse: [
    { name: "Main Bay", length: "30", width: "20" },
    { name: "Office Area", length: "8", width: "5" },
    { name: "Loading Dock", length: "6", width: "4" }
  ]
};

let _takeoffRoomId = 0;
const makeTakeoffRoom = (preset = {}) => ({
  _id: `tr-${++_takeoffRoomId}`,
  name: preset.name || "",
  length: preset.length || "",
  width: preset.width || ""
});

const TAKEOFF_EXCLUSIONS = [
  { key: "electrical", label: "Electrical" },
  { key: "plumbing", label: "Plumbing" },
  { key: "painting", label: "Painting" },
  { key: "ceiling", label: "Ceiling Works" },
  { key: "flooring", label: "Flooring / Tiles" },
  { key: "doors", label: "Doors & Windows" }
];

function TakeoffAssistForm({ onSubmit, busy, canEdit }) {
  const [buildingType, setBuildingType] = useState("residential");
  const [location, setLocation] = useState("");
  const [finishLevel, setFinishLevel] = useState("standard");
  const [floors, setFloors] = useState("1");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("1");
  const [rooms, setRooms] = useState(() => (ROOM_PRESETS.residential || []).map(makeTakeoffRoom));
  const [exclusions, setExclusions] = useState({ electrical: false, plumbing: false, painting: false, ceiling: false, flooring: false, doors: false });
  const [notes, setNotes] = useState("");

  const totalArea = rooms.reduce((sum, r) => sum + (parseFloat(r.length) || 0) * (parseFloat(r.width) || 0), 0);
  const roundedArea = Math.round(totalArea * 100) / 100;

  const onChangeBuildingType = (value) => {
    setBuildingType(value);
    const preset = ROOM_PRESETS[value];
    if (preset) setRooms(preset.map(makeTakeoffRoom));
    else setRooms([]);
  };

  const addRoom = () => setRooms((r) => [...r, makeTakeoffRoom()]);
  const removeRoom = (id) => setRooms((r) => r.filter((room) => room._id !== id));
  const updateRoom = (id, field, value) => setRooms((r) => r.map((room) => (room._id === id ? { ...room, [field]: value } : room)));
  const toggleExclusion = (key) => setExclusions((e) => ({ ...e, [key]: !e[key] }));

  const buildPrompt = () => {
    const floorCount = parseInt(floors) || 1;
    const bedroomCount = parseInt(bedrooms) || 0;
    const bathroomCount = parseInt(bathrooms) || 0;
    const loc = location.trim() || "Metro Manila";
    const typeLabel = TAKEOFF_BUILDING_TYPES.find((t) => t.value === buildingType)?.label || buildingType;
    const floorStr = floorCount > 1 ? `${floorCount}-storey ` : "";
    const roomStr = rooms
      .filter((r) => r.name && parseFloat(r.length) > 0 && parseFloat(r.width) > 0)
      .map((r) => `${r.name} ${r.length}m x ${r.width}m`)
      .join(", ");
    const bedroomStr = bedroomCount > 0 ? `${bedroomCount} bedroom${bedroomCount !== 1 ? "s" : ""}` : "";
    const bathroomStr = bathroomCount > 0 ? `${bathroomCount} bathroom${bathroomCount !== 1 ? "s" : ""}` : "";
    const roomDetails = [bedroomStr, bathroomStr].filter(Boolean).join(", ");
    const exclKeys = Object.entries(exclusions).filter(([, v]) => v).map(([k]) => k);
    const exclStr = exclKeys.length ? `Exclude ${exclKeys.join(", ")}` : "complete scope";

    let prompt = `Generate a ${finishLevel} ${typeLabel.toLowerCase()} estimate for a ${roundedArea} sqm ${floorStr}building in ${loc}`;
    if (roomDetails) prompt += ` with ${roomDetails}`;
    if (roomStr) prompt += `. Measured rooms: ${roomStr}`;
    prompt += `. ${exclStr}`;
    if (notes.trim()) prompt += `. ${notes.trim()}`;
    prompt += ".";
    return prompt;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canEdit || roundedArea <= 0) return;
    onSubmit(buildPrompt());
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="app-label block">
          <span>Building Type</span>
          <select className="app-input mt-1.5 w-full px-3 py-2 text-sm" value={buildingType} onChange={(e) => onChangeBuildingType(e.target.value)}>
            {TAKEOFF_BUILDING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="app-label block">
          <span>Location</span>
          <input className="app-input mt-1.5 w-full px-3 py-2 text-sm" placeholder="Quezon City" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="app-label block">
          <span>Finish Level</span>
          <select className="app-input mt-1.5 w-full px-3 py-2 text-sm" value={finishLevel} onChange={(e) => setFinishLevel(e.target.value)}>
            <option value="basic">Basic / Economy</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium / High-end</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="app-label block">
          <span>Floors / Storeys</span>
          <select className="app-input mt-1.5 w-full px-3 py-2 text-sm" value={floors} onChange={(e) => setFloors(e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="app-label block">
          <span>Bedrooms</span>
          <select className="app-input mt-1.5 w-full px-3 py-2 text-sm" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
            <option value="0">N/A</option>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="app-label block">
          <span>Bathrooms</span>
          <select className="app-input mt-1.5 w-full px-3 py-2 text-sm" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)}>
            <option value="0">N/A</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="app-label font-medium">Room Dimensions</p>
            <p className="surface-meta mt-0.5 text-xs">
              Total area: <span className="font-semibold text-sky-300">{roundedArea.toFixed(2)} sqm</span>
            </p>
          </div>
          <button type="button" className="ghost-btn px-3 py-1.5 text-xs" onClick={addRoom}>
            + Add Room
          </button>
        </div>
        <div className="space-y-2">
          {rooms.map((room) => (
            <div key={room._id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 110px 110px 36px" }}>
              <input
                className="app-input px-3 py-2 text-sm"
                placeholder="Room name"
                value={room.name}
                onChange={(e) => updateRoom(room._id, "name", e.target.value)}
              />
              <input
                className="app-input px-3 py-2 text-sm"
                placeholder="Length (m)"
                type="number"
                min="0"
                step="0.1"
                value={room.length}
                onChange={(e) => updateRoom(room._id, "length", e.target.value)}
              />
              <input
                className="app-input px-3 py-2 text-sm"
                placeholder="Width (m)"
                type="number"
                min="0"
                step="0.1"
                value={room.width}
                onChange={(e) => updateRoom(room._id, "width", e.target.value)}
              />
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300"
                onClick={() => removeRoom(room._id)}
                aria-label="Remove room"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="m4 4 8 8" /><path d="M12 4 4 12" />
                </svg>
              </button>
            </div>
          ))}
          {rooms.length === 0 ? (
            <p className="surface-meta py-2 text-sm">No rooms yet. Click &quot;+ Add Room&quot; to start.</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="app-label mb-3 font-medium">Exclusions</p>
        <div className="flex flex-wrap gap-2">
          {TAKEOFF_EXCLUSIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleExclusion(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                exclusions[key]
                  ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              {exclusions[key] ? "x " : ""}{label}
            </button>
          ))}
        </div>
      </div>

      <label className="app-label block">
        <span>Additional Notes</span>
        <textarea
          className="app-input mt-1.5 w-full px-3 py-2 text-sm"
          rows={2}
          placeholder="Special requirements, materials, or scope clarifications..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="rounded-[14px] border border-sky-400/20 bg-sky-400/[0.04] px-4 py-3">
        <p className="surface-meta mb-2 text-[11px] uppercase tracking-[0.18em]">Prompt Preview</p>
        <p className="surface-copy text-sm leading-6">{buildPrompt()}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="primary-btn" type="submit" disabled={busy || !canEdit || roundedArea <= 0}>
          {busy ? "Generating..." : canEdit ? "Generate from Takeoff" : "Draft Restricted"}
        </button>
        {roundedArea > 0 ? (
          <span className="surface-copy text-sm">{roundedArea.toFixed(2)} sqm across {rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
        ) : (
          <span className="surface-copy text-xs">Add room dimensions to calculate area.</span>
        )}
        {!canEdit ? <Banner tone="warn">Read-only role. Draft generation is disabled.</Banner> : null}
      </div>
    </form>
  );
}

function CompletenessPanel({ onCheckCompleteness }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleCheck = async () => {
    setBusy(true);
    try {
      const res = await onCheckCompleteness();
      if (res) setResult(res);
    } finally {
      setBusy(false);
    }
  };

  const severityClass = (s) =>
    s === "high"
      ? "border-rose-400/20 bg-rose-400/[0.06] text-rose-200"
      : s === "medium"
        ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-200"
        : "border-sky-400/20 bg-sky-400/[0.06] text-sky-200";

  const scoreColor = !result
    ? ""
    : result.score >= 80
      ? "text-emerald-300"
      : result.score >= 60
        ? "text-amber-300"
        : "text-rose-300";

  return (
    <InsightCard
      eyebrow="QA"
      title="BOQ Completeness"
      aside={
        <button className="ghost-btn px-3 py-1.5 text-xs" type="button" onClick={handleCheck} disabled={busy}>
          {busy ? "Checking…" : result ? "Re-check" : "Check Now"}
        </button>
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className={`text-2xl font-bold ${scoreColor}`}>{result.score}/100</p>
            <p className="surface-copy text-xs leading-5">{result.summary}</p>
          </div>
          {result.flags.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {result.flags.map((flag, i) => (
                <div key={i} className={`rounded-[14px] border px-3 py-2.5 ${severityClass(flag.severity)}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider opacity-80">
                      {flag.severity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{flag.issue}</p>
                      <p className="mt-1 text-[11px] opacity-75 leading-4">{flag.suggestion}</p>
                      {flag.payItem ? (
                        <span className="mt-1.5 inline-block rounded border border-current/20 bg-current/10 px-1.5 py-0.5 text-[10px] font-semibold opacity-80">
                          {flag.payItem}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="surface-copy text-xs">Run a completeness check to find missing scope items, absent safety provisions, and DPWH pay item gaps.</p>
      )}
    </InsightCard>
  );
}

function BulkRepricePanel({ onBulkReprice, busy }) {
  const [keyword, setKeyword] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!keyword.trim() || !newPrice) return;
    const result = await onBulkReprice(keyword.trim(), Number(newPrice));
    if (result) setLastResult(result);
    setKeyword("");
    setNewPrice("");
  };

  return (
    <InsightCard eyebrow="Price Tools" title="Bulk Reprice">
      <p className="surface-copy text-xs mb-3">Find all rows matching a keyword and update their unit price in one step. Locked rows are skipped.</p>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 grid-cols-2">
          <label className="app-label block">
            <span>Material keyword</span>
            <input
              className="app-input mt-1.5 w-full px-3 py-2 text-sm"
              placeholder="e.g. PVC pipe"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="app-label block">
            <span>New unit price (PHP)</span>
            <input
              className="app-input mt-1.5 w-full px-3 py-2 text-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 320"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <button className="ghost-btn px-3 py-1.5 text-xs" type="submit" disabled={busy || !keyword.trim() || !newPrice}>
          {busy ? "Applying…" : "Apply to Matching Rows"}
        </button>
      </form>
      {lastResult ? (
        <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
          <p className="text-xs text-emerald-200">
            Updated <span className="font-semibold">{lastResult.matchCount}</span> row{lastResult.matchCount !== 1 ? "s" : ""}.
            {lastResult.skippedCount > 0 ? ` ${lastResult.skippedCount} locked row${lastResult.skippedCount !== 1 ? "s" : ""} skipped.` : ""}
          </p>
        </div>
      ) : null}
    </InsightCard>
  );
}

function diffSnapshots(snapItems = [], currentItems = []) {
  // Normalise a key for matching rows across snapshots
  const key = (i) => (i.material || "").toLowerCase().trim();

  const snapMap = new Map(snapItems.map((i) => [key(i), i]));
  const currMap = new Map(currentItems.map((i) => [key(i), i]));

  const added = [];    // in current but not in snapshot
  const removed = [];  // in snapshot but not in current
  const changed = [];  // in both but price or quantity differs

  for (const [k, curr] of currMap) {
    if (!snapMap.has(k)) {
      added.push(curr);
    } else {
      const snap = snapMap.get(k);
      const priceChanged = Number(curr.unitPrice) !== Number(snap.unitPrice);
      const qtyChanged   = Number(curr.quantity)  !== Number(snap.quantity);
      if (priceChanged || qtyChanged) {
        changed.push({ current: curr, snapshot: snap, priceChanged, qtyChanged });
      }
    }
  }
  for (const [k, snap] of snapMap) {
    if (!currMap.has(k)) removed.push(snap);
  }

  return { added, removed, changed };
}

function SnapshotDiffView({ snap, currentItems, currencyCode, location, onClose }) {
  const { added, removed, changed } = useMemo(
    () => diffSnapshots(snap.items || [], currentItems || []),
    [snap, currentItems]
  );
  const priceDelta = (snap.finalContractPrice || 0) - (currentItems.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0
  ));
  const isEmpty = added.length === 0 && removed.length === 0 && changed.length === 0;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="surface-title text-sm font-semibold">vs "{snap.label}"</p>
        <button className="ghost-btn px-2 py-1 text-xs" type="button" onClick={onClose}>Close diff</button>
      </div>
      {isEmpty ? (
        <p className="surface-copy text-xs">No changes — current BOQ matches this snapshot exactly.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {added.map((item, i) => (
            <div key={`add-${i}`} className="flex items-start gap-2 rounded-[12px] border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
              <span className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-400/10">+new</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-200">{item.material}</p>
                <p className="text-[11px] text-emerald-300/70">{item.quantity} {item.unit} × {formatCurrency(item.unitPrice || 0, currencyCode, location)}</p>
              </div>
            </div>
          ))}
          {removed.map((item, i) => (
            <div key={`rem-${i}`} className="flex items-start gap-2 rounded-[12px] border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2">
              <span className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-300 bg-rose-400/10">−del</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-200 line-through">{item.material}</p>
                <p className="text-[11px] text-rose-300/70">{item.quantity} {item.unit} × {formatCurrency(item.unitPrice || 0, currencyCode, location)}</p>
              </div>
            </div>
          ))}
          {changed.map(({ current, snapshot, priceChanged, qtyChanged }, i) => (
            <div key={`chg-${i}`} className="flex items-start gap-2 rounded-[12px] border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2">
              <span className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10">~chg</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-200">{current.material}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  {priceChanged && (
                    <span className="text-amber-300/80">
                      Price: <span className="line-through opacity-60">{formatCurrency(snapshot.unitPrice || 0, currencyCode, location)}</span>
                      {" → "}<span className="font-semibold">{formatCurrency(current.unitPrice || 0, currencyCode, location)}</span>
                    </span>
                  )}
                  {qtyChanged && (
                    <span className="text-amber-300/80">
                      Qty: <span className="line-through opacity-60">{snapshot.quantity}</span>
                      {" → "}<span className="font-semibold">{current.quantity}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 flex items-center justify-between gap-3">
        <p className="surface-meta text-[11px] uppercase tracking-[0.15em]">Price delta vs snapshot</p>
        <p className={`text-sm font-semibold ${priceDelta > 0 ? "text-rose-300" : priceDelta < 0 ? "text-emerald-300" : "text-slate-400"}`}>
          {priceDelta > 0 ? "+" : ""}{formatCurrency(priceDelta, currencyCode, location)}
        </p>
      </div>
    </div>
  );
}

function SnapshotPanel({ onCreateSnapshot, onLoadSnapshots, snapshots = [], busy, selectedEstimate, editEstimate, currencyCode }) {
  const [label, setLabel] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [diffSnap, setDiffSnap] = useState(null);

  const handleLoad = async () => {
    await onLoadSnapshots();
    setLoaded(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!label.trim()) return;
    await onCreateSnapshot(label.trim());
    setLabel("");
    await onLoadSnapshots();
    setLoaded(true);
  };

  const location = selectedEstimate?.location;
  const currentPrice = selectedEstimate?.finalContractPrice || 0;
  const currentItems = editEstimate?.items || [];

  return (
    <InsightCard
      eyebrow="Snapshots"
      title="Version history"
      aside={
        !loaded ? (
          <button className="ghost-btn px-3 py-1.5 text-xs" type="button" onClick={handleLoad}>
            Load
          </button>
        ) : null
      }
    >
      <form className="flex gap-2 mb-3" onSubmit={handleCreate}>
        <input
          className="app-input flex-1 px-3 py-2 text-sm"
          placeholder="Snapshot label…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={busy}
        />
        <button className="ghost-btn px-3 py-1.5 text-xs" type="submit" disabled={busy || !label.trim()}>
          {busy ? "…" : "Save"}
        </button>
      </form>
      {loaded ? (
        snapshots.length ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {snapshots.map((snap) => {
              const delta = currentPrice - (snap.finalContractPrice || 0);
              const isActive = diffSnap?.id === snap.id;
              return (
                <div key={snap.id} className={`rounded-[14px] border px-3 py-2.5 transition cursor-pointer ${isActive ? "border-sky-400/30 bg-sky-400/[0.06]" : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}
                  onClick={() => setDiffSnap(isActive ? null : snap)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="surface-title text-sm font-semibold">{snap.label}</p>
                    <span className={`text-[11px] font-semibold ${delta > 0 ? "text-rose-300" : delta < 0 ? "text-emerald-300" : "text-slate-400"}`}>
                      {delta > 0 ? "+" : ""}{formatCurrency(delta, currencyCode, location)}
                    </span>
                  </div>
                  <p className="surface-meta text-xs mt-1">
                    {new Date(snap.createdAt).toLocaleString()} · {snap.itemCount} rows · {formatCurrency(snap.finalContractPrice || 0, currencyCode, location)}
                  </p>
                  {isActive ? null : <p className="surface-meta text-[10px] mt-1 opacity-60">Click to diff</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="surface-copy text-xs">No snapshots yet. Save one above to track changes over time.</p>
        )
      ) : (
        <p className="surface-copy text-xs">Click Load to see version history.</p>
      )}
      {diffSnap ? (
        <SnapshotDiffView
          snap={diffSnap}
          currentItems={currentItems}
          currencyCode={currencyCode}
          location={location}
          onClose={() => setDiffSnap(null)}
        />
      ) : null}
    </InsightCard>
  );
}

export function EstimatesPage({
  data,
  token,
  estimateForm,
  setEstimateForm,
  simulationForm,
  setSimulationForm,
  simulation,
  lastGeneratedEstimateId,
  marketRefreshResult,
  onSimulate,
  onGenerateEstimate,
  onGenerateWithPrompt,
  onRefreshEstimateMarketPrices,
  onUpdateEstimateStatus,
  onCreatePromptTemplate,
  generateBusy,
  promptTemplateBusy,
  marketRefreshBusy,
  statusBusy,
  selectedEstimateId,
  setSelectedEstimateId,
  editEstimate,
  setEditEstimate,
  onPatchEstimate,
  onCreateMaterialInline,
  materialBusy,
  patchBusy,
  exportBusy,
  notice,
  error,
  currencyCode,
  onGenerateFromDocument,
  docBusy,
  onRefresh,
  onDeleteEstimate,
  onBulkReprice,
  onCreateSnapshot,
  onLoadSnapshots,
  snapshots = [],
  bulkRepriceBusy = false,
  snapshotBusy = false,
  onCheckCompleteness,
  onExportSummaryPdf,
  onExportDpwhPdf
}) {
  const selectedEstimate = data.estimates.find((estimate) => estimate.id === selectedEstimateId) || data.estimates[0];
  const lastGeneratedEstimate = data.estimates.find((estimate) => estimate.id === lastGeneratedEstimateId) || null;
  const estimateBaseLocation = editEstimate.location || selectedEstimate?.location || data.currentProject?.location || estimateForm.prompt;
  const userRole = data.user?.role;
  const isApprovedEstimate = selectedEstimate?.status === "Approved";
  const canEditEstimate = ["Admin", "Estimator"].includes(userRole) && (userRole === "Admin" || !isApprovedEstimate);
  const canManageStatus = ["Admin", "Estimator"].includes(userRole) && (userRole === "Admin" || !isApprovedEstimate);
  const canApproveEstimate = userRole === "Admin";
  const isReadOnlyApproved = isApprovedEstimate && userRole !== "Admin";
  const canCreateMaterial = canEditEstimate;
  const invalidRowsExist = hasInvalidEstimateRows(editEstimate.items || []);
  const aiItemCount = useMemo(
    () => (editEstimate.items || []).filter((item) => item._aiSuggested).length,
    [editEstimate.items]
  );
  const promptQuality = useMemo(() => buildPromptQuality(estimateForm.prompt, estimateForm.discipline), [estimateForm.prompt, estimateForm.discipline]);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docConfidence, setDocConfidence] = useState(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(true);
  const [aiAssistantInput, setAiAssistantInput] = useState("");
  const [aiAssistantBusy, setAiAssistantBusy] = useState(false);
  const [aiAssistantHistory, setAiAssistantHistory] = useState([]);
  const [whatIfProposal, setWhatIfProposal] = useState(null);
  const [undoItems, setUndoItems] = useState(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentPlan, setAgentPlan] = useState(null);
  const [agentActionStatuses, setAgentActionStatuses] = useState({});
  const lastGenWasDocRef = useRef(false);
  const [didAutofillDefaultPrompt, setDidAutofillDefaultPrompt] = useState(false);
  const [materialToolsOpen, setMaterialToolsOpen] = useState(false);
  const [showInlineSave, setShowInlineSave] = useState(false);
  const [inlineSaveDraft, setInlineSaveDraft] = useState({ label: "", type: "General" });
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [generateMode, setGenerateMode] = useState("prompt");
  const defaultPromptTemplate = useMemo(
    () => (data.promptTemplates || []).find((template) => template.isDefault) || null,
    [data.promptTemplates]
  );
  const sortedPromptTemplates = useMemo(() => {
    const templates = [...(data.promptTemplates || [])];
    const byRecent = (left, right) =>
      new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
    return templates.sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
      return byRecent(left, right);
    });
  }, [data.promptTemplates]);
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedEstimate) {
      return false;
    }

    return normalizeEstimateForCompare(selectedEstimate) !== normalizeEstimateForCompare(editEstimate);
  }, [selectedEstimate, editEstimate]);
  const saveDisabled = patchBusy || invalidRowsExist || !selectedEstimate || !hasUnsavedChanges || !canEditEstimate;

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!defaultPromptTemplate || didAutofillDefaultPrompt || estimateForm.prompt.trim()) {
      return;
    }

    setEstimateForm((current) => ({ ...current, prompt: defaultPromptTemplate.prompt }));
    setDidAutofillDefaultPrompt(true);
  }, [defaultPromptTemplate, didAutofillDefaultPrompt, estimateForm.prompt, setEstimateForm]);

  useEffect(() => {
    if (!lastGeneratedEstimateId || !lastGenWasDocRef.current) {
      return;
    }
    lastGenWasDocRef.current = false;
    setEditEstimate((current) => ({
      ...current,
      items: (current.items || []).map((item) => ({ ...item, _aiSuggested: true }))
    }));
  }, [lastGeneratedEstimateId]);

  const onDocGenerate = async (payload, rawText) => {
    const conf = scoreConfidence(rawText || payload.prompt || "");
    setDocConfidence(conf);
    lastGenWasDocRef.current = true;
    await onGenerateFromDocument(payload);
    setDocModalOpen(false);
  };


  const onAssistantSubmit = async (event) => {
    event.preventDefault();
    const instruction = aiAssistantInput.trim();
    if (!instruction || !editEstimate.items?.length) {
      return;
    }
    setAiAssistantBusy(true);
    try {
      const result = await workspaceApi.refineEstimate(token, {
        items: editEstimate.items,
        instruction,
        areaHint: Number(editEstimate.areaSqm) || 60
      });
      if (result.isWhatIf) {
        // Show preview panel — don't touch BOQ yet
        const removedItems = editEstimate.items.filter(
          (old) => !result.items.some((n) => n._rowId === old._rowId || n.material === old.material)
        );
        setWhatIfProposal({
          instruction,
          explanation: result.explanation,
          items: result.items.map((item) => ({ ...item, _rowId: item._rowId || createClientId("estimate-row") })),
          removedItems,
          addedCount: result.addedCount,
          removedCount: result.removedCount
        });
      } else {
        // Direct command — apply immediately
        setWhatIfProposal(null);
        setUndoItems(null);
        setEditEstimate((current) => ({
          ...current,
          items: result.items.map((item) => ({
            ...item,
            _rowId: item._rowId || createClientId("estimate-row"),
            _aiSuggested: true
          }))
        }));
        setAiAssistantHistory((prev) => [
          { instruction, addedCount: result.addedCount, removedCount: result.removedCount, refinedCount: result.refinedCount },
          ...prev.slice(0, 4)
        ]);
      }
      setAiAssistantInput("");
    } catch (err) {
      // error handled globally
    } finally {
      setAiAssistantBusy(false);
    }
  };

  const onApplyWhatIf = () => {
    if (!whatIfProposal) return;
    setUndoItems(editEstimate.items);
    setEditEstimate((current) => ({ ...current, items: whatIfProposal.items }));
    setAiAssistantHistory((prev) => [
      { instruction: whatIfProposal.instruction, addedCount: whatIfProposal.addedCount, removedCount: whatIfProposal.removedCount, refinedCount: 0 },
      ...prev.slice(0, 4)
    ]);
    setWhatIfProposal(null);
  };

  const onDismissWhatIf = () => setWhatIfProposal(null);

  const onUndoWhatIf = () => {
    if (!undoItems) return;
    setEditEstimate((current) => ({ ...current, items: undoItems }));
    setUndoItems(null);
  };

  const onAgentSend = async (event) => {
    event.preventDefault();
    const message = agentInput.trim();
    if (!message) return;
    setAgentBusy(true);
    setAgentPlan(null);
    setAgentActionStatuses({});
    try {
      const currentEst = editEstimate || selectedEstimate;
      const result = await workspaceApi.agentCommand(token, {
        message,
        context: {
          currentEstimate: currentEst ? { id: currentEst.id, prompt: currentEst.prompt, status: currentEst.status } : null,
          itemCount: currentEst?.items?.length || 0,
          boqSample: (currentEst?.items || []).slice(0, 8).map((i) => ({ material: i.material, category: i.category })),
          projects: data.projects?.map((p) => ({ id: p.id, name: p.name })) || [],
          documentCount: data.documents?.length || 0
        }
      });
      setAgentPlan(result);
      setAgentInput("");
      // Auto-run all actions immediately without requiring user confirmation
      for (const action of (result.actions || [])) {
        if (action.autoRun) {
          setAgentActionStatuses((prev) => ({ ...prev, [action.id]: "done" }));
        } else {
          await executeAgentAction(action);
        }
      }
    } catch (err) {
      // error handled globally
    } finally {
      setAgentBusy(false);
    }
  };

  const executeAgentAction = async (action) => {
    setAgentActionStatuses((prev) => ({ ...prev, [action.id]: "running" }));
    try {
      if (action.tool === "create_project") {
        await workspaceApi.createProject(token, { name: action.args.name, location: action.args.location || "Philippines", areaSqm: action.args.areaSqm || 60, description: action.args.description || "" });
        if (onRefresh) await onRefresh();
      } else if (action.tool === "generate_estimate") {
        await workspaceApi.generateEstimate(token, { prompt: action.args.prompt, projectId: action.args.projectId || data.currentProject?.id });
        if (onRefresh) await onRefresh();
      } else if (action.tool === "update_estimate_status") {
        if (selectedEstimate?.id) {
          await workspaceApi.updateEstimateStatus(token, selectedEstimate.id, action.args.status);
          if (onRefresh) await onRefresh();
        }
      } else if (action.tool === "add_boq_items") {
        setUndoItems(editEstimate?.items || []);
        setEditEstimate((current) => ({
          ...current,
          items: [...(current.items || []), ...(action.args.items || []).map((item) => ({ ...item, _rowId: createClientId("agent-row"), _aiSuggested: true }))]
        }));
      } else if (action.tool === "remove_boq_items") {
        const pattern = (action.args.pattern || "").toLowerCase();
        setUndoItems(editEstimate?.items || []);
        setEditEstimate((current) => ({
          ...current,
          items: (current.items || []).filter((item) => !item.material.toLowerCase().includes(pattern))
        }));
      } else if (action.tool === "delete_document") {
        const doc = data.documents?.find((d) => d.filename?.toLowerCase().includes((action.args.documentName || "").toLowerCase()));
        if (doc) { await workspaceApi.deleteDocument(token, doc.id); await loadWorkspace(); }
      }
      setAgentActionStatuses((prev) => ({ ...prev, [action.id]: "done" }));
    } catch (err) {
      setAgentActionStatuses((prev) => ({ ...prev, [action.id]: "error" }));
    }
  };

  const onRunAllAgentActions = async () => {
    const pending = (agentPlan?.actions || []).filter((a) => !a.autoRun && agentActionStatuses[a.id] !== "done");
    for (const action of pending) {
      await executeAgentAction(action);
    }
  };

  const onAcceptAllAiSuggestions = () => {
    setEditEstimate((current) => ({
      ...current,
      items: (current.items || []).map((item) => {
        const next = { ...item };
        delete next._aiSuggested;
        return next;
      })
    }));
  };

  const applyPromptExample = (prompt) => {
    setEstimateForm((current) => ({ ...current, prompt }));
    setDidAutofillDefaultPrompt(true);
  };

  const openInlineSave = () => {
    const prompt = estimateForm.prompt.trim();
    if (!prompt) return;
    const autoType = estimateForm.discipline
      ? (DISCIPLINES.find((d) => d.key === estimateForm.discipline)?.label || "General")
      : "General";
    setInlineSaveDraft({ label: createPromptTemplateLabel(prompt), type: autoType });
    setShowInlineSave(true);
  };

  const saveInlineTemplate = async () => {
    const prompt = estimateForm.prompt.trim();
    if (!inlineSaveDraft.label.trim() || !prompt) return;
    await onCreatePromptTemplate({
      label: inlineSaveDraft.label,
      type: inlineSaveDraft.type,
      prompt,
      isDefault: !data.promptTemplates?.length
    });
    setShowInlineSave(false);
  };

  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <GenerateFromDocumentModal
        open={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        onGenerate={onDocGenerate}
        data={data}
        estimateForm={estimateForm}
        busy={docBusy}
      />
      <EstimatorMaterialTools
        open={materialToolsOpen}
        onClose={() => setMaterialToolsOpen(false)}
        materials={data.materials || []}
        setEditEstimate={setEditEstimate}
        onCreateMaterialInline={onCreateMaterialInline}
        materialBusy={materialBusy}
        canCreateMaterial={canCreateMaterial}
        currencyCode={currencyCode}
        baseLocation={estimateBaseLocation}
      />

      {/* Full-width workspace header */}
      <EstimateWorkspaceHeader
        selectedEstimate={selectedEstimate}
        currencyCode={currencyCode}
        data={data}
        selectedEstimateId={selectedEstimateId}
        setSelectedEstimateId={setSelectedEstimateId}
        onDeleteEstimate={onDeleteEstimate}
        hasUnsavedChanges={hasUnsavedChanges}
        patchBusy={patchBusy}
        saveDisabled={saveDisabled}
        onPatchEstimate={onPatchEstimate}
        exportBusy={exportBusy}
        marketRefreshBusy={marketRefreshBusy}
        canRefreshMarketPrices={canEditEstimate}
        onRefreshEstimateMarketPrices={onRefreshEstimateMarketPrices}
        onExportSummaryPdf={onExportSummaryPdf}
        onExportDpwhPdf={onExportDpwhPdf}
      />

      {/* Two-column page layout */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] items-start">

        {/* LEFT — generate + workspace */}
        <div className="space-y-6">

          {/* Step 1 — Generate */}
          <SectionCard
            title="Generate Draft"
            eyebrow="Generate"
            actions={
              canEditEstimate ? (
                <button className="ghost-btn" type="button" onClick={() => setDocModalOpen(true)}>
                  Generate from Document
                </button>
              ) : null
            }
          >
            {!data.projects.length ? (
              <div className="mb-6">
                <EmptyState
                  title="Add a project before generating an estimate"
                  description="Projects anchor the estimate flow, so create one first and then come back here to generate pricing."
                  action={<QuickLink to="/projects" label="Open Projects" tone="primary" />}
                />
              </div>
            ) : null}

            <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/[0.03] p-1 w-fit">
              {[{ key: "prompt", label: "AI Prompt" }, { key: "takeoff", label: "Takeoff Form" }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGenerateMode(key)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                    generateMode === key
                      ? "bg-sky-500/20 text-sky-200 border border-sky-400/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {generateMode === "takeoff" ? (
              <TakeoffAssistForm
                onSubmit={onGenerateWithPrompt}
                busy={generateBusy}
                canEdit={canEditEstimate}
              />
            ) : null}

            {generateMode === "prompt" ? (
            <form className="space-y-5" onSubmit={onGenerateEstimate}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="app-label font-medium">Project Brief</p>
                  <span className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    promptQuality.isReady
                      ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border border-sky-400/20 bg-sky-400/10 text-sky-300"
                  }`}>
                    {promptQuality.isReady ? "Ready" : "Needs detail"}
                  </span>
                </div>
                <textarea
                  className="app-input w-full px-3 py-2.5 text-sm"
                  rows={5}
                  placeholder="60 sqm bungalow, Quezon City, standard finish, 2BR, 1 bath, complete fit-out..."
                  value={estimateForm.prompt}
                  onChange={(event) => setEstimateForm((current) => ({ ...current, prompt: event.target.value }))}
                />

                {/* Inline saved prompts + starters */}
                {sortedPromptTemplates.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(showAllSaved ? sortedPromptTemplates : sortedPromptTemplates.slice(0, 4)).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          title={t.prompt}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 transition hover:border-sky-400/30 hover:bg-sky-400/[0.06]"
                          onClick={() => applyPromptExample(t.prompt)}
                        >
                          {t.isDefault ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" /> : null}
                          {t.label}
                        </button>
                      ))}
                      {sortedPromptTemplates.length > 4 ? (
                        <button
                          type="button"
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
                          onClick={() => setShowAllSaved((v) => !v)}
                        >
                          {showAllSaved ? "Show less" : `+${sortedPromptTemplates.length - 4} more`}
                        </button>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditEstimate && estimateForm.prompt.trim() && !showInlineSave ? (
                        <button
                          type="button"
                          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                          onClick={openInlineSave}
                          disabled={promptTemplateBusy}
                        >
                          Save prompt
                        </button>
                      ) : null}
                      {defaultPromptTemplate && estimateForm.prompt.trim() !== defaultPromptTemplate.prompt ? (
                        <button
                          type="button"
                          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                          onClick={() => applyPromptExample(defaultPromptTemplate.prompt)}
                        >
                          Use default
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : !estimateForm.prompt.trim() ? (
                  <div className="space-y-1.5">
                    <p className="surface-meta text-[11px] uppercase tracking-[0.18em]">Starters</p>
                    <div className="flex flex-col gap-1.5">
                      {DEMO_PROMPT_EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[12px] text-slate-300 transition hover:border-sky-400/30 hover:bg-sky-400/[0.06]"
                          onClick={() => applyPromptExample(ex)}
                        >
                          {ex.slice(0, 90)}…
                        </button>
                      ))}
                    </div>
                    {canEditEstimate && estimateForm.prompt.trim() && !showInlineSave ? (
                      <button
                        type="button"
                        className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                        onClick={openInlineSave}
                        disabled={promptTemplateBusy}
                      >
                        Save prompt
                      </button>
                    ) : null}
                  </div>
                ) : (
                  canEditEstimate && !showInlineSave ? (
                    <button
                      type="button"
                      className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                      onClick={openInlineSave}
                      disabled={promptTemplateBusy}
                    >
                      Save prompt
                    </button>
                  ) : null
                )}

                {/* Inline save form */}
                {showInlineSave ? (
                  <div className="rounded-[14px] border border-sky-400/20 bg-sky-400/[0.05] px-4 py-3 space-y-2">
                    <p className="surface-meta text-[11px] uppercase tracking-[0.2em]">Save as template</p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        autoComplete="off"
                        className="app-input flex-1 min-w-[140px] px-3 py-1.5 text-sm"
                        placeholder="Name"
                        value={inlineSaveDraft.label}
                        onChange={(e) => setInlineSaveDraft((d) => ({ ...d, label: e.target.value }))}
                      />
                      <select
                        className="app-input px-3 py-1.5 text-sm"
                        value={inlineSaveDraft.type}
                        onChange={(e) => setInlineSaveDraft((d) => ({ ...d, type: e.target.value }))}
                      >
                        <option value="General">General</option>
                        {DISCIPLINES.filter((d) => d.key).map((d) => (
                          <option key={d.key} value={d.label}>{d.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={saveInlineTemplate}
                        disabled={promptTemplateBusy || !inlineSaveDraft.label.trim()}
                      >
                        {promptTemplateBusy ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setShowInlineSave(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {promptQuality.warnings.length ? (
                  <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-4 py-3">
                    <div className="grid gap-1">
                      {promptQuality.warnings.slice(0, 3).map((warning) => (
                        <p key={warning} className="surface-copy text-sm">{warning}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {/* Discipline selector + standards panel */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="app-label block flex-1 min-w-[160px]">
                    <span>Discipline</span>
                    <select
                      className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                      value={estimateForm.discipline || ""}
                      onChange={(event) => setEstimateForm((current) => ({ ...current, discipline: event.target.value }))}
                    >
                      {DISCIPLINES.map((d) => (
                        <option key={d.key} value={d.key}>{d.label}</option>
                      ))}
                    </select>
                  </label>
                  {estimateForm.discipline ? (
                    <div className="pt-5">
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() =>
                          setEstimateForm((current) => ({
                            ...current,
                            prompt: refinePromptWithStandards(current.prompt, current.discipline)
                          }))
                        }
                        disabled={!estimateForm.prompt.trim() || !canEditEstimate}
                      >
                        Refine Prompt
                      </button>
                    </div>
                  ) : null}
                </div>
                {estimateForm.discipline && STANDARDS[estimateForm.discipline] ? (
                  <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="surface-meta mb-2 text-[11px] uppercase tracking-[0.18em]">
                      {STANDARDS[estimateForm.discipline].label} — Applicable Standards
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {STANDARDS[estimateForm.discipline].standards.map((s) => (
                        <div key={s.code} className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 rounded border border-sky-400/20 bg-sky-400/8 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                            {s.code}
                          </span>
                          <span className="surface-copy text-xs leading-4">{s.scope}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="app-label block">
                  <span>Project</span>
                  <select
                    className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                    value={estimateForm.projectId}
                    onChange={(event) => setEstimateForm((current) => ({ ...current, projectId: event.target.value }))}
                  >
                    <option value="">Use default project</option>
                    {data.projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
                <label className="app-label block">
                  <span>Template</span>
                  <select
                    className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                    value={estimateForm.templateId}
                    onChange={(event) => setEstimateForm((current) => ({ ...current, templateId: event.target.value }))}
                  >
                    <option value="">Use default template</option>
                    {data.templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </label>
                {(() => {
                  const tpl = data.templates.find((t) => t.id === estimateForm.templateId);
                  return tpl ? (
                    <p className="surface-meta mt-1 text-xs">
                      Overhead {tpl.overheadPercent}% · Profit {tpl.profitPercent}% · Contingency {tpl.contingencyPercent}%
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="primary-btn" type="submit" disabled={generateBusy || !canEditEstimate}>
                  {generateBusy ? "Generating..." : canEditEstimate ? "Generate Draft" : "Draft Restricted"}
                </button>
                <span className="surface-copy text-sm">AI draft becomes the active estimate.</span>
                {!canEditEstimate ? <Banner tone="warn">Read-only role. Draft generation is disabled.</Banner> : null}
              </div>
            </form>
            ) : null}
            {lastGeneratedEstimate ? (
              <div className="mt-5">
                <GeneratedDraftReview estimate={lastGeneratedEstimate} data={data} currencyCode={currencyCode} />
              </div>
            ) : null}
          </SectionCard>

          {/* Step 2 — Workspace */}
          {selectedEstimate ? (
            <SectionCard
              title="Estimate Workspace"
              eyebrow="Workspace"
              actions={
                canEditEstimate ? (
                  <button className="ghost-btn" type="button" onClick={() => setMaterialToolsOpen(true)}>
                    Item Builder
                  </button>
                ) : null
              }
            >
              <div className="space-y-6">
                <EstimateContextPanel selectedEstimate={selectedEstimate} data={data} currencyCode={currencyCode} />
                <InsightCard eyebrow="Margin Settings" title="Adjustments — saved with estimate">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ["Location", "location", "text"],
                      ["Area (sqm)", "areaSqm", "number"],
                      ["Waste %", "wasteFactorPercent", "number"],
                      ["Overhead %", "overheadPercent", "number"],
                      ["Profit %", "profitPercent", "number"],
                      ["Contingency %", "contingencyPercent", "number"]
                    ].map(([label, key, type]) => (
                      <Field
                        key={key}
                        label={label}
                        type={type}
                        min={type === "number" ? "0" : undefined}
                        step={type === "number" ? "0.01" : undefined}
                        value={editEstimate[key] ?? ""}
                        disabled={!canEditEstimate}
                        onChange={(event) => setEditEstimate((current) => ({ ...current, [key]: event.target.value }))}
                      />
                    ))}
                  </div>
                  {!canEditEstimate ? (
                    <div className="mt-4">
                      <Banner tone="warn">Viewers can inspect the BOQ and export PDFs, but cannot edit rows or create materials.</Banner>
                    </div>
                  ) : null}
                </InsightCard>
                <AIConfidenceBar
                  confidence={docConfidence}
                  aiItemCount={aiItemCount}
                  totalItemCount={(editEstimate.items || []).length}
                  onAcceptAll={onAcceptAllAiSuggestions}
                  canEdit={canEditEstimate}
                />
                <EditableEstimateTable
                  editEstimate={editEstimate}
                  setEditEstimate={setEditEstimate}
                  currencyCode={currencyCode}
                  baseLocation={estimateBaseLocation}
                  editable={canEditEstimate}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => onPatchEstimate(false)}
                    disabled={saveDisabled}
                    title={
                      invalidRowsExist
                        ? "Resolve invalid estimate rows before saving."
                        : !hasUnsavedChanges
                          ? "Make a change before saving again."
                          : undefined
                    }
                  >
                    {patchBusy
                      ? "Saving..."
                      : !canEditEstimate
                        ? "Read Only"
                        : invalidRowsExist
                          ? "Fix Rows to Save"
                          : !hasUnsavedChanges
                            ? "No Changes to Save"
                            : "Save Estimate Changes"}
                  </button>
                  <p className="surface-copy text-sm">
                    {invalidRowsExist
                      ? "Resolve the highlighted rows first."
                      : !canEditEstimate
                        ? "Read-only mode."
                        : hasUnsavedChanges
                          ? "Changes are local until saved."
                          : "In sync with last save."}
                  </p>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>

        {/* RIGHT — sticky panel */}
        <div className="sticky top-6 space-y-4">
          {selectedEstimate ? (
            <>
              <EstimateSaveStatus
                hasUnsavedChanges={hasUnsavedChanges}
                invalidRowsExist={invalidRowsExist}
                patchBusy={patchBusy}
                selectedEstimate={selectedEstimate}
                currencyCode={currencyCode}
              />
              <EstimateApprovalPanel
                selectedEstimate={selectedEstimate}
                onUpdateEstimateStatus={onUpdateEstimateStatus}
                statusBusy={statusBusy}
                canManageStatus={canManageStatus}
                canApproveEstimate={canApproveEstimate}
                isReadOnlyApproved={isReadOnlyApproved}
              />
              {selectedEstimate?.status === "Approved" && data.currentProject?.status === "Estimating" ? (
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-200">Estimate approved</p>
                  <p className="mt-1 text-xs text-emerald-200/70">
                    The linked project is still in <strong>Estimating</strong>. Go to Projects to move it to <strong>Submitted</strong> when you're ready to send the proposal.
                  </p>
                  <div className="mt-3">
                    <a href="/projects" className="ghost-btn inline-flex items-center text-xs">Update Project Status →</a>
                  </div>
                </div>
              ) : null}
              <InsightCard eyebrow="Scenario — Preview Only" title="What-if pricing">
                <form className="grid gap-3 grid-cols-2" onSubmit={onSimulate}>
                  {[
                    ["Direct Cost", "directCost"],
                    ["Overhead %", "overheadPercent"],
                    ["Profit %", "profitPercent"],
                    ["Contingency %", "contingencyPercent"]
                  ].map(([label, key]) => (
                    <Field
                      key={key}
                      label={label}
                      type="number"
                      min="0"
                      step="0.01"
                      value={simulationForm[key]}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  ))}
                  <div className="col-span-2 flex flex-wrap items-center gap-2 pt-1">
                    <button className="ghost-btn" type="submit">Preview Price</button>
                    <p className="surface-copy text-xs">Won't change the saved estimate.</p>
                  </div>
                </form>
                {simulation ? (
                  <div className="mt-4 grid gap-2 grid-cols-2">
                    <MetricCard label="Overhead" value={formatCurrency(simulation.overhead, currencyCode, estimateBaseLocation)} />
                    <MetricCard label="Profit" value={formatCurrency(simulation.profit, currencyCode, estimateBaseLocation)} />
                    <MetricCard label="Contingency" value={formatCurrency(simulation.contingency, currencyCode, estimateBaseLocation)} />
                    <MetricCard label="Final Price" value={formatCurrency(simulation.finalContractPrice, currencyCode, estimateBaseLocation)} />
                  </div>
                ) : (
                  <p className="mt-4 surface-copy text-xs">Enter values above and run to preview the final contract price without changing the saved estimate.</p>
                )}
              </InsightCard>
              <MarketRefreshReview result={marketRefreshResult} currencyCode={currencyCode} location={estimateBaseLocation} />
              <AgentPanel
                open={agentOpen}
                onToggle={() => setAgentOpen((p) => !p)}
                busy={agentBusy}
                plan={agentPlan}
                onSend={onAgentSend}
                onRunAction={executeAgentAction}
                onRunAll={onRunAllAgentActions}
                onClearPlan={() => { setAgentPlan(null); setAgentActionStatuses({}); }}
                actionStatuses={agentActionStatuses}
                agentInput={agentInput}
                setAgentInput={setAgentInput}
              />
              <WhatIfPanel
                proposal={whatIfProposal}
                onApply={onApplyWhatIf}
                onDismiss={onDismissWhatIf}
                undoItems={undoItems}
                onUndo={onUndoWhatIf}
                currencyCode={currencyCode}
                location={estimateBaseLocation}
              />
              <AIAssistantPanel
                assistantOpen={aiAssistantOpen}
                onToggle={() => setAiAssistantOpen((prev) => !prev)}
                input={aiAssistantInput}
                setInput={setAiAssistantInput}
                onSubmit={onAssistantSubmit}
                busy={aiAssistantBusy}
                history={aiAssistantHistory}
              />
              {onCheckCompleteness ? (
                <CompletenessPanel onCheckCompleteness={onCheckCompleteness} />
              ) : null}
              {onBulkReprice ? (
                <BulkRepricePanel onBulkReprice={onBulkReprice} busy={bulkRepriceBusy} />
              ) : null}
              {onCreateSnapshot ? (
                <SnapshotPanel
                  onCreateSnapshot={onCreateSnapshot}
                  onLoadSnapshots={onLoadSnapshots}
                  snapshots={snapshots}
                  busy={snapshotBusy}
                  selectedEstimate={selectedEstimate}
                  editEstimate={editEstimate}
                  currencyCode={currencyCode}
                />
              ) : null}
            </>
          ) : (
            <div className="dashboard-shell rounded-xl border p-5">
              <p className="section-eyebrow">Right panel</p>
              <p className="surface-title mt-2 text-base font-semibold">No estimate yet</p>
              <p className="surface-copy mt-2 text-sm">Generate a draft on the left to see save status, approval, and scenario controls here.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
