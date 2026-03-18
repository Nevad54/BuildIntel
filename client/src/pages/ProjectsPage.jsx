import { Link } from "react-router-dom";
import { number } from "../lib/app.js";
import { Banner, EmptyState, Field, MetricCard, SectionCard } from "../components/ui.jsx";

function statusTone(status) {
  if (status === "Won") {
    return "Done";
  }

  if (status === "Lost") {
    return "Closed";
  }

  if (status === "Submitted") {
    return "Submitted";
  }

  return "Active";
}

function QuickLink({ to, label, tone = "ghost" }) {
  return <Link className={tone === "primary" ? "primary-btn inline-flex items-center" : "ghost-btn inline-flex items-center"} to={to}>{label}</Link>;
}

function ProjectSummary({ projects }) {
  const counts = {
    total: projects.length,
    estimating: projects.filter((project) => project.status === "Estimating").length,
    submitted: projects.filter((project) => project.status === "Submitted").length,
    won: projects.filter((project) => project.status === "Won").length
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total Projects" value={number.format(counts.total)} />
      <MetricCard label="Estimating" value={number.format(counts.estimating)} />
      <MetricCard label="Submitted" value={number.format(counts.submitted)} />
      <MetricCard label="Won" value={number.format(counts.won)} />
    </div>
  );
}

function CurrentProjectSpotlight({ project, onUpdateProject, updateBusy, canManageProjects }) {
  if (!project) {
    return (
      <EmptyState
        title="No current project selected"
        description="Create a project or pick one from the sidebar to see its status and next actions here."
        action={<QuickLink to="/dashboard" label="Back to Dashboard" />}
      />
    );
  }

  return (
    <div className="surface-card grid gap-5 rounded-[24px] p-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Selected Project</p>
        <h3 className="surface-title mt-2 text-2xl font-semibold">{project.name}</h3>
        <p className="surface-copy mt-2 text-sm">
          {project.location} / {number.format(project.areaSqm)} sqm
        </p>
        <p className="surface-copy mt-4 text-sm leading-6">{project.description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <QuickLink to="/documents" label="Open Documents" tone="primary" />
          <QuickLink to="/estimates" label="Open Estimates" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <MetricCard label="Status" value={project.status} note={`${statusTone(project.status)} in pipeline`} />
        <div className="surface-card rounded-[20px] p-5">
          {canManageProjects ? (
            <>
              <label className="app-label block text-sm">
                <span>Status</span>
                <select
                  className="app-input mt-2 w-full rounded-full px-4 py-2 text-sm"
                  value={project.status}
                  onChange={(event) => onUpdateProject(project.id, { status: event.target.value })}
                  disabled={updateBusy}
                >
                  {["Estimating", "Submitted", "Won", "Lost"].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <p className="surface-copy mt-3 text-sm">Status changes update the pipeline and the dashboard summary immediately.</p>
            </>
          ) : (
            <p className="surface-copy text-sm">Viewers can monitor project status here, but only admins and estimators can move pipeline stages.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineBoard({ projects, onUpdateProject, updateBusy, canManageProjects }) {
  const groups = [
    { status: "Estimating", title: "Estimating" },
    { status: "Submitted", title: "Submitted" },
    { status: "Won", title: "Won" },
    { status: "Lost", title: "Lost" }
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {groups.map((group) => {
        const items = projects.filter((project) => project.status === group.status);
        return (
          <div key={group.status} className="surface-card rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="surface-title text-base font-semibold">{group.title}</h3>
              <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                {number.format(items.length)}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {items.length ? (
                items.map((project) => (
                  <div key={project.id} className="rounded-[18px] border border-black/5 bg-white/20 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                    <p className="surface-title text-sm font-semibold">{project.name}</p>
                    <p className="surface-copy mt-1 text-sm">
                      {project.location} / {number.format(project.areaSqm)} sqm
                    </p>
                    <p className="surface-copy mt-3 text-sm leading-6">{project.description}</p>
                    {canManageProjects ? (
                      <label className="app-label mt-4 block text-sm">
                        <span>Move To</span>
                        <select
                          className="app-input mt-2 w-full rounded-full px-4 py-2 text-sm"
                          value={project.status}
                          onChange={(event) => onUpdateProject(project.id, { status: event.target.value })}
                          disabled={updateBusy}
                        >
                          {["Estimating", "Submitted", "Won", "Lost"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="surface-meta mt-4 text-xs uppercase tracking-[0.2em]">Read only</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="surface-copy text-sm">No projects in this stage.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProjectsPage({
  data,
  projectForm,
  setProjectForm,
  onCreateProject,
  createBusy,
  onUpdateProject,
  updateBusy,
  notice,
  error
}) {
  const canManageProjects = ["Admin", "Estimator"].includes(data.user?.role);
  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="Projects Pipeline"
        eyebrow="Projects"
        actions={
          <div className="flex flex-wrap gap-2">
            <QuickLink to="/documents" label="Documents" />
            <QuickLink to="/estimates" label="Estimates" />
          </div>
        }
      >
        <ProjectSummary projects={data.projects} />
      </SectionCard>

      <SectionCard title="Current Project Focus" eyebrow="Selected">
        <CurrentProjectSpotlight project={data.currentProject} onUpdateProject={onUpdateProject} updateBusy={updateBusy} canManageProjects={canManageProjects} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="Project Intake" eyebrow="Create New">
          {canManageProjects ? (
            <form className="space-y-4" onSubmit={onCreateProject}>
              <Field
                label="Project Name"
                value={projectForm.name}
                placeholder="Retail fit-out, house shell, office renovation"
                onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))}
              />
              <Field
                label="Location"
                value={projectForm.location}
                placeholder="Makati, Taguig, Quezon City"
                onChange={(event) => setProjectForm((current) => ({ ...current, location: event.target.value }))}
              />
              <Field
                label="Area (sqm)"
                type="number"
                min="1"
                value={projectForm.areaSqm}
                onChange={(event) => setProjectForm((current) => ({ ...current, areaSqm: event.target.value }))}
              />
              <Field
                label="Description"
                type="textarea"
                rows={5}
                placeholder="Describe the build type, scope, and pricing context you want the team to remember."
                value={projectForm.description}
                onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button className="primary-btn" type="submit" disabled={createBusy}>
                  {createBusy ? "Adding..." : "Add Project"}
                </button>
                <p className="surface-copy text-sm">New projects are added to the pipeline and become the active workspace context.</p>
              </div>
            </form>
          ) : (
            <EmptyState
              title="Project creation is limited"
              description="Viewers can review the project pipeline, but only admins and estimators can add or move projects."
            />
          )}
        </SectionCard>

        <SectionCard title="Pipeline Board" eyebrow="Manage">
          {data.projects.length ? (
            <PipelineBoard projects={data.projects} onUpdateProject={onUpdateProject} updateBusy={updateBusy} canManageProjects={canManageProjects} />
          ) : (
            <EmptyState
              title="No projects in the pipeline"
              description="Create the first project to unlock document uploads, estimate generation, and proposal export."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
