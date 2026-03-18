import { Link } from "react-router-dom";
import { formatCurrency, number } from "../lib/app.js";
import { Banner, EmptyState, Field, MetricCard, SectionCard } from "../components/ui.jsx";

function QuickLink({ to, label, tone = "ghost" }) {
  return (
    <Link className={tone === "primary" ? "primary-btn inline-flex items-center justify-center" : "ghost-btn inline-flex items-center justify-center"} to={to}>
      {label}
    </Link>
  );
}

function PricingOverview({ data, pricingResult, supplierResults, currencyCode }) {
  const materials = data.materials || [];
  const alerts = data.alerts || [];
  const uniqueSuppliers = new Set(materials.flatMap((material) => material.suppliers || [])).size;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Catalog Materials" value={number.format(materials.length)} note={`${number.format(uniqueSuppliers)} known supplier partners`} />
      <MetricCard label="Open Alerts" value={number.format(alerts.length)} note="Trend signals and pricing movement" />
      <MetricCard
        label="Supplier Matches"
        value={number.format(supplierResults.length)}
        note={supplierResults.length ? "Comparison list ready" : "Run supplier finder"}
      />
      <MetricCard
        label="Recommended Rate"
        value={pricingResult ? formatCurrency(pricingResult.recommendedEstimatePrice || 0, currencyCode, pricingResult.location) : "No research yet"}
        note={pricingResult ? `${number.format(pricingResult.suppliers?.length || 0)} price points used` : "Start with a material search"}
      />
    </div>
  );
}

