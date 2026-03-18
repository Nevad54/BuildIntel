import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createClientId, formatCurrency, number } from "../lib/app.js";
import { EmptyState, Field, MetricCard, SectionCard, Banner } from "../components/ui.jsx";

const ESTIMATE_FIELD_SEQUENCE = ["material", "quantity", "unit", "unitPrice", "category"];

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
          ? "border-amber-300/30 bg-amber-300/12 text-amber-100"
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

function buildPromptScopePreview(prompt = "") {
  const value = prompt.toLowerCase();
  const areaMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(sqm|sq\.?\s?m|m2)/i);
  const floorMatch = prompt.match(/(\d+)\s*[- ]?(storey|story|floor)/i);
  const bedroomMatch = prompt.match(/(\d+)\s*(bedroom|br)\b/i);
  const bathroomMatch = prompt.match(/(\d+)\s*(bathroom|bath|toilet)\b/i);
  const locationMatch = prompt.match(/\bin\s+([a-zA-Z0-9,\s-]+?)(?:\.|,|$)/i);
  const hasExcludedScope = (term) =>
    new RegExp(`(exclude|excluding|without|no)\\s+(?:[a-z0-9]+\\s+){0,6}${term}`, "i").test(prompt) ||
    /\bshell only\b/i.test(prompt);

  const projectType = /(fit out|fitout|office|tenant improvement|renovation|retail)/.test(value)
    ? "Fit-out"
    : /(warehouse|industrial|storage|depot)/.test(value)
      ? "Warehouse"
      : "Residential";

  const finishLevel = /(premium|high end|luxury|executive)/.test(value)
    ? "Premium"
    : /(basic|economy|bare|low cost)/.test(value)
      ? "Basic"
      : "Standard";

  const includedScopes = [
    !hasExcludedScope("electrical") ? "Electrical" : null,
    !hasExcludedScope("plumbing") ? "Plumbing" : null,
    !hasExcludedScope("painting") ? "Painting" : null,
    !hasExcludedScope("ceiling") && !/open ceiling/i.test(prompt) ? "Ceiling" : null,
    !hasExcludedScope("flooring") && !/(bare slab|no tiles|unfinished floor)/i.test(prompt) ? "Flooring" : null,
    !hasExcludedScope("doors") && !hasExcludedScope("windows") ? "Doors and windows" : null
  ].filter(Boolean);

  const excludedScopes = [
    hasExcludedScope("electrical") ? "Electrical" : null,
    hasExcludedScope("plumbing") ? "Plumbing" : null,
    hasExcludedScope("painting") ? "Painting" : null,
    hasExcludedScope("doors") ? "Doors" : null,
    hasExcludedScope("windows") ? "Windows" : null,
    hasExcludedScope("flooring") || /(bare slab|no tiles|unfinished floor)/i.test(prompt) ? "Flooring" : null
  ].filter(Boolean);

  return {
    projectType,
    finishLevel,
    area: areaMatch ? `${areaMatch[1]} sqm` : "Default area",
    floors: floorMatch ? `${floorMatch[1]} storey` : /two storey|two story|2 storey|2 story/i.test(prompt) ? "2 storey" : "1 storey",
    bedrooms: bedroomMatch ? `${bedroomMatch[1]} bedrooms` : projectType === "Residential" ? "2 bedrooms" : "Not specified",
    bathrooms: bathroomMatch ? `${bathroomMatch[1]} bathrooms` : projectType === "Residential" ? "1 bathroom" : "Not specified",
    location: locationMatch ? locationMatch[1].trim() : "Metro Manila",
    includedScopes,
    excludedScopes
  };
}

