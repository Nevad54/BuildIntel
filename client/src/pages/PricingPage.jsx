import { useState, useCallback } from "react";
import { formatCurrency, number } from "../lib/app.js";
import { ActionMenu, Banner, EmptyState, Field, MetricCard, QuickLink, SectionCard } from "../components/ui.jsx";

const TREND_DOT = {
  Rising: "bg-rose-400",
  Stable: "bg-sky-400",
  Falling: "bg-emerald-400"
};

function PricingOverview({ data, pricingResult, supplierResults, currencyCode }) {
  const materials = data.materials || [];
  const alerts = data.alerts || [];
  const uniqueSuppliers = new Set(materials.flatMap((m) => m.suppliers || [])).size;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Catalog Materials" value={number.format(materials.length)} note={`${number.format(uniqueSuppliers)} known supplier partners`} />
      <MetricCard label="Open Alerts" value={number.format(alerts.length)} note="Trend signals and pricing movement" />
      <MetricCard
        label="Supplier Matches"
        value={number.format(supplierResults.length)}
        note={supplierResults.length ? "Comparison list ready" : "Run supplier finder below"}
      />
      <MetricCard
        label="Recommended Rate"
        value={pricingResult ? formatCurrency(pricingResult.recommendedEstimatePrice || 0, currencyCode, pricingResult.location) : "No research yet"}
        note={pricingResult ? `${number.format(pricingResult.suppliers?.length || 0)} price points used` : "Search a material below"}
      />
    </div>
  );
}

function AddToCatalogButton({ supplier, material, onAdd, busy }) {
  const [added, setAdded] = useState(false);

  const handleAdd = async () => {
    await onAdd({
      name: material || supplier.material || "",
      unit: supplier.unit || "unit",
      averagePrice: supplier.price || 0,
      lastMonthPrice: supplier.price || 0,
      trend: "Stable",
      suppliers: [supplier.supplier].filter(Boolean)
    });
    setAdded(true);
  };

  if (added) {
    return <span className="text-xs text-emerald-400 font-semibold">Added</span>;
  }

  return (
    <button
      type="button"
      className="ghost-btn px-3 py-1.5 text-xs"
      onClick={handleAdd}
      disabled={busy}
    >
      + Add to Catalog
    </button>
  );
}