function ResearchSnapshot({ pricingResult, alerts, currencyCode }) {
  if (!pricingResult) {
    return (
      <EmptyState
        title="No market snapshot yet"
        description="Research a material and location to surface a recommended rate, supplier spread, and recent price signals."
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
          <p className="accent-eyebrow text-xs uppercase tracking-[0.24em]">Best Supplier</p>
          <p className="accent-value mt-3 text-2xl font-semibold">{pricingResult.bestSupplier.supplier}</p>
          <p className="accent-copy mt-2 text-sm">
            {formatCurrency(pricingResult.bestSupplier.price || 0, currencyCode, pricingResult.bestSupplier.location || pricingResult.location)} / {pricingResult.bestSupplier.unit || "unit"} / {pricingResult.bestSupplier.location}
          </p>
          <p className="accent-copy mt-2 text-sm">
            Delivery: {pricingResult.bestSupplier.delivery || "Unknown"} / Confidence: {pricingResult.bestSupplier.confidence || "unrated"}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card rounded-[22px] p-5">
          <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Top Price Points</p>
          <div className="mt-4 space-y-3">
            {topSuppliers.length ? (
              topSuppliers.map((supplier) => (
                <div key={`${supplier.supplier}-${supplier.location}-${supplier.material}`} className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <div>
                    <p className="surface-title text-sm font-semibold">{supplier.supplier}</p>
                    <p className="surface-copy mt-1 text-sm">
                      {supplier.material} / {supplier.location}
                    </p>
                    <p className="surface-meta mt-2 text-xs uppercase tracking-[0.2em]">
                      {supplier.source || "manual"} / {supplier.confidence || "unrated"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="surface-title text-sm font-semibold">{formatCurrency(supplier.price || 0, currencyCode, supplier.location || pricingResult.location)}</p>
                    <p className="surface-copy mt-1 text-sm">{supplier.delivery || "Delivery unknown"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="surface-copy text-sm">No supplier rows are available for this search yet.</p>
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
                    <span key={source} className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                      {source}
                    </span>
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

function SupplierComparison({ supplierResults, currencyCode }) {
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
      {supplierResults.map((supplier) => (
        <div key={`${supplier.supplier}-${supplier.location}-${supplier.material}`} className="surface-card rounded-[20px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="surface-title text-sm font-semibold">{supplier.supplier}</p>
              <p className="surface-copy mt-1 text-sm">
                {supplier.material} / {supplier.location}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  {supplier.delivery || "Delivery unknown"}
                </span>
                <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  {supplier.distanceKm ? `${number.format(supplier.distanceKm)} km away` : "Distance unknown"}
                </span>
                <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  {supplier.source || "manual"}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="surface-title text-lg font-semibold">{formatCurrency(supplier.price || 0, currencyCode, supplier.location)}</p>
              <p className="surface-copy mt-1 text-sm">{supplier.unit || "per unit"}</p>
              <p className="surface-meta mt-2 text-xs uppercase tracking-[0.2em]">{supplier.confidence || "unrated"} confidence</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MaterialCatalogPreview({ materials, currencyCode, baseLocation }) {
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
      {materials.slice(0, 5).map((material) => (
        <div key={material.id} className="surface-card rounded-[20px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="surface-title text-sm font-semibold">{material.name}</p>
              <p className="surface-copy mt-1 text-sm">
                {material.unit} / {material.trend} trend
              </p>
              <p className="surface-meta mt-2 text-xs uppercase tracking-[0.2em]">
                {(material.suppliers || []).length} suppliers attached
              </p>
            </div>
            <div className="text-right">
              <p className="surface-title text-sm font-semibold">{formatCurrency(material.averagePrice || 0, currencyCode, baseLocation)}</p>
              <p className="surface-copy mt-1 text-sm">Last month {formatCurrency(material.lastMonthPrice || 0, currencyCode, baseLocation)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PricingPage({
  data,
  materialForm,
  setMaterialForm,
  onCreateMaterial,
  materialBusy,
  researchForm,
  setResearchForm,
  pricingResult,
  onResearchPricing,
  supplierForm,
  setSupplierForm,
  supplierResults,
  onFindSuppliers,
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

  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="Pricing Control Room"
        eyebrow="Pricing"
        actions={
          <div className="flex flex-wrap gap-2">
            <QuickLink to="/estimates" label="Open Estimates" />
            <QuickLink to="/projects" label="Projects" />
          </div>
        }
      >
        <PricingOverview
          data={data}
          pricingResult={pricingResult}
          supplierResults={supplierResults}
          currencyCode={currencyCode}
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Research Market Rate" eyebrow="Market">
          <div className="space-y-6">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onResearchPricing}>
              <Field
                label="Material"
                value={researchForm.material}
                placeholder="Portland Cement, 10mm Rebar, CHB 4 in"
                onChange={(event) => setResearchForm((current) => ({ ...current, material: event.target.value }))}
              />
              <Field
                label="Location"
                value={researchForm.location}
                placeholder="Quezon City, Metro Manila, Cebu"
                onChange={(event) => setResearchForm((current) => ({ ...current, location: event.target.value }))}
              />
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button className="primary-btn" type="submit">
                  Research Price
                </button>
                <p className="surface-copy text-sm">This builds the recommended estimate rate and highlights the strongest supplier match.</p>
              </div>
            </form>
            <ResearchSnapshot pricingResult={pricingResult} alerts={alerts} currencyCode={currencyCode} />
          </div>
        </SectionCard>

        <SectionCard title="Supplier Comparison" eyebrow="Compare">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onFindSuppliers}>
            <Field
              label="Location"
              value={supplierForm.location}
              placeholder="Quezon City, Pasig, Makati"
              onChange={(event) => setSupplierForm((current) => ({ ...current, location: event.target.value }))}
            />
            <Field
              label="Material"
              value={supplierForm.material}
              placeholder="Material to compare"
              onChange={(event) => setSupplierForm((current) => ({ ...current, material: event.target.value }))}
            />
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button className="ghost-btn" type="submit">
                Find Suppliers
              </button>
              <p className="surface-copy text-sm">Use this when you need nearby alternatives before committing a rate.</p>
            </div>
          </form>
          <div className="mt-6">
            <SupplierComparison supplierResults={supplierResults} currencyCode={currencyCode} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard title="Material Catalog" eyebrow="Catalog">
          <div className="space-y-6">
            <MaterialCatalogPreview materials={materials} currencyCode={currencyCode} baseLocation={data.currentProject?.location} />
            {canManageCatalog ? (
              <div className="surface-card rounded-[22px] p-5">
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Add Material</p>
                <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onCreateMaterial}>
                  <Field
                    label="Name"
                    value={materialForm.name}
                    onChange={(event) => setMaterialForm((current) => ({ ...current, name: event.target.value }))}
                  />
                  <Field
                    label="Unit"
                    value={materialForm.unit}
                    onChange={(event) => setMaterialForm((current) => ({ ...current, unit: event.target.value }))}
                  />
                  <Field
                    label="Average Price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={materialForm.averagePrice}
                    onChange={(event) => setMaterialForm((current) => ({ ...current, averagePrice: event.target.value }))}
                  />
                  <Field
                    label="Last Month Price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={materialForm.lastMonthPrice}
                    onChange={(event) => setMaterialForm((current) => ({ ...current, lastMonthPrice: event.target.value }))}
                  />
                  <label className="app-label block text-sm">
                    <span>Trend</span>
                    <select
                      className="app-input mt-2 w-full rounded-2xl px-4 py-3"
                      value={materialForm.trend}
                      onChange={(event) => setMaterialForm((current) => ({ ...current, trend: event.target.value }))}
                    >
                      {["Rising", "Stable", "Falling"].map((trend) => (
                        <option key={trend} value={trend}>
                          {trend}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <Field
                      label="Suppliers"
                      value={materialForm.suppliers}
                      placeholder="Wilcon Depot, CW Home Depot, Shopee"
                      onChange={(event) => setMaterialForm((current) => ({ ...current, suppliers: event.target.value }))}
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
                  Paste a normalized CSV feed when you want to batch-refresh catalog pricing without editing each row manually.
                </p>
                <form className="mt-4 space-y-4" onSubmit={onImportPricing}>
                  <Field
                    label="Source"
                    value={pricingImportForm.source}
                    onChange={(event) => setPricingImportForm((current) => ({ ...current, source: event.target.value }))}
                  />
                  <Field
                    label="CSV Feed"
                    type="textarea"
                    rows={9}
                    value={pricingImportForm.csvText}
                    onChange={(event) => setPricingImportForm((current) => ({ ...current, csvText: event.target.value }))}
                  />
                  <button className="ghost-btn" type="submit" disabled={importBusy}>
                    {importBusy ? "Importing..." : "Import CSV Feed"}
                  </button>
                </form>
              </div>

              <div className="surface-card rounded-[22px] p-5">
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Remote Feed Import</p>
                <p className="surface-copy mt-2 text-sm leading-6">
                  Use a remote CSV or JSON feed when your supplier updates live pricing from a hosted source.
                </p>
                <form className="mt-4 space-y-4" onSubmit={onImportRemotePricing}>
                  <Field
                    label="Source"
                    value={remoteImportForm.source}
                    onChange={(event) => setRemoteImportForm((current) => ({ ...current, source: event.target.value }))}
                  />
                  <Field
                    label="Remote Feed URL"
                    type="url"
                    value={remoteImportForm.url}
                    onChange={(event) => setRemoteImportForm((current) => ({ ...current, url: event.target.value }))}
                  />
                  <button className="ghost-btn" type="submit" disabled={importBusy}>
                    {importBusy ? "Importing..." : "Import Remote Feed"}
                  </button>
                </form>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
