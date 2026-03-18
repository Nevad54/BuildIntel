import { useState } from "react";
import { NavLink } from "react-router-dom";
import { getNavItemsForRole, number } from "../lib/app.js";
import { cls } from "./ui.jsx";

function SidebarLink({ to, label, description, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cls(
          "sidebar-link block rounded-[20px] border px-4 py-3 transition",
          isActive ? "sidebar-link-active" : "sidebar-link-idle sidebar-link-hover"
        )
      }
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="sidebar-copy mt-1 text-xs">{description}</p>
    </NavLink>
  );
}

function ProjectContextCard({ projects, currentProject, currentProjectId, setCurrentProjectId, compact = false }) {
  if (!projects.length) {
    return (
      <div className={cls("sidebar-panel rounded-[24px] border", compact ? "p-4" : "p-5")}>
        <p className="sidebar-eyebrow text-xs uppercase tracking-[0.24em]">Current project</p>
        <p className="sidebar-copy mt-3 text-sm">No project selected yet.</p>
      </div>
    );
  }

  return (
    <div className={cls("sidebar-panel rounded-[24px] border", compact ? "p-4" : "p-5")}>
      <p className="sidebar-eyebrow text-xs uppercase tracking-[0.24em]">Current project</p>
      <label className="app-label mt-3 block text-sm">
        <span className="sr-only">Current project</span>
        <select
          className="app-input w-full rounded-2xl px-4 py-3 text-sm"
          value={currentProjectId || currentProject?.id || ""}
          onChange={(event) => setCurrentProjectId(event.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      {currentProject ? (
        <div className="sidebar-copy mt-4 space-y-1 text-sm">
          <p>{currentProject.location}</p>
          <p>{number.format(currentProject.areaSqm)} sqm</p>
          <p className="sidebar-status uppercase tracking-[0.16em]">{currentProject.status}</p>
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceShell({
  user,
  company,
  onLogout,
  children,
  projects = [],
  currentProject = null,
  currentProjectId = "",
  setCurrentProjectId
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const visibleNavItems = getNavItemsForRole(user?.role);

  return (
    <div className="workspace-root min-h-screen overflow-x-hidden">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="workspace-divider hidden w-[308px] shrink-0 border-r px-5 py-6 lg:block">
          <div className="sticky top-0 space-y-6">
            <div className="sidebar-panel rounded-[28px] border p-5">
              <p className="sidebar-eyebrow text-xs uppercase tracking-[0.24em]">BuildIntel</p>
              <h1 className="sidebar-title mt-3 text-2xl font-semibold">{company?.name || "Workspace"}</h1>
              <p className="sidebar-copy mt-2 text-sm">
                {user?.name} / {user?.role}
              </p>
            </div>
            <ProjectContextCard
              projects={projects}
              currentProject={currentProject}
              currentProjectId={currentProjectId}
              setCurrentProjectId={setCurrentProjectId}
            />
            <nav className="space-y-3">
              {visibleNavItems.map((item) => (
                <SidebarLink key={item.to} {...item} />
              ))}
            </nav>
            <button className="ghost-btn w-full" type="button" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </aside>
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="workspace-divider flex items-center justify-between border-b px-4 py-4 lg:px-8">
            <div>
              <p className="sidebar-status text-xs uppercase tracking-[0.24em]">Navigation</p>
              <p className="section-title mt-1 text-lg font-semibold">Clear workspace flow</p>
            </div>
            <div className="flex items-center gap-3">
              {currentProject ? (
                <div className="sidebar-panel hidden rounded-full border px-4 py-2 text-sm md:block">
                  {currentProject.name}
                </div>
              ) : null}
              <button className="ghost-btn lg:hidden" type="button" onClick={() => setMobileNavOpen(true)}>
                Menu
              </button>
            </div>
          </header>
          {mobileNavOpen ? (
            <div className="mobile-overlay fixed inset-0 z-50 px-4 py-6 lg:hidden">
              <div className="dashboard-shell mx-auto max-w-md rounded-[28px] border p-5">
                <div className="flex items-center justify-between">
                  <p className="section-title text-lg font-semibold">{company?.name}</p>
                  <button className="ghost-btn" type="button" onClick={() => setMobileNavOpen(false)}>
                    Close
                  </button>
                </div>
                <div className="mt-5">
                  <ProjectContextCard
                    projects={projects}
                    currentProject={currentProject}
                    currentProjectId={currentProjectId}
                    setCurrentProjectId={setCurrentProjectId}
                    compact
                  />
                </div>
                <nav className="mt-5 space-y-3">
                  {visibleNavItems.map((item) => (
                    <SidebarLink key={item.to} {...item} onClick={() => setMobileNavOpen(false)} />
                  ))}
                </nav>
              </div>
            </div>
          ) : null}
          <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