function ResearchSnapshot({ pricingResult, alerts, currencyCode, onCreateMaterialInline, materialBusy }) {
  if (!pricingResult) {
    return (
      <EmptyState
        title="No market snapshot yet"
        description="Search a material and location to surface a recommended rate, supplier spread, and recent price signals."
      />
    );
  }

  const topSuppliers = (pricingResult.suppliers || []).slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Lowest" value={formatCurrency(pricingResult.lowestPrice || 0, currencyCode, pricingResult.location)} />
        <MetricCard label="Average" value={formatCurrency(pricingResult.averagePrice || 0, currencyCode, pricingResult.location)} />
        <MetricCard label="Recommended" value={formatCurrency(pricingResult.recommendedEstimatePrice || 0, currencyCode, pricingResult.location)} />
      </div>

      {pricingResult.bestSupplier ? (
        <div className="accent-card rounded-[22px] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="accent-eyebrow text-xs uppercase tracking-[0.24em]">Best Supplier</p>
            {onCreateMaterialInline ? (
              <AddToCatalogButton
                supplier={pricingResult.bestSupplier}
                material={pricingResult.material}
                onAdd={onCreateMaterialInline}
                busy={materialBusy}
              />
            ) : null}
          </div>
          <p className="accent-value mt-3 text-2xl font-semibold">{pricingResult.bestSupplier.supplier}</p>
          <p className="accent-copy mt-2 text-sm">
            {formatCurrency(pricingResult.bestSupplier.price || 0, currencyCode, pricingResult.bestSupplier.location || pricingResult.location)} / {pricingResult.bestSupplier.unit || "unit"} / {pricingResult.bestSupplier.location}
          </p>
          <p className="accent-copy mt-2 text-sm">
            Delivery: {pricingResult.bestSupplier.delivery || "Unknown"} · Confidence: {pricingResult.bestSupplier.confidence || "unrated"}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card rounded-[22px] p-5">
          <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Top Price Points</p>
          <div className="mt-4 space-y-3">
            {topSuppliers.length ? (
              topSuppliers.map((s) => (
                <div key={`${s.supplier}-${s.location}-${s.material}`} className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <div>
                    <p className="surface-title text-sm font-semibold">{s.supplier}</p>
                    <p className="surface-copy mt-1 text-sm">{s.material} / {s.location}</p>
                    {s.distanceKm != null ? (
                      <p className="surface-meta mt-1 text-xs">{number.format(s.distanceKm)} km away</p>
                    ) : null}
                    <p className="surface-meta mt-1 text-xs uppercase tracking-[0.2em]">{s.source || "manual"} · {s.confidence || "unrated"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="surface-title text-sm font-semibold">{formatCurrency(s.price || 0, currencyCode, s.location || pricingResult.location)}</p>
                    <p className="surface-copy text-sm">{s.delivery || "Delivery unknown"}</p>
                    {onCreateMaterialInline ? (
                      <AddToCatalogButton
                        supplier={s}
                        material={pricingResult.material}
                        onAdd={onCreateMaterialInline}
                        busy={materialBusy}
                      />
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="surface-copy text-sm">No supplier rows available for this search yet.</p>
            )}
          </div>
        </div>

        <div className="surface-card rounded-[22px] p-5">
          <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Signals</p>
          <div className="mt-4 space-y-3">
            {alerts.length ? (
              alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-[18px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <p className="surface-title text-sm font-semibold">{alert.title}</p>
                  <p className="surface-meta mt-2 text-xs uppercase tracking-[0.2em]">{alert.severity}</p>
                </div>
              ))
            ) : (
              <p className="surface-copy text-sm">No active pricing alerts right now.</p>
            )}
            {pricingResult.sources?.length ? (
              <div className="pt-2">
                <p className="surface-meta text-xs uppercase tracking-[0.2em]">Sources Used</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pricingResult.sources.map((source) => (
                    <span key={source} className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">{source}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupplierComparison({ supplierResults, currencyCode, onCreateMaterialInline, materialBusy }) {
  if (!supplierResults.length) {
    return (
      <EmptyState
        title="No supplier comparison yet"
        description="Search by location and material to compare nearby options before locking the estimate rate."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {supplierResults.map((s) => (
        <div key={`${s.supplier}-${s.location}-${s.material}`} className="surface-card rounded-[20px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="surface-title text-sm font-semibold">{s.supplier}</p>
              <p className="surface-copy mt-1 text-sm">{s.material} / {s.location}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">{s.delivery || "Delivery unknown"}</span>
                <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">{s.distanceKm ? `${number.format(s.distanceKm)} km away` : "Distance unknown"}</span>
                <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">{s.source || "manual"}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="surface-title text-lg font-semibold">{formatCurrency(s.price || 0, currencyCode, s.location)}</p>
              <p className="surface-copy text-sm">{s.unit || "per unit"}</p>
              <p className="surface-meta text-xs uppercase tracking-[0.2em]">{s.confidence || "unrated"} confidence</p>
              {onCreateMaterialInline ? (
                <AddToCatalogButton
                  supplier={s}
                  material={s.material}
                  onAdd={onCreateMaterialInline}
                  busy={materialBusy}
                />
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatUpdatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function MaterialRow({ m, currencyCode, baseLocation, onUpdateMaterial, canEdit, busy }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ averagePrice: "", lastMonthPrice: "", trend: "" });

  const openEdit = () => {
    setDraft({
      averagePrice: String(m.averagePrice ?? ""),
      lastMonthPrice: String(m.lastMonthPrice ?? ""),
      trend: m.trend || "Stable"
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    await onUpdateMaterial(m.id, {
      averagePrice: Number(draft.averagePrice) || 0,
      lastMonthPrice: Number(draft.lastMonthPrice) || 0,
      trend: draft.trend
    });
    setEditing(false);
  };

  const updatedLabel = formatUpdatedAt(m.updatedAt || m.createdAt);

  return (
    <div className="surface-card rounded-[20px] p-4">
      {editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="surface-title text-sm font-semibold">{m.name}</p>
              <p className="surface-copy text-xs">{m.unit}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="ghost-btn px-3 py-1.5 text-xs" onClick={cancelEdit}>Cancel</button>
              <button type="button" className="primary-btn px-3 py-1.5 text-xs" onClick={saveEdit} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="app-label block">
              <span>Current Price</span>
              <input
                className="app-input mt-1 w-full px-3 py-2 text-sm"
                type="number"
                min="0"
                step="0.01"
                value={draft.averagePrice}
                onChange={(e) => setDraft((d) => ({ ...d, averagePrice: e.target.value }))}
              />
            </label>
            <label className="app-label block">
              <span>Last Month Price</span>
              <input
                className="app-input mt-1 w-full px-3 py-2 text-sm"
                type="number"
                min="0"
                step="0.01"
                value={draft.lastMonthPrice}
                onChange={(e) => setDraft((d) => ({ ...d, lastMonthPrice: e.target.value }))}
              />
            </label>
            <label className="app-label block">
              <span>Trend</span>
              <select
                className="app-input mt-1 w-full px-3 py-2 text-sm"
                value={draft.trend}
                onChange={(e) => setDraft((d) => ({ ...d, trend: e.target.value }))}
              >
                <option value="Rising">Rising</option>
                <option value="Stable">Stable</option>
                <option value="Falling">Falling</option>
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="surface-title text-sm font-semibold">{m.name}</p>
              <span className={`h-2 w-2 shrink-0 rounded-full ${TREND_DOT[m.trend] || "bg-slate-400"}`} title={m.trend} />
              <span className="surface-meta text-[11px] uppercase tracking-[0.16em]">{m.trend}</span>
            </div>
            <p className="surface-copy mt-1 text-sm">{m.unit}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <p className="surface-meta text-xs uppercase tracking-[0.2em]">{(m.suppliers || []).length} suppliers</p>
              {updatedLabel ? (
                <p className="surface-meta text-xs">Updated {updatedLabel}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right">
              <p className="surface-title text-sm font-semibold">{formatCurrency(m.averagePrice || 0, currencyCode, baseLocation)}</p>
              <p className="surface-copy mt-1 text-xs">Last mo. {formatCurrency(m.lastMonthPrice || 0, currencyCode, baseLocation)}</p>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-300"
                onClick={openEdit}
                title="Edit price"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3" aria-hidden="true">
                  <path d="M11 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13H3v-2L11 2.5Z" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialCatalog({ materials, currencyCode, baseLocation, onUpdateMaterial, canEdit, busy }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? materials : materials.slice(0, 6);

  if (!materials.length) {
    return (
      <EmptyState
        title="Catalog is still empty"
        description="Add your first tracked material so pricing alerts and estimate recommendations stay grounded in your actual catalog."
      />
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((m) => (
        <MaterialRow
          key={m.id}
          m={m}
          currencyCode={currencyCode}
          baseLocation={baseLocation}
          onUpdateMaterial={onUpdateMaterial}
          canEdit={canEdit}
          busy={busy}
        />
      ))}
      {materials.length > 6 ? (
        <button
          type="button"
          className="ghost-btn w-full text-sm"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show less" : `Show all ${materials.length} materials`}
        </button>
      ) : null}
    </div>
  );
}

export function PricingPage({
  data,
  materialForm,
  setMaterialForm,
  onCreateMaterial,
  onUpdateMaterial,
  onCreateMaterialInline,
  materialBusy,
  researchForm,
  setResearchForm,
  pricingResult,
  onResearchPricing,
  onResearchPricingDirect,
  supplierForm,
  setSupplierForm,
  supplierResults,
  onFindSuppliers,
  onFindSuppliersDirect,
  pricingImportForm,
  setPricingImportForm,
  remoteImportForm,
  setRemoteImportForm,
  onImportPricing,
  onImportRemotePricing,
  importBusy,
  notice,
  error,
  currencyCode
}) {
  const materials = data.materials || [];
  const alerts = data.alerts || [];
  const canManageCatalog = ["Admin", "Estimator"].includes(data.user?.role);
  const isAdmin = data.user?.role === "Admin";

  const projectLocation = data.currentProject?.location || "";

  const CURRENCY_COUNTRY = { PHP: "Philippines", AED: "UAE", GBP: "United Kingdom", EUR: "Europe", USD: "United States" };
  const inferredCountry = CURRENCY_COUNTRY[data.user?.profileSettings?.currencyCode || currencyCode] || "Philippines";

  // Sync location/material between research and supplier forms when user edits one
  const setResearchField = (field, value) => {
    setResearchForm((c) => ({ ...c, [field]: value }));
    if (field === "location") setSupplierForm((c) => ({ ...c, location: value }));
    if (field === "material") setSupplierForm((c) => ({ ...c, material: value }));
  };

  const applyProjectLocation = () => {
    if (!projectLocation) return;
    setResearchForm((c) => ({ ...c, location: projectLocation }));
    setSupplierForm((c) => ({ ...c, location: projectLocation }));
  };

  const effectiveLocation = (loc) => loc.trim() || projectLocation || inferredCountry;

  const handleResearchSubmit = useCallback((e) => {
    e.preventDefault();
    const loc = effectiveLocation(researchForm.location);
    if (loc !== researchForm.location) setResearchForm((c) => ({ ...c, location: loc }));
    onResearchPricingDirect({ material: researchForm.material, location: loc });
  }, [researchForm, projectLocation, inferredCountry]);

  const handleSuppliersSubmit = useCallback((e) => {
    e.preventDefault();
    const loc = effectiveLocation(supplierForm.location);
    if (loc !== supplierForm.location) setSupplierForm((c) => ({ ...c, location: loc }));
    onFindSuppliersDirect({ material: supplierForm.material, location: loc });
  }, [supplierForm, projectLocation, inferredCountry]);

  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="Pricing Control Room"
        eyebrow="Pricing"
        actions={
          <ActionMenu
            items={[
              { label: "Open Estimates", to: "/estimates" },
              { label: "Projects", to: "/projects" }
            ]}
          />
        }
      >
        <PricingOverview data={data} pricingResult={pricingResult} supplierResults={supplierResults} currencyCode={currencyCode} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Research Market Rate" eyebrow="Market">
          <div className="space-y-6">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleResearchSubmit}>
              <Field
                label="Material"
                value={researchForm.material}
                placeholder="Portland Cement, 10mm Rebar, CHB 4 in"
                onChange={(e) => setResearchField("material", e.target.value)}
              />
              <div>
                <Field
                  label="Location (optional)"
                  value={researchForm.location}
                  placeholder="Leave blank to search all, or enter Quezon City..."
                  onChange={(e) => setResearchField("location", e.target.value)}
                />
                {projectLocation && researchForm.location !== projectLocation ? (
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-sky-400 underline-offset-2 hover:underline"
                    onClick={applyProjectLocation}
                  >
                    Use project location ({projectLocation})
                  </button>
                ) : null}
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button className="primary-btn" type="submit">Search Nearby</button>
                <p className="surface-copy text-sm">
                  {researchForm.location.trim()
                    ? `Searching in ${researchForm.location}`
                    : `Location not set — will use ${projectLocation || inferredCountry}`}
                </p>
              </div>
            </form>
            <ResearchSnapshot
              pricingResult={pricingResult}
              alerts={alerts}
              currencyCode={currencyCode}
              onCreateMaterialInline={canManageCatalog ? onCreateMaterialInline : null}
              materialBusy={materialBusy}
            />
          </div>
        </SectionCard>

        <SectionCard title="Supplier Comparison" eyebrow="Compare">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSuppliersSubmit}>
            <Field
              label="Material"
              value={supplierForm.material}
              placeholder="Portland Cement, Rebar, CHB..."
              onChange={(e) => setSupplierForm((c) => ({ ...c, material: e.target.value }))}
            />
            <div>
              <Field
                label="Location (optional)"
                value={supplierForm.location}
                placeholder="Leave blank or enter Quezon City..."
                onChange={(e) => setSupplierForm((c) => ({ ...c, location: e.target.value }))}
              />
              {projectLocation && supplierForm.location !== projectLocation ? (
                <button
                  type="button"
                  className="mt-1.5 text-xs text-sky-400 underline-offset-2 hover:underline"
                  onClick={applyProjectLocation}
                >
                  Use project location ({projectLocation})
                </button>
              ) : null}
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button className="ghost-btn" type="submit">Find Suppliers</button>
              <p className="surface-copy text-sm">Leave location blank to see all suppliers, or narrow by area.</p>
            </div>
          </form>
          <div className="mt-6">
            <SupplierComparison
            supplierResults={supplierResults}
            currencyCode={currencyCode}
            onCreateMaterialInline={canManageCatalog ? onCreateMaterialInline : null}
            materialBusy={materialBusy}
          />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard title="Material Catalog" eyebrow="Catalog">
          <div className="space-y-6">
            <MaterialCatalog
              materials={materials}
              currencyCode={currencyCode}
              baseLocation={data.currentProject?.location}
              onUpdateMaterial={onUpdateMaterial}
              canEdit={canManageCatalog}
              busy={materialBusy}
            />
            {canManageCatalog ? (
              <div className="surface-card rounded-[22px] p-5">
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Add Material</p>
                <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onCreateMaterial}>
                  <Field label="Name" value={materialForm.name} onChange={(e) => setMaterialForm((c) => ({ ...c, name: e.target.value }))} />
                  <Field label="Unit" value={materialForm.unit} onChange={(e) => setMaterialForm((c) => ({ ...c, unit: e.target.value }))} />
                  <Field label="Average Price" type="number" min="0" step="0.01" value={materialForm.averagePrice} onChange={(e) => setMaterialForm((c) => ({ ...c, averagePrice: e.target.value }))} />
                  <Field label="Last Month Price" type="number" min="0" step="0.01" value={materialForm.lastMonthPrice} onChange={(e) => setMaterialForm((c) => ({ ...c, lastMonthPrice: e.target.value }))} />
                  <label className="app-label block text-sm">
                    <span>Trend</span>
                    <select
                      className="app-input mt-1.5 w-full px-3 py-2"
                      value={materialForm.trend}
                      onChange={(e) => setMaterialForm((c) => ({ ...c, trend: e.target.value }))}
                    >
                      {["Rising", "Stable", "Falling"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <Field
                      label="Suppliers"
                      value={materialForm.suppliers}
                      placeholder="Wilcon Depot, CW Home Depot, Shopee"
                      onChange={(e) => setMaterialForm((c) => ({ ...c, suppliers: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                    <button className="primary-btn" type="submit" disabled={materialBusy}>
                      {materialBusy ? "Saving..." : "Add Material"}
                    </button>
                    <p className="surface-copy text-sm">New materials start contributing to pricing alerts and future estimate context.</p>
                  </div>
                </form>
              </div>
            ) : (
              <EmptyState
                title="Catalog editing is restricted"
                description="Viewers can research pricing and compare suppliers, but only admins and estimators can add new catalog materials."
              />
            )}
          </div>
        </SectionCard>

        {isAdmin ? (
          <SectionCard title="Feed Operations" eyebrow="Admin">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="surface-card rounded-[22px] p-5">
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">CSV Feed Import</p>
                <p className="surface-copy mt-2 text-sm leading-6">
                  Paste a normalized CSV feed to batch-refresh catalog pricing without editing each row manually.
                </p>
                <form className="mt-4 space-y-4" onSubmit={onImportPricing}>
                  <Field label="Source" value={pricingImportForm.source} onChange={(e) => setPricingImportForm((c) => ({ ...c, source: e.target.value }))} />
                  <Field label="CSV Feed" type="textarea" rows={9} value={pricingImportForm.csvText} onChange={(e) => setPricingImportForm((c) => ({ ...c, csvText: e.target.value }))} />
                  <button className="ghost-btn" type="submit" disabled={importBusy}>{importBusy ? "Importing..." : "Import CSV Feed"}</button>
                </form>
              </div>

              <div className="surface-card rounded-[22px] p-5">
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Remote Feed Import</p>
                <p className="surface-copy mt-2 text-sm leading-6">
                  Use a remote CSV or JSON feed when your supplier updates live pricing from a hosted source.
                </p>
                <form className="mt-4 space-y-4" onSubmit={onImportRemotePricing}>
                  <Field label="Source" value={remoteImportForm.source} onChange={(e) => setRemoteImportForm((c) => ({ ...c, source: e.target.value }))} />
                  <Field label="Remote Feed URL" type="url" value={remoteImportForm.url} onChange={(e) => setRemoteImportForm((c) => ({ ...c, url: e.target.value }))} />
                  <button className="ghost-btn" type="submit" disabled={importBusy}>{importBusy ? "Importing..." : "Import Remote Feed"}</button>
                </form>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
