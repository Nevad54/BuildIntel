import { formatCurrency, number } from "../lib/app.js";
import { ActionMenu, Banner, EmptyState, Field, MetricCard, QuickLink, SectionCard } from "../components/ui.jsx";

function formatRelative(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ProjectPulse({ currentProject, latestEstimate, currencyCode }) {
  if (!currentProject) {
    return (
      <EmptyState
        title="No active project context"
        description="Create a project from the intake panel to unlock document review, AI estimates, and pricing research."
        action={<QuickLink to="/projects" label="Open Projects" tone="primary" />}
      />
    );
  }

  return (
    <div className="surface-card grid gap-5 rounded-3xl p-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Current Project</p>
        <h3 className="surface-title mt-2 text-2xl font-semibold">{currentProject.name}</h3>
        <p className="surface-copy mt-2 text-sm">
          {[currentProject.location, currentProject.areaSqm ? `${number.format(currentProject.areaSqm)} sqm` : null, currentProject.status].filter(Boolean).join(" / ")}
        </p>
        <p className="surface-copy mt-4 text-sm leading-6">{currentProject.description}</p>
        <div className="mt-5">
          <ActionMenu
            items={[
              { label: "Review Documents", to: "/documents" },
              { label: "Open Estimate Workspace", to: "/estimates" }
            ]}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <MetricCard label="Blueprint Area" value={currentProject.areaSqm ? `${number.format(currentProject.areaSqm)} sqm` : "—"} />
        <MetricCard
          label="Latest Estimate"
          value={latestEstimate ? formatCurrency(latestEstimate.finalContractPrice || 0, currencyCode, latestEstimate.location || currentProject.location) : "No estimate"}
          note={latestEstimate ? "Ready for proposal export" : "Generate one from Estimates"}
        />
        <MetricCard label="Status" value={currentProject.status} />
      </div>
    </div>
  );
}

function RecentActivity({ projects, documents, estimates, currencyCode }) {
  const items = [
    ...projects.slice(0, 2).map((p) => ({
      id: `project-${p.id}`,
      title: p.name,
      meta: `${p.location} · ${p.status}`,
      detail: p.description,
      ts: p.createdAt,
      to: "/projects"
    })),
    ...documents.slice(0, 2).map((d) => ({
      id: `document-${d.id}`,
      title: d.filename,
      meta: d.reviewStatus,
      detail: d.extractionSummary,
      ts: d.createdAt,
      to: "/documents"
    })),
    ...estimates.slice(0, 2).map((e) => ({
      id: `estimate-${e.id}`,
      title: formatCurrency(e.finalContractPrice || 0, currencyCode, e.location),
      meta: "Estimate",
      detail: e.prompt,
      ts: e.createdAt,
      to: "/estimates"
    }))
  ]
    .sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0))
    .slice(0, 5);

  if (!items.length) {
    return (
      <EmptyState
        title="No recent activity yet"
        description="Once you create projects, upload documents, or save estimates, the latest workspace activity will show here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="surface-card rounded-2xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="surface-title text-sm font-semibold">{item.title}</p>
                <span className="surface-pill rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.18em]">{item.meta}</span>
                {item.ts ? <span className="surface-meta text-[11px]">{formatRelative(item.ts)}</span> : null}
              </div>
              <p className="surface-copy mt-2 line-clamp-2 text-sm leading-6">{item.detail}</p>
            </div>
            <QuickLink to={item.to} label="Open" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage({ data, projectForm, setProjectForm, onCreateProject, createBusy, notice, error, currencyCode }) {
  const latestEstimate = data.estimates[0];
  const currentProject = data.currentProject;
  const totalOpenAlerts = (data.alerts || []).length;
  const estimatingCount = data.projects.filter((p) => p.status === "Estimating").length;
  const canManageProjects = ["Admin", "Estimator"].includes(data.user?.role);

  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="BuildIntel Workspace"
        eyebrow="Overview"
        actions={
          <ActionMenu
            items={[
              { label: "Projects", to: "/projects" },
              { label: "Estimates", to: "/estimates" },
              { label: "Documents", to: "/documents" }
            ]}
          />
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Projects" value={number.format(data.stats.totalProjects || 0)} note={`${number.format(estimatingCount)} currently estimating`} />
          <MetricCard label="Documents" value={number.format(data.stats.totalDocuments || 0)} note="Review queue stays in sync" />
          <MetricCard label="Estimates" value={number.format(data.stats.totalEstimates || 0)} note="Drafts and exports in one place" />
          <MetricCard label="Avg. Value" value={formatCurrency(data.stats.averageProjectValue || 0, currencyCode, currentProject?.location)} note={`${number.format(totalOpenAlerts)} active alerts`} />
        </div>
      </SectionCard>

      {!data.projects.length || !data.currentProject?.location ? (
        <SectionCard title="Get Started" eyebrow="Welcome">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create a project",
                description: "Add a project with location and floor area. This anchors everything — documents, estimates, and pricing all attach to it.",
                to: "/projects",
                label: "Add Project",
                tone: "primary"
              },
              {
                step: "2",
                title: "Upload a document",
                description: "Attach a scope sheet, floor plan, or any text file. AI extracts dimensions and structural elements so you don't have to key them manually.",
                to: "/documents",
                label: "Upload Document",
                tone: "ghost"
              },
              {
                step: "3",
                title: "Generate an estimate",
                description: "Write a brief prompt or use your uploaded document. AI produces a full line-item BOQ with materials, labor, and equipment in seconds.",
                to: "/estimates",
                label: "Generate Estimate",
                tone: "ghost"
              }
            ].map((item) => (
              <div key={item.step} className="surface-card rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/10 text-xs font-bold text-sky-300">{item.step}</span>
                  <div>
                    <p className="surface-title text-sm font-semibold">{item.title}</p>
                    <p className="surface-copy mt-2 text-xs leading-5">{item.description}</p>
                    <div className="mt-4">
                      <QuickLink to={item.to} label={item.label} tone={item.tone} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Project Pulse" eyebrow="Focus">
          <ProjectPulse currentProject={currentProject} latestEstimate={latestEstimate} currencyCode={currencyCode} />
        </SectionCard>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Quick Project Intake" eyebrow="Start Here">
          {canManageProjects ? (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreateProject}>
              <Field
                label="Project Name"
                autoComplete="off"
                value={projectForm.name}
                onChange={(e) => setProjectForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="Two-storey residence, fit-out, warehouse shell…"
              />
              <Field
                label="Location"
                autoComplete="off"
                value={projectForm.location}
                onChange={(e) => setProjectForm((c) => ({ ...c, location: e.target.value }))}
                placeholder="Quezon City, Pasig, Makati…"
              />
              <Field
                label="Area (sqm)"
                type="number"
                min="1"
                autoComplete="off"
                value={projectForm.areaSqm}
                onChange={(e) => setProjectForm((c) => ({ ...c, areaSqm: e.target.value }))}
              />
              <div className="md:col-span-2">
                <Field
                  label="Description"
                  type="textarea"
                  rows={4}
                  autoComplete="off"
                  value={projectForm.description}
                  placeholder="Describe the scope, building type, and anything that will matter for estimating…"
                  onChange={(e) => setProjectForm((c) => ({ ...c, description: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button className="primary-btn" type="submit" disabled={createBusy}>
                  {createBusy ? "Adding…" : "Add Project"}
                </button>
                <p className="surface-copy text-sm">New projects become the current workspace context automatically.</p>
              </div>
            </form>
          ) : (
            <EmptyState
              title="Project intake is read only"
              description="Viewers can review workspace status here, but only admins and estimators can add new projects."
              action={<QuickLink to="/projects" label="Open Projects" />}
            />
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Active Alerts" eyebrow="Signals">
            <div className="space-y-3">
              {(data.alerts || []).length ? (
                data.alerts.map((alert) => (
                  <div key={alert.id} className="surface-card rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="surface-title text-sm font-semibold">{alert.title}</p>
                      <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">{alert.severity}</span>
                    </div>
                  </div>
                ))
              ) : (
                <Banner>No active alerts right now.</Banner>
              )}
            </div>
          </SectionCard>

          {latestEstimate ? (
            <div className="accent-card rounded-3xl p-5">
              <p className="accent-eyebrow text-xs uppercase tracking-[0.24em]">Latest Estimate</p>
              <p className="accent-value mt-3 text-2xl font-semibold">{formatCurrency(latestEstimate.finalContractPrice, currencyCode, latestEstimate.location || currentProject?.location)}</p>
              <p className="accent-copy mt-2 text-sm line-clamp-2">{latestEstimate.prompt}</p>
              <div className="mt-4">
                <QuickLink to="/estimates" label="Open Workspace" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <SectionCard title="Recent Activity" eyebrow="Momentum">
        <RecentActivity
          projects={data.projects}
          documents={data.documents}
          estimates={data.estimates}
          currencyCode={currencyCode}
        />
      </SectionCard>
    </div>
  );
}
