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
          "sidebar-link block border px-3 py-2.5 transition",
          isActive ? "sidebar-link-active" : "sidebar-link-idle sidebar-link-hover"
        )
      }
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="sidebar-copy mt-0.5 text-xs">{description}</p>
    </NavLink>
  );
}

function TokenTracker({ tokenUsage }) {
  if (!tokenUsage) return null;
  const { totalTokens, requests, rateLimitHits } = tokenUsage;
  const hasActivity = requests > 0 || rateLimitHits > 0;
  return (
    <div className="token-tracker-divider mt-2 pt-2 border-t border-dashed">
      <p className="sidebar-eyebrow text-[10px]">AI Usage</p>
      {hasActivity ? (
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="sidebar-copy text-xs">{totalTokens.toLocaleString()} tokens</span>
          <span className="sidebar-status text-[10px]">{requests} req</span>
          {rateLimitHits > 0 && (
            <span className="text-amber-400 text-[10px]">{rateLimitHits} rate limit</span>
          )}
        </div>
      ) : (
        <p className="sidebar-copy text-[10px] mt-0.5">No AI calls yet</p>
      )}
    </div>
  );
}

function ProjectContextCard({ projects, currentProject, currentProjectId, setCurrentProjectId, compact = false }) {
  if (!projects.length) {
    return (
      <div className={cls("sidebar-panel rounded-lg border", compact ? "p-3" : "p-4")}>
        <p className="sidebar-eyebrow">Current project</p>
        <p className="sidebar-copy mt-2 text-sm">No project selected yet.</p>
      </div>
    );
  }

  return (
    <div className={cls("sidebar-panel rounded-lg border", compact ? "p-3" : "p-4")}>
      <p className="sidebar-eyebrow">Current project</p>
      <label className="app-label mt-2 block">
        <span className="sr-only">Current project</span>
        <select
          className="app-input w-full px-3 py-2 text-sm"
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
        <div className="sidebar-copy mt-3 space-y-0.5 text-xs">
          {currentProject.location ? <p>{currentProject.location}</p> : null}
          {currentProject.areaSqm ? <p>{number.format(currentProject.areaSqm)} sqm</p> : null}
          <p className="sidebar-status mt-1 uppercase tracking-[0.12em]">{currentProject.status}</p>
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
  setCurrentProjectId,
  tokenUsage
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const visibleNavItems = getNavItemsForRole(user?.role);

  return (
    <div className="workspace-root min-h-screen overflow-x-hidden">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="workspace-divider hidden w-[280px] shrink-0 border-r px-4 py-5 lg:block">
          <div className="sticky top-0 space-y-4">
            <div className="sidebar-panel rounded-lg border p-4">
              <p className="sidebar-eyebrow">BuildIntel</p>
              <h1 className="sidebar-title mt-2 text-lg font-semibold">{company?.name || "Workspace"}</h1>
              <p className="sidebar-copy mt-1 text-xs">
                {user?.name} &middot; {user?.role}
              </p>
              <TokenTracker tokenUsage={tokenUsage} />
            </div>
            <ProjectContextCard
              projects={projects}
              currentProject={currentProject}
              currentProjectId={currentProjectId}
              setCurrentProjectId={setCurrentProjectId}
            />
            <nav className="space-y-0.5">
              {visibleNavItems.map((item) => (
                <SidebarLink key={item.to} {...item} />
              ))}
            </nav>
            <button className="ghost-btn w-full text-xs" type="button" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="workspace-divider flex items-center justify-between border-b px-4 py-3 lg:px-8">
            <div className="flex items-center gap-3">
              <p className="section-title text-sm font-semibold">{company?.name || "BuildIntel"}</p>
              {currentProject ? (
                <div className="hidden items-center gap-2 md:flex">
                  <span className="sidebar-status text-xs">/</span>
                  <span className="surface-copy text-xs">{currentProject.name}</span>
                </div>
              ) : null}
            </div>
            <button className="ghost-btn text-xs lg:hidden" type="button" onClick={() => setMobileNavOpen(true)}>
              Menu
            </button>
          </header>

          {mobileNavOpen ? (
            <div className="mobile-overlay fixed inset-0 z-50 px-4 py-5 lg:hidden">
              <div className="dashboard-shell mx-auto w-full max-w-sm rounded-xl border p-4" style={{ maxWidth: "min(384px, calc(100vw - 2rem))" }}>
                <div className="flex items-center justify-between">
                  <p className="section-title text-base font-semibold">{company?.name}</p>
                  <button className="ghost-btn text-xs" type="button" onClick={() => setMobileNavOpen(false)}>
                    Close
                  </button>
                </div>
                <div className="mt-4">
                  <ProjectContextCard
                    projects={projects}
                    currentProject={currentProject}
                    currentProjectId={currentProjectId}
                    setCurrentProjectId={setCurrentProjectId}
                    compact
                  />
                </div>
                <nav className="mt-4 space-y-0.5">
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