function buildPromptQuality(prompt = "") {
  const trimmed = prompt.trim();
  const value = trimmed.toLowerCase();
  const warnings = [];

  if (!trimmed) {
    warnings.push("Add a prompt so the draft generator has something to work from.");
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

function EstimateSummary({ selectedEstimate, currencyCode }) {
  if (!selectedEstimate) {
    return (
      <EmptyState
        title="No estimate selected yet"
        description="Generate an estimate draft first, then come back here to review totals, costs, and export readiness."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Direct Cost" value={formatCurrency(selectedEstimate.directCost || 0, currencyCode, selectedEstimate.location)} />
      <MetricCard label="Final Price" value={formatCurrency(selectedEstimate.finalContractPrice || 0, currencyCode, selectedEstimate.location)} />
      <MetricCard label="Waste" value={`${number.format(selectedEstimate.wasteFactorPercent || 0)}%`} />
      <MetricCard label="Labor" value={formatCurrency(selectedEstimate.laborCost || 0, currencyCode, selectedEstimate.location)} />
      <MetricCard label="Equipment" value={formatCurrency(selectedEstimate.equipmentCost || 0, currencyCode, selectedEstimate.location)} />
    </div>
  );
}

function EstimateSelectionBar({
  data,
  selectedEstimate,
  selectedEstimateId,
  setSelectedEstimateId,
  onPatchEstimate,
  onRefreshEstimateMarketPrices,
  exportBusy,
  marketRefreshBusy,
  canRefreshMarketPrices
}) {
  if (!selectedEstimate) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="app-label text-sm">
        <span className="sr-only">Estimate selector</span>
        <select
          className="app-input rounded-full px-4 py-2"
          value={selectedEstimateId || ""}
          onChange={(event) => setSelectedEstimateId(event.target.value)}
        >
          {data.estimates.map((estimate) => (
            <option key={estimate.id} value={estimate.id}>
              {estimate.prompt.slice(0, 64)}
            </option>
          ))}
        </select>
      </label>
      <button className="ghost-btn" type="button" onClick={() => onPatchEstimate(true)} disabled={exportBusy}>
        {exportBusy ? "Opening..." : "Export PDF Proposal"}
      </button>
      <button className="ghost-btn" type="button" onClick={onRefreshEstimateMarketPrices} disabled={marketRefreshBusy || !canRefreshMarketPrices}>
        {marketRefreshBusy ? "Refreshing..." : canRefreshMarketPrices ? "Refresh Market Prices" : "Refresh Restricted"}
      </button>
    </div>
  );
}

function EstimateHealth({ selectedEstimate, currencyCode }) {
  if (!selectedEstimate) {
    return null;
  }

  return (
    <div className="surface-card rounded-[24px] p-5">
      <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Estimate Health</p>
      <h3 className="surface-title mt-2 text-xl font-semibold">Ready to refine</h3>
      <p className="surface-copy mt-2 text-sm leading-6">
        Use the editable workspace below to adjust inputs, rebalance pricing, and export the final proposal once the totals look right.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Items" value={number.format(selectedEstimate.items?.length || 0)} />
        <MetricCard label="Saved Price" value={formatCurrency(selectedEstimate.finalContractPrice || 0, currencyCode, selectedEstimate.location)} />
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
                  <div className="h-full rounded-full bg-amber-400/80" style={{ width: `${Math.min(share, 100)}%` }} />
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

  return date.toLocaleString();
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
    <div className="grid gap-4 xl:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
      <Banner tone={saveTone}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] opacity-80">Save Status</p>
            <p className="mt-1 font-semibold">{saveState}</p>
          </div>
          <p className="text-sm opacity-90">
            {patchBusy
              ? "We are recalculating totals and syncing this draft now."
              : invalidRowsExist
                ? "Resolve the highlighted rows before saving."
                : hasUnsavedChanges
                  ? "Your BOQ edits are local until you save."
                  : "This draft matches the latest saved estimate."}
          </p>
        </div>
      </Banner>
      <MetricCard label="Last Saved" value={formatEstimateSaveTime(lastSavedAt)} />
      <MetricCard label="Draft Value" value={formatCurrency(draftValue, currencyCode, selectedEstimate?.location)} />
      <MetricCard
        label="Export Readiness"
        value={invalidRowsExist ? "Blocked" : hasUnsavedChanges ? "Needs Save" : "Ready"}
        note={invalidRowsExist ? "Fix row errors first" : hasUnsavedChanges ? "Save to sync export" : "PDF export is aligned"}
      />
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
              : "bg-amber-300/10 text-amber-100 border border-amber-300/20"
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
                className="rounded-[14px] border border-black/5 bg-white/20 px-4 py-3 text-sm transition hover:border-amber-300/30 hover:bg-white/30 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-100 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-amber-300/40 dark:hover:bg-amber-300/10 ${className}`}
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
          <PriceDeltaBadge item={item} currencyCode={currencyCode} location={baseLocation} compact />
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

function EstimateRowActions({ index, totalItems, setEditEstimate, compact = false, editable = true }) {
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
            category: category || "Materials"
          }
        ]
      }));
      focusEstimateField(newRowId, ESTIMATE_FIELD_SEQUENCE[0]);
    }
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
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Row Count" value={number.format(editEstimate.items?.length || 0)} />
        <MetricCard
          label="Draft Item Total"
          value={formatCurrency(estimateTotal, currencyCode, baseLocation)}
          note="Live subtotal before save recalculates the full estimate"
        />
        <MetricCard
          label="Average Row"
          value={formatCurrency((editEstimate.items?.length ? estimateTotal / editEstimate.items.length : 0), currencyCode, baseLocation)}
        />
        {groupedItems.map((group) => (
          <MetricCard
            key={group.category}
            label={`${group.category} Total`}
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
                <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200 dark:text-amber-100">
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
            <table className="min-w-[900px] w-full text-[13px] leading-5">
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead className="table-head text-left">
                <tr>
                  {["Material", "Qty", "Unit", "Unit Price", "Subtotal", "Category", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium uppercase tracking-[0.16em]">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.length ? (
                  group.items.map(({ item, index }) => (
                    <tr key={item._rowId || index} className="table-row align-top hidden md:table-row">
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
                        <EstimateRowActions index={index} totalItems={editEstimate.items.length} setEditEstimate={setEditEstimate} editable={editable} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="table-row">
                    <td className="px-4 py-6 surface-copy text-sm" colSpan={7}>
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
                      <EstimateRowActions index={index} totalItems={editEstimate.items.length} setEditEstimate={setEditEstimate} compact editable={editable} />
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

  return (
    <div className="surface-card rounded-[24px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Item Builder</p>
          <h3 className="surface-title mt-2 text-lg font-semibold">Add rows fast</h3>
        </div>
        <div className="flex flex-wrap gap-2">
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
                className="app-input mt-2 w-full rounded-2xl px-4 py-3"
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
  );
}

export function EstimatesPage({
  data,
  estimateForm,
  setEstimateForm,
  simulationForm,
  setSimulationForm,
  simulation,
  lastGeneratedEstimateId,
  marketRefreshResult,
  onSimulate,
  onGenerateEstimate,
  onRefreshEstimateMarketPrices,
  onUpdateEstimateStatus,
  onCreatePromptTemplate,
  onUpdatePromptTemplate,
  onDeletePromptTemplate,
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
  currencyCode
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
  const promptScopePreview = useMemo(() => buildPromptScopePreview(estimateForm.prompt), [estimateForm.prompt]);
  const promptQuality = useMemo(() => buildPromptQuality(estimateForm.prompt), [estimateForm.prompt]);
  const promptTemplateTypes = useMemo(
    () => ["All", ...new Set((data.promptTemplates || []).map((template) => template.type || "General"))],
    [data.promptTemplates]
  );
  const [selectedPromptTemplateType, setSelectedPromptTemplateType] = useState("All");
  const [promptTemplateSort, setPromptTemplateSort] = useState("default");
  const [didAutofillDefaultPrompt, setDidAutofillDefaultPrompt] = useState(false);
  const defaultPromptTemplate = useMemo(
    () => (data.promptTemplates || []).find((template) => template.isDefault) || null,
    [data.promptTemplates]
  );
  const filteredPromptTemplates = useMemo(() => {
    if (selectedPromptTemplateType === "All") {
      return data.promptTemplates || [];
    }

    return (data.promptTemplates || []).filter(
      (template) => (template.type || "General") === selectedPromptTemplateType
    );
  }, [data.promptTemplates, selectedPromptTemplateType]);
  const sortedPromptTemplates = useMemo(() => {
    const templates = [...filteredPromptTemplates];

    const byRecent = (left, right) =>
      new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();

    if (promptTemplateSort === "recent") {
      return templates.sort(byRecent);
    }

    if (promptTemplateSort === "type") {
      return templates.sort((left, right) => {
        const typeCompare = (left.type || "General").localeCompare(right.type || "General");
        if (typeCompare !== 0) {
          return typeCompare;
        }

        return left.label.localeCompare(right.label);
      });
    }

    return templates.sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }

      return byRecent(left, right);
    });
  }, [filteredPromptTemplates, promptTemplateSort]);
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

  const [editingPromptTemplateId, setEditingPromptTemplateId] = useState("");
  const [promptTemplateDraft, setPromptTemplateDraft] = useState({ label: "", prompt: "", type: "General" });

  const applyPromptExample = (prompt) => {
    setEstimateForm((current) => ({ ...current, prompt }));
    setDidAutofillDefaultPrompt(true);
  };

  const onSavePromptTemplate = async () => {
    const prompt = estimateForm.prompt.trim();
    if (!prompt) {
      return;
    }

    if (data.promptTemplates?.some((entry) => entry.prompt === prompt)) {
      return;
    }

    await onCreatePromptTemplate({
      label: createPromptTemplateLabel(prompt),
      type: promptScopePreview.projectType,
      isDefault: !data.promptTemplates?.length,
      prompt
    });
  };

  const onRemovePromptTemplate = async (templateId) => {
    await onDeletePromptTemplate(templateId);
  };

  const onStartEditingPromptTemplate = (template) => {
    setEditingPromptTemplateId(template.id);
    setPromptTemplateDraft({
      label: template.label,
      prompt: template.prompt,
      type: template.type || "General"
    });
  };

  const onCancelEditingPromptTemplate = () => {
    setEditingPromptTemplateId("");
    setPromptTemplateDraft({ label: "", prompt: "", type: "General" });
  };

  const onSavePromptTemplateEdit = async (templateId) => {
    await onUpdatePromptTemplate(templateId, promptTemplateDraft);
    onCancelEditingPromptTemplate();
  };

  const onSetDefaultPromptTemplate = async (template) => {
    await onUpdatePromptTemplate(template.id, { isDefault: true });
  };

  const onDuplicatePromptTemplate = async (template) => {
    await onCreatePromptTemplate({
      label: `${template.label} Copy`,
      type: template.type || "General",
      prompt: template.prompt,
      isDefault: false
    });
  };

  const onUseDefaultPromptTemplate = () => {
    if (!defaultPromptTemplate) {
      return;
    }

    applyPromptExample(defaultPromptTemplate.prompt);
  };

  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="Estimator"
        eyebrow="Workspace"
        actions={
          <div className="flex flex-wrap gap-2">
            <QuickLink to="/projects" label="Projects" />
            <QuickLink to="/pricing" label="Pricing" />
          </div>
        }
      >
        <EstimateSummary selectedEstimate={selectedEstimate} currencyCode={currencyCode} />
      </SectionCard>

      <div className="space-y-6">
        <SectionCard title="AI Draft" eyebrow="Step 1">
          {!data.projects.length ? (
            <div className="mb-6">
              <EmptyState
                title="Add a project before generating an estimate"
                description="Projects anchor the estimate flow, so create one first and then come back here to generate pricing."
                action={<QuickLink to="/projects" label="Open Projects" tone="primary" />}
              />
            </div>
          ) : null}
          <form className="space-y-6" onSubmit={onGenerateEstimate}>
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
              <div className="space-y-4">
                <InsightCard
                  eyebrow="Brief"
                  title="Prompt"
                  aside={
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      promptQuality.isReady
                        ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                        : "border border-amber-300/20 bg-amber-300/10 text-amber-100"
                    }`}>
                      {promptQuality.isReady ? "Ready" : "Needs detail"}
                    </span>
                  }
                >
                  <Field
                    label="Prompt"
                    type="textarea"
                    rows={6}
                    placeholder="60 sqm bungalow, Quezon City, standard finish, 2BR, 1 bath, complete fit-out..."
                    value={estimateForm.prompt}
                    onChange={(event) => setEstimateForm((current) => ({ ...current, prompt: event.target.value }))}
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="app-label block text-sm">
                      <span>Project</span>
                      <select
                        className="app-input mt-2 w-full rounded-2xl px-4 py-3"
                        value={estimateForm.projectId}
                        onChange={(event) => setEstimateForm((current) => ({ ...current, projectId: event.target.value }))}
                      >
                        <option value="">Use default project</option>
                        {data.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="app-label block text-sm">
                      <span>Template</span>
                      <select
                        className="app-input mt-2 w-full rounded-2xl px-4 py-3"
                        value={estimateForm.templateId}
                        onChange={(event) => setEstimateForm((current) => ({ ...current, templateId: event.target.value }))}
                      >
                        <option value="">Use default template</option>
                        {data.templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {promptQuality.warnings.length ? (
                    <div className="mt-4 rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-4 py-3">
                      <div className="grid gap-1">
                        {promptQuality.warnings.slice(0, 3).map((warning) => (
                          <p key={warning} className="surface-copy text-sm">{warning}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button className="primary-btn" type="submit" disabled={generateBusy || !canEditEstimate}>
                      {generateBusy ? "Generating..." : canEditEstimate ? "Generate Draft" : "Draft Restricted"}
                    </button>
                    <span className="surface-copy text-sm">Latest draft becomes active.</span>
                  </div>
                  {!canEditEstimate ? (
                    <div className="mt-4">
                      <Banner tone="warn">Read-only role. Draft generation is disabled.</Banner>
                    </div>
                  ) : null}
                </InsightCard>
                {lastGeneratedEstimate ? <GeneratedDraftReview estimate={lastGeneratedEstimate} data={data} currencyCode={currencyCode} /> : null}
              </div>

              <div className="space-y-4">
                <InsightCard eyebrow="Starters" title="Quick prompts">
                  <div className="flex flex-wrap gap-2">
                    {DEMO_PROMPT_EXAMPLES.map((prompt, index) => (
                      <CommandChip key={prompt} onClick={() => applyPromptExample(prompt)}>
                        Example {index + 1}
                      </CommandChip>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Type", promptScopePreview.projectType],
                      ["Finish", promptScopePreview.finishLevel],
                      ["Area", promptScopePreview.area],
                      ["Location", promptScopePreview.location],
                      ["Storeys", promptScopePreview.floors],
                      ["Bedrooms", promptScopePreview.bedrooms],
                      ["Baths", promptScopePreview.bathrooms],
                      ["Scope", promptScopePreview.includedScopes.join(", ") || "Core only"]
                    ].map(([label, value]) => (
                      <MiniStat key={label} label={label} value={value} />
                    ))}
                  </div>
                  {promptScopePreview.excludedScopes.length ? (
                    <div className="mt-3 rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-4 py-3">
                      <p className="surface-copy text-sm">Excluded: {promptScopePreview.excludedScopes.join(", ")}</p>
                    </div>
                  ) : null}
                </InsightCard>

                <InsightCard
                  eyebrow="Saved"
                  title="Prompt library"
              aside={
                <div className="flex flex-wrap gap-2">
                  <label className="app-label text-xs">
                    <span className="sr-only">Prompt template type filter</span>
                    <select
                      className="app-input rounded-full px-4 py-2 text-xs"
                      value={selectedPromptTemplateType}
                      onChange={(event) => setSelectedPromptTemplateType(event.target.value)}
                    >
                      {promptTemplateTypes.map((type) => (
                        <option key={type} value={type}>
                          {type === "All" ? "All types" : type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="app-label text-xs">
                    <span className="sr-only">Prompt template sort</span>
                    <select
                      className="app-input rounded-full px-4 py-2 text-xs"
                      value={promptTemplateSort}
                      onChange={(event) => setPromptTemplateSort(event.target.value)}
                    >
                      <option value="default">Default first</option>
                      <option value="recent">Most recent</option>
                      <option value="type">Type</option>
                    </select>
                  </label>
                </div>
              }
                >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="surface-copy max-w-2xl text-sm">Save the prompts you actually reuse.</p>
                  <div className="flex flex-wrap gap-2">
                    {defaultPromptTemplate && estimateForm.prompt.trim() !== defaultPromptTemplate.prompt ? (
                      <CommandChip onClick={onUseDefaultPromptTemplate}>
                        Use Default
                      </CommandChip>
                    ) : null}
                  <CommandChip
                    type="button"
                    onClick={onSavePromptTemplate}
                    disabled={!estimateForm.prompt.trim() || promptTemplateBusy || !canEditEstimate}
                  >
                      {promptTemplateBusy ? "Saving..." : canEditEstimate ? "Save current" : "Save restricted"}
                  </CommandChip>
                  </div>
                </div>
                {data.promptTemplates?.length ? (
                  <div className="grid gap-3">
                    {sortedPromptTemplates.map((template) => (
                      <div key={template.id} className="rounded-[16px] border border-black/5 bg-white/20 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
                        <div className="space-y-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="surface-title text-sm font-semibold">{template.label}</p>
                              <span className="rounded-full border border-black/5 bg-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] dark:border-white/8 dark:bg-white/[0.03]">
                                {template.type || "General"}
                              </span>
                              {template.isDefault ? (
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            {editingPromptTemplateId === template.id ? (
                              <div className="mt-3 space-y-3">
                                <Field
                                  label="Label"
                                  value={promptTemplateDraft.label}
                                  onChange={(event) => setPromptTemplateDraft((current) => ({ ...current, label: event.target.value }))}
                                />
                                <Field
                                  label="Type"
                                  value={promptTemplateDraft.type}
                                  onChange={(event) => setPromptTemplateDraft((current) => ({ ...current, type: event.target.value }))}
                                />
                                <Field
                                  label="Prompt"
                                  type="textarea"
                                  rows={4}
                                  value={promptTemplateDraft.prompt}
                                  onChange={(event) => setPromptTemplateDraft((current) => ({ ...current, prompt: event.target.value }))}
                                />
                              </div>
                            ) : (
                              <p className="surface-copy mt-1 break-words text-sm leading-6">{template.prompt}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <CommandChip onClick={() => applyPromptExample(template.prompt)}>Use</CommandChip>
                            {editingPromptTemplateId === template.id ? (
                              <>
                                <CommandChip type="button" onClick={() => onSavePromptTemplateEdit(template.id)} disabled={promptTemplateBusy}>
                                  {promptTemplateBusy ? "Saving..." : "Save"}
                                </CommandChip>
                                <CommandChip type="button" onClick={onCancelEditingPromptTemplate}>
                                  Cancel
                                </CommandChip>
                              </>
                            ) : (
                              <>
                                {!template.isDefault ? (
                                  <CommandChip type="button" onClick={() => onSetDefaultPromptTemplate(template)} disabled={promptTemplateBusy || !canEditEstimate}>
                                    Default
                                  </CommandChip>
                                ) : null}
                                <CommandChip type="button" onClick={() => onDuplicatePromptTemplate(template)} disabled={promptTemplateBusy || !canEditEstimate}>
                                  Save As
                                </CommandChip>
                                <CommandChip type="button" onClick={() => onStartEditingPromptTemplate(template)} disabled={!canEditEstimate}>
                                  Edit
                                </CommandChip>
                                <CommandChip type="button" onClick={() => onRemovePromptTemplate(template.id)} disabled={promptTemplateBusy || !canEditEstimate}>
                                  {promptTemplateBusy ? "Working..." : "Remove"}
                                </CommandChip>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {data.promptTemplates?.length && !filteredPromptTemplates.length ? (
                  <div className="rounded-[16px] border border-dashed border-black/10 px-4 py-4 text-sm dark:border-white/10">
                    <p className="surface-copy">No saved prompts match this type yet. Switch the filter or save a new prompt for this workflow.</p>
                  </div>
                ) : (
                  !data.promptTemplates?.length ? (
                    <div className="rounded-[16px] border border-dashed border-black/10 px-4 py-4 text-sm dark:border-white/10">
                      <p className="surface-copy">Save a prompt after you refine it once, and it will stay available for your workspace on future estimates.</p>
                    </div>
                  ) : null
                )}
              </div>
            </InsightCard>
              </div>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Scenario" eyebrow="Step 2">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSimulate}>
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
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button className="ghost-btn" type="submit">
                Run Simulation
              </button>
              <p className="surface-copy text-sm">Stress-test price strategy before saving.</p>
            </div>
          </form>
          <div>
          {simulation ? (
            <div className="grid gap-3 md:grid-cols-2">
              <MetricCard label="Overhead" value={formatCurrency(simulation.overhead, currencyCode, estimateBaseLocation)} />
              <MetricCard label="Profit" value={formatCurrency(simulation.profit, currencyCode, estimateBaseLocation)} />
              <MetricCard label="Contingency" value={formatCurrency(simulation.contingency, currencyCode, estimateBaseLocation)} />
              <MetricCard label="Final Price" value={formatCurrency(simulation.finalContractPrice, currencyCode, estimateBaseLocation)} />
            </div>
          ) : (
            <EstimateHealth selectedEstimate={selectedEstimate} currencyCode={currencyCode} />
          )}
          </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Finalize"
        eyebrow="Step 3"
        actions={
            <EstimateSelectionBar
              data={data}
              selectedEstimate={selectedEstimate}
              selectedEstimateId={selectedEstimateId}
              setSelectedEstimateId={setSelectedEstimateId}
              onPatchEstimate={onPatchEstimate}
              onRefreshEstimateMarketPrices={onRefreshEstimateMarketPrices}
              exportBusy={exportBusy}
              marketRefreshBusy={marketRefreshBusy}
              canRefreshMarketPrices={canEditEstimate}
            />
        }
      >
        {!selectedEstimate ? (
          <Banner tone="warn">Generate an estimate to unlock the editable workspace.</Banner>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
              <div className="space-y-6">
                <EstimateContextPanel selectedEstimate={selectedEstimate} data={data} currencyCode={currencyCode} />
                <InsightCard eyebrow="Inputs" title="Assumptions">
                  <div className="grid gap-4 md:grid-cols-2">
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
                </InsightCard>
                {canEditEstimate ? (
                  <EstimatorMaterialTools
                    materials={data.materials || []}
                    setEditEstimate={setEditEstimate}
                    onCreateMaterialInline={onCreateMaterialInline}
                    materialBusy={materialBusy}
                    canCreateMaterial={canCreateMaterial}
                    currencyCode={currencyCode}
                    baseLocation={estimateBaseLocation}
                  />
                ) : (
                  <InsightCard eyebrow="Item Builder" title="Read only">
                    <Banner tone="warn">Viewers can inspect the BOQ and export PDFs, but cannot edit rows or create materials.</Banner>
                  </InsightCard>
                )}
              </div>
              <div className="space-y-6">
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
                <MarketRefreshReview result={marketRefreshResult} currencyCode={currencyCode} location={estimateBaseLocation} />
              </div>
            </div>
            <EditableEstimateTable editEstimate={editEstimate} setEditEstimate={setEditEstimate} currencyCode={currencyCode} baseLocation={estimateBaseLocation} editable={canEditEstimate} />
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
                    ? "Resolve the highlighted rows first. Saving stays disabled until every estimate line is valid."
                    : !canEditEstimate
                      ? "This estimate is visible in read-only mode for viewers."
                    : hasUnsavedChanges
                      ? "Your changes are local to this workspace until you save them."
                    : "This estimate is already in sync. Export is ready whenever you need it."}
              </p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
