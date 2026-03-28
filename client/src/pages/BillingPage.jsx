import { formatCurrency, number } from "../lib/app.js";
import { Banner, EmptyState, Field, MetricCard, SectionCard, cls } from "../components/ui.jsx";

function planFeatureState(data) {
  return [
    {
      label: "AI Estimates",
      value: data.planUsage?.features?.aiEstimates ? "Enabled" : "Locked",
      note: data.planUsage?.features?.aiEstimates ? "Draft generation is available" : "Requires a higher plan"
    },
    {
      label: "Supplier Comparison",
      value: data.planUsage?.features?.supplierComparison ? "Enabled" : "Locked",
      note: data.planUsage?.features?.supplierComparison ? "Pricing comparison is available" : "Requires a higher plan"
    },
    {
      label: "Project Capacity",
      value:
        data.planUsage?.limits?.maxProjects === null
          ? "Unlimited"
          : `${number.format(data.planUsage?.usage?.projects || 0)} / ${number.format(data.planUsage?.limits?.maxProjects || 0)}`,
      note: data.planUsage?.limits?.maxProjects === null ? "No project cap on this plan" : "Tracked against your workspace cap"
    }
  ];
}

function PlanOverview({ data, currencyCode }) {
  const currentPlan = data.planUsage?.plan || data.company?.plan || "-";
  const usage = data.planUsage?.usage?.projects || 0;
  const limit = data.planUsage?.limits?.maxProjects;
  const templates = data.templates || [];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Current Plan" value={currentPlan} note={`${number.format(data.projects?.length || 0)} active projects in workspace`} />
      <MetricCard
        label="Projects Used"
        value={number.format(usage)}
        note={limit === null ? "Unlimited capacity" : `${number.format(limit || 0)} allowed on this plan`}
      />
      <MetricCard label="Templates" value={number.format(templates.length)} note="Saved estimate starting points" />
      <MetricCard
        label="Plan Value"
        value={formatCurrency((data.subscriptions || []).find((plan) => plan.name === currentPlan)?.priceMonthly || 0, currencyCode)}
        note="Monthly subscription"
      />
    </div>
  );
}

function PlanSwitcher({ data, onChangePlan, planBusy, currencyCode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(data.subscriptions || []).map((plan) => {
        const active = plan.name === data.company?.plan;
        return (
          <div key={plan.id} className={cls("rounded-[22px] p-5", active ? "accent-card border" : "surface-card")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Plan</p>
                <h3 className="surface-title mt-2 text-xl font-semibold">{plan.name}</h3>
                <p className="surface-copy mt-1 text-sm">{formatCurrency(plan.priceMonthly, currencyCode)}/month</p>
              </div>
              {active ? (
                <span className="rounded-full bg-sky-400 px-3 py-1 text-xs font-semibold text-slate-950">Active</span>
              ) : null}
            </div>
            <div className="surface-copy mt-4 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <p key={feature}>{feature}</p>
              ))}
            </div>
            <button className="primary-btn mt-5" type="button" onClick={() => onChangePlan(plan.name)} disabled={planBusy || active}>
              {active ? "Current Plan" : "Switch Plan"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function GovernanceSummary({ data }) {
  const items = planFeatureState(data);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="surface-card rounded-[20px] p-5">
          <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">{item.label}</p>
          <p className="surface-title mt-3 text-xl font-semibold">{item.value}</p>
          <p className="surface-copy mt-2 text-sm leading-6">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

function TemplateSummary({ templates = [] }) {
  if (!templates.length) {
    return (
      <EmptyState
        title="No estimate templates yet"
        description="Create a reusable estimate template here so estimators can start with your standard overhead, profit, and contingency mix."
      />
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <div key={template.id} className="surface-card rounded-[20px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="surface-title text-sm font-semibold">{template.name}</p>
              <p className="surface-copy mt-1 text-sm">Reusable estimate defaults</p>
            </div>
            <div className="text-right text-sm">
              <p className="surface-copy">Overhead {template.overheadPercent}%</p>
              <p className="surface-copy">Profit {template.profitPercent}%</p>
              <p className="surface-copy">Contingency {template.contingencyPercent}%</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditFeed({ auditLogs }) {
  if (!(auditLogs || []).length) {
    return (
      <EmptyState
        title="No audit entries yet"
        description="Audit events appear here as admins create projects, update plans, or import pricing and documents."
      />
    );
  }

  return (
    <div className="space-y-3">
      {auditLogs.map((log) => (
        <div key={log.id} className="surface-card rounded-[20px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="surface-title text-sm font-semibold">{log.action}</p>
              <p className="surface-copy mt-1 text-sm">
                {log.entityType} / {log.entityId || "workspace"}
              </p>
            </div>
            <p className="surface-meta text-xs uppercase tracking-[0.2em]">{new Date(log.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BillingPage({
  data,
  templateForm,
  setTemplateForm,
  onCreateTemplate,
  templateBusy,
  onChangePlan,
  planBusy,
  auditLogs,
  notice,
  error,
  currencyCode
}) {
  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard title="Billing and Governance" eyebrow="Billing">
        <PlanOverview data={data} currencyCode={currencyCode} />
      </SectionCard>

      <SectionCard title="Plan Control" eyebrow="Subscription">
        <PlanSwitcher data={data} onChangePlan={onChangePlan} planBusy={planBusy} currencyCode={currencyCode} />
      </SectionCard>

      <SectionCard title="Workspace Governance" eyebrow="Access">
        <GovernanceSummary data={data} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Template Studio" eyebrow="Admin">
          <div className="space-y-6">
            <TemplateSummary templates={data.templates} />
            <div className="surface-card rounded-[22px] p-5">
              <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Create Template</p>
              <form className="mt-4 space-y-4" onSubmit={onCreateTemplate}>
                <Field
                  label="Template Name"
                  value={templateForm.name}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                />
                <Field
                  label="Overhead %"
                  type="number"
                  min="0"
                  step="0.01"
                  value={templateForm.overheadPercent}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, overheadPercent: event.target.value }))}
                />
                <Field
                  label="Profit %"
                  type="number"
                  min="0"
                  step="0.01"
                  value={templateForm.profitPercent}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, profitPercent: event.target.value }))}
                />
                <Field
                  label="Contingency %"
                  type="number"
                  min="0"
                  step="0.01"
                  value={templateForm.contingencyPercent}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, contingencyPercent: event.target.value }))}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button className="ghost-btn" type="submit" disabled={templateBusy}>
                    {templateBusy ? "Saving…" : "Create Template"}
                  </button>
                  <p className="surface-copy text-sm">Templates become available immediately in the estimate generator.</p>
                </div>
              </form>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Audit Activity" eyebrow="Admin">
          <AuditFeed auditLogs={auditLogs} />
        </SectionCard>
      </div>
    </div>
  );
}
