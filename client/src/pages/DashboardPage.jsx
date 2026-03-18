import { Link } from "react-router-dom";
import { formatCurrency, number } from "../lib/app.js";
import { Banner, EmptyState, Field, MetricCard, SectionCard } from "../components/ui.jsx";

function QuickLink({ to, label, note, tone = "ghost" }) {
  const className = tone === "primary" ? "primary-btn inline-flex items-center justify-center" : "ghost-btn inline-flex items-center justify-center";
  return (
    <Link className={className} to={to}>
      <span>{label}</span>
      {note ? <span className="ml-2 text-xs opacity-80">{note}</span> : null}
    </Link>
  );
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
    <div className="surface-card grid gap-5 rounded-[24px] p-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Current Project</p>
        <h3 className="surface-title mt-2 text-2xl font-semibold">{currentProject.name}</h3>
        <p className="surface-copy mt-2 text-sm">
          {currentProject.location} / {number.format(currentProject.areaSqm)} sqm / {currentProject.status}
        </p>
        <p className="surface-copy mt-4 text-sm leading-6">{currentProject.description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <QuickLink to="/documents" label="Review Documents" tone="primary" />
          <QuickLink to="/estimates" label="Open Estimate Workspace" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <MetricCard label="Blueprint Area" value={`${number.format(currentProject.areaSqm)} sqm`} />
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

function ActionChecklist({ hasProject, hasDocument, hasEstimate }) {
  const steps = [
    {
      title: "Project intake",
      done: hasProject,
      to: "/projects",
      action: hasProject ? "Review projects" : "Create first project",
      description: "Capture location, scope, and area so the rest of the workflow has context."
    },
    {
      title: "Document review",
      done: hasDocument,
      to: "/documents",
      action: hasDocument ? "Open review queue" : "Upload first document",
      description: "Attach plans or scope sheets and confirm the extracted dimensions."
    },
    {
      title: "Estimate draft",
      done: hasEstimate,
      to: "/estimates",
      action: hasEstimate ? "Open saved estimate" : "Generate estimate",
      description: "Turn the project context into a priced estimate you can edit and export."
    }
  ];

  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.title} className="surface-card flex flex-wrap items-start justify-between gap-4 rounded-[20px] p-4">
          <div className="max-w-xl">
            <p className="surface-title text-sm font-semibold">{step.title}</p>
            <p className="surface-copy mt-1 text-sm leading-6">{step.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
              {step.done ? "Done" : "Next"}
            </span>
            <QuickLink to={step.to} label={step.action} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentActivity({ projects, documents, estimates, currencyCode }) {
  const items = [
    ...projects.slice(0, 2).map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      meta: `${project.location} / ${project.status}`,
      detail: "Project updated in the pipeline",
      to: "/projects"
    })),
    ...documents.slice(0, 2).map((document) => ({
      id: `document-${document.id}`,
      title: document.filename,
      meta: document.reviewStatus,
      detail: document.extractionSummary,
      to: "/documents"
    })),
    ...estimates.slice(0, 2).map((estimate) => ({
      id: `estimate-${estimate.id}`,
      title: formatCurrency(estimate.finalContractPrice || 0, currencyCode, estimate.location),
      meta: "Estimate saved",
      detail: estimate.prompt,
      to: "/estimates"
    }))
  ].slice(0, 5);

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
        <div key={item.id} className="surface-card rounded-[18px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="surface-title text-sm font-semibold">{item.title}</p>
              <p className="surface-meta mt-1 text-xs uppercase tracking-[0.2em]">{item.meta}</p>
              <p className="surface-copy mt-3 text-sm leading-6">{item.detail}</p>
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
  const estimatingCount = data.projects.filter((project) => project.status === "Estimating").length;
  const canManageProjects = ["Admin", "Estimator"].includes(data.user?.role);

  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="BuildIntel Workspace"
        eyebrow="Overview"
        actions={
          <div className="flex flex-wrap gap-2">
            <QuickLink to="/projects" label="Projects" />
            <QuickLink to="/estimates" label="Estimates" />
            <QuickLink to="/documents" label="Documents" />
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Projects" value={number.format(data.stats.totalProjects || 0)} note={`${number.format(estimatingCount)} currently estimating`} />
          <MetricCard label="Documents" value={number.format(data.stats.totalDocuments || 0)} note="Review queue stays in sync" />
          <MetricCard label="Estimates" value={number.format(data.stats.totalEstimates || 0)} note="Drafts and exports in one place" />
          <MetricCard label="Avg. Value" value={formatCurrency(data.stats.averageProjectValue || 0, currencyCode, currentProject?.location)} note={`${number.format(totalOpenAlerts)} active alerts`} />
        </div>
      </SectionCard>

      <SectionCard title="Project Pulse" eyebrow="Focus">
        <ProjectPulse currentProject={currentProject} latestEstimate={latestEstimate} currencyCode={currencyCode} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Quick Project Intake" eyebrow="Start Here">
          {canManageProjects ? (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreateProject}>
              <Field
                label="Project Name"
                value={projectForm.name}
                onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Two-storey residence, fit-out, warehouse shell"
              />
              <Field
                label="Location"
                value={projectForm.location}
                onChange={(event) => setProjectForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Quezon City, Pasig, Makati"
              />
              <Field
                label="Area (sqm)"
                type="number"
                min="1"
                value={projectForm.areaSqm}
                onChange={(event) => setProjectForm((current) => ({ ...current, areaSqm: event.target.value }))}
              />
              <div className="md:col-span-2">
                <Field
                  label="Description"
                  type="textarea"
                  rows={4}
                  value={projectForm.description}
                  placeholder="Describe the scope, building type, and anything that will matter for estimating."
                  onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button className="primary-btn" type="submit" disabled={createBusy}>
                  {createBusy ? "Adding..." : "Add Project"}
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

        <SectionCard title="What Needs Attention" eyebrow="Signals">
          <div className="space-y-3">
            {(data.alerts || []).length ? (
              data.alerts.map((alert) => (
                <div key={alert.id} className="surface-card rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-xl">
                      <p className="surface-title text-sm font-semibold">{alert.title}</p>
                    </div>
                    <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <Banner>No active alerts right now.</Banner>
            )}
          </div>
          {latestEstimate ? (
            <div className="accent-card mt-6 rounded-[24px] p-5">
              <p className="accent-eyebrow text-xs uppercase tracking-[0.24em]">Latest Estimate</p>
              <p className="accent-value mt-3 text-2xl font-semibold">{formatCurrency(latestEstimate.finalContractPrice, currencyCode, latestEstimate.location || currentProject?.location)}</p>
              <p className="accent-copy mt-2 text-sm">{latestEstimate.prompt}</p>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Next Best Actions" eyebrow="Checklist">
          <ActionChecklist
            hasProject={Boolean(data.projects.length)}
            hasDocument={Boolean(data.documents.length)}
            hasEstimate={Boolean(data.estimates.length)}
          />
        </SectionCard>

        <SectionCard title="Recent Activity" eyebrow="Momentum">
          <RecentActivity
            projects={data.projects}
            documents={data.documents}
            estimates={data.estimates}
            currencyCode={currencyCode}
          />
        </SectionCard>
      </div>
    </div>
  );
}
