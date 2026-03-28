import { useRef, useState } from "react";
import { number, toBase64 } from "../lib/app.js";
import { workspaceApi } from "../lib/workspaceApi.js";
import { ActionMenu, Banner, EmptyState, Field, MetricCard, QuickLink, SectionCard } from "../components/ui.jsx";

function ProjectSummary({ projects }) {
  const counts = {
    total: projects.length,
    estimating: projects.filter((p) => p.status === "Estimating").length,
    submitted: projects.filter((p) => p.status === "Submitted").length,
    won: projects.filter((p) => p.status === "Won").length
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

function ProjectCard({ project, onUpdateProject, onDeleteProject, updateBusy, canManageProjects, token, documents }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: project.name, location: project.location, areaSqm: String(project.areaSqm), description: project.description });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveEdit = async (e) => {
    e.preventDefault();
    await onUpdateProject(project.id, { ...draft, areaSqm: Number(draft.areaSqm) });
    setEditing(false);
  };

  return (
    <div className="surface-card rounded-2xl p-4">
      {editing ? (
        <form className="space-y-3" onSubmit={saveEdit}>
          <Field label="Name" autoComplete="off" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location" autoComplete="off" value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
            <Field label="Area (sqm)" type="number" min="1" autoComplete="off" value={draft.areaSqm} onChange={(e) => setDraft((d) => ({ ...d, areaSqm: e.target.value }))} />
          </div>
          <Field label="Description" type="textarea" rows={3} autoComplete="off" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          <div className="flex gap-2 pt-1">
            <button className="primary-btn" type="submit" disabled={updateBusy}>{updateBusy ? "Saving…" : "Save"}</button>
            <button className="ghost-btn" type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p className="surface-title text-sm font-semibold">{project.name}</p>
          <p className="surface-copy mt-1 text-sm">
            {[project.location, project.areaSqm ? `${number.format(project.areaSqm)} sqm` : null].filter(Boolean).join(" / ") || "No details yet"}
          </p>
          <p className="surface-copy mt-2 text-sm leading-6 line-clamp-2">{project.description}</p>

          {canManageProjects ? (
            <div className="mt-3 space-y-2">
              <label className="app-label block text-sm">
                <span>Stage</span>
                <select
                  className="app-input mt-1.5 w-full px-3 py-2 text-sm"
                  value={project.status}
                  onChange={(e) => onUpdateProject(project.id, { status: e.target.value })}
                  disabled={updateBusy}
                >
                  {["Estimating", "Submitted", "Won", "Lost"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 pt-1">
                <button className="ghost-btn text-xs" type="button" onClick={() => setEditing(true)}>Edit</button>
                {confirmDelete ? (
                  <>
                    <button className="ghost-btn text-xs text-rose-400" type="button" onClick={() => onDeleteProject(project.id)} disabled={updateBusy}>
                      {updateBusy ? "Deleting…" : "Confirm Delete"}
                    </button>
                    <button className="ghost-btn text-xs" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </>
                ) : (
                  <button className="ghost-btn text-xs" type="button" onClick={() => setConfirmDelete(true)}>Delete</button>
                )}
              </div>
            </div>
          ) : (
            <p className="surface-meta mt-4 text-xs uppercase tracking-[0.2em]">Read only</p>
          )}
          <ProjectFileLibrary project={project} token={token} canManage={canManageProjects} documents={documents} />
        </>
      )}
    </div>
  );
}

function PipelineBoard({ projects, onUpdateProject, onDeleteProject, updateBusy, canManageProjects, token, documents }) {
  const ALL_STAGES = ["Estimating", "Submitted", "Won", "Lost"];
  const grouped = ALL_STAGES.map((status) => ({ status, items: projects.filter((p) => p.status === status) }));
  // Always show Estimating; only show other columns if they have projects
  const visibleGroups = grouped.filter((g) => g.status === "Estimating" || g.items.length > 0);
  // Collapsed stages summary (empty non-Estimating stages)
  const collapsedStages = grouped.filter((g) => g.status !== "Estimating" && g.items.length === 0);

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${visibleGroups.length === 1 ? "" : visibleGroups.length === 2 ? "xl:grid-cols-2" : visibleGroups.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        {visibleGroups.map((group) => (
          <div key={group.status} className="surface-card rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="surface-title text-base font-semibold">{group.status}</h3>
              <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                {number.format(group.items.length)}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {group.items.length ? (
                group.items.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onUpdateProject={onUpdateProject}
                    onDeleteProject={onDeleteProject}
                    updateBusy={updateBusy}
                    canManageProjects={canManageProjects}
                    token={token}
                    documents={documents}
                  />
                ))
              ) : (
                <p className="surface-copy text-sm">No projects yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {collapsedStages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {collapsedStages.map((g) => (
            <span key={g.status} className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
              {g.status} · 0
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const FILE_ICONS = {
  "application/pdf": "📄",
  "image/png": "🖼️",
  "image/jpeg": "🖼️",
  "image/gif": "🖼️",
  "image/webp": "🖼️",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.ms-excel": "📊",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/msword": "📝",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📊",
  "application/vnd.ms-powerpoint": "📊",
  "image/vnd.dxf": "📐",
  "text/plain": "📃",
  "text/csv": "📊",
  "application/json": "📃"
};
const fileIcon = (mime) => FILE_ICONS[mime] || "📎";
const fmtSize = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : bytes > 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;

function ProjectFileLibrary({ project, token, canManage, documents }) {
  const [files, setFiles] = useState(null); // null = not loaded
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const inputRef = useRef(null);

  const load = async () => {
    try {
      const result = await workspaceApi.listProjectFiles(token, project.id);
      setFiles(result);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggle = () => {
    if (!open && files === null) load();
    setOpen((v) => !v);
  };

  const handleUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of fileList) {
        const contentBase64 = await toBase64(file);
        await workspaceApi.uploadProjectFile(token, project.id, {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          contentBase64
        });
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (fileId) => {
    setError(null);
    try {
      await workspaceApi.deleteProjectFile(token, project.id, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (e) {
      setError(e.message);
    }
  };

  const promoteToDocument = async (fileId) => {
    setError(null);
    try {
      await workspaceApi.promoteFileToDocument(token, project.id, fileId, "architectural");
    } catch (e) {
      setError(e.message);
    }
  };

  const attachFromDocument = async (documentId) => {
    setShowDocPicker(false);
    setUploading(true);
    setError(null);
    try {
      await workspaceApi.attachDocumentAsFile(token, project.id, documentId);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      <button
        type="button"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] surface-meta hover:opacity-80"
        onClick={toggle}
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>Files {files ? `(${files.length})` : ""}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {files === null ? (
            <p className="surface-copy text-xs">Loading…</p>
          ) : files.length === 0 ? (
            <p className="surface-copy text-xs">No files attached yet.</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.id} className="surface-card flex items-center gap-2 rounded-lg px-3 py-2">
                  <span className="text-base leading-none">{fileIcon(f.mimeType)}</span>
                  <span className="surface-copy min-w-0 flex-1 truncate text-xs" title={f.filename}>{f.filename}</span>
                  <span className="surface-meta text-[10px] shrink-0">{fmtSize(f.sizeBytes)}</span>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="ghost-btn py-0.5 px-2 text-[10px] text-sky-400 shrink-0"
                        title="Send to Documents for AI analysis"
                        aria-label={`Promote ${f.filename} to Documents`}
                        onClick={() => promoteToDocument(f.id)}
                      >
                        → Docs
                      </button>
                      <button
                        type="button"
                        className="ghost-btn py-0.5 px-2 text-[10px] text-rose-400 shrink-0"
                        aria-label={`Delete ${f.filename}`}
                        onClick={() => handleDelete(f.id)}
                      >
                        ✕
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.dxf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.txt,.csv,.json"
                className="hidden"
                onChange={handleUpload}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ghost-btn text-xs"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "+ Upload File"}
                </button>
                {documents && documents.length > 0 ? (
                  <button
                    type="button"
                    className="ghost-btn text-xs"
                    disabled={uploading}
                    onClick={() => setShowDocPicker((v) => !v)}
                  >
                    {showDocPicker ? "Cancel" : "+ From Documents"}
                  </button>
                ) : null}
              </div>
              {showDocPicker ? (
                <ul className="surface-card space-y-1 rounded-xl p-2">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-white/10 surface-copy truncate"
                        onClick={() => attachFromDocument(doc.id)}
                      >
                        📄 {doc.filename}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="surface-meta text-[10px]">PDF, DXF, images, Excel, Word, PPT, CSV, JSON</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ProjectsPage({
  data,
  token,
  projectForm,
  setProjectForm,
  onCreateProject,
  createBusy,
  onUpdateProject,
  onDeleteProject,
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
          <ActionMenu
            items={[
              { label: "Documents", to: "/documents" },
              { label: "Estimates", to: "/estimates" }
            ]}
          />
        }
      >
        <ProjectSummary projects={data.projects} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="Project Intake" eyebrow="Create New">
          {canManageProjects ? (
            <form className="space-y-4" onSubmit={onCreateProject}>
              <Field
                label="Project Name"
                autoComplete="off"
                value={projectForm.name}
                placeholder="Retail fit-out, house shell, office renovation…"
                onChange={(e) => setProjectForm((c) => ({ ...c, name: e.target.value }))}
              />
              <Field
                label="Location"
                autoComplete="off"
                value={projectForm.location}
                placeholder="Makati, Taguig, Quezon City…"
                onChange={(e) => setProjectForm((c) => ({ ...c, location: e.target.value }))}
              />
              <Field
                label="Area (sqm)"
                type="number"
                min="1"
                autoComplete="off"
                value={projectForm.areaSqm}
                onChange={(e) => setProjectForm((c) => ({ ...c, areaSqm: e.target.value }))}
              />
              <Field
                label="Description"
                type="textarea"
                rows={5}
                autoComplete="off"
                placeholder="Describe the build type, scope, and pricing context…"
                value={projectForm.description}
                onChange={(e) => setProjectForm((c) => ({ ...c, description: e.target.value }))}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button className="primary-btn" type="submit" disabled={createBusy}>
                  {createBusy ? "Adding…" : "Add Project"}
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
            <PipelineBoard
              projects={data.projects}
              onUpdateProject={onUpdateProject}
              onDeleteProject={onDeleteProject}
              updateBusy={updateBusy}
              canManageProjects={canManageProjects}
              token={token}
              documents={data.documents}
            />
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
