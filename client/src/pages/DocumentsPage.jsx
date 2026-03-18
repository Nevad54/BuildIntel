import { Link } from "react-router-dom";
import { number } from "../lib/app.js";
import { Banner, EmptyState, Field, MetricCard, SectionCard } from "../components/ui.jsx";

function QuickLink({ to, label, tone = "ghost" }) {
  return <Link className={tone === "primary" ? "primary-btn inline-flex items-center" : "ghost-btn inline-flex items-center"} to={to}>{label}</Link>;
}

function ReviewQueueSummary({ documents }) {
  const pending = documents.filter((document) => document.reviewStatus === "Pending").length;
  const reviewed = documents.filter((document) => document.reviewStatus === "Reviewed").length;
  const approved = documents.filter((document) => document.reviewStatus === "Approved").length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total Files" value={number.format(documents.length)} />
      <MetricCard label="Pending" value={number.format(pending)} />
      <MetricCard label="Reviewed" value={number.format(reviewed)} />
      <MetricCard label="Approved" value={number.format(approved)} />
    </div>
  );
}

function UploadGuidance({ currentProject }) {
  if (!currentProject) {
    return (
      <EmptyState
        title="Create a project before uploading documents"
        description="Documents are attached to projects, so start in Projects or use the intake form on Dashboard first."
        action={<QuickLink to="/projects" label="Open Projects" tone="primary" />}
      />
    );
  }

  return (
    <div className="surface-card rounded-[24px] p-5">
      <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Current Context</p>
      <h3 className="surface-title mt-2 text-xl font-semibold">{currentProject.name}</h3>
      <p className="surface-copy mt-2 text-sm">
        {currentProject.location} / {number.format(currentProject.areaSqm)} sqm / {currentProject.status}
      </p>
      <p className="surface-copy mt-4 text-sm leading-6">
        Upload plans, scope sheets, or structured text files here. The review queue below lets you validate extracted dimensions before they affect downstream estimates.
      </p>
    </div>
  );
}

function ReviewCard({ document, onReviewDocument, reviewBusy, canManageDocuments }) {
  const extracted = document.extracted || {};
  const roomDimensions = (extracted.roomDimensions || []).join("\n");
  const structuralElements = (extracted.structuralElements || []).join("\n");

  return (
    <div className="surface-card rounded-[22px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h3 className="surface-title text-lg font-semibold">{document.filename}</h3>
          <p className="surface-copy mt-1 text-sm">{document.extractionSummary}</p>
        </div>
        <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
          {document.reviewStatus}
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-4">
          <Field
            label="Summary"
            type="textarea"
            rows={4}
            value={document.extractionSummary}
            disabled={!canManageDocuments}
            onChange={(event) =>
              onReviewDocument(
                document.id,
                {
                  ...document,
                  extractionSummary: event.target.value
                },
                false
              )
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Wall Lengths"
              type="number"
              min="0"
              value={extracted.wallLengths ?? 0}
              disabled={!canManageDocuments}
              onChange={(event) =>
                onReviewDocument(
                  document.id,
                  {
                    ...document,
                    extracted: { ...extracted, wallLengths: event.target.value }
                  },
                  false
                )
              }
            />
            <Field
              label="Floor Areas"
              type="number"
              min="0"
              value={extracted.floorAreas ?? 0}
              disabled={!canManageDocuments}
              onChange={(event) =>
                onReviewDocument(
                  document.id,
                  {
                    ...document,
                    extracted: { ...extracted, floorAreas: event.target.value }
                  },
                  false
                )
              }
            />
          </div>
          <label className="app-label block text-sm">
            <span>Review Status</span>
            <select
              className="app-input mt-2 w-full rounded-2xl px-4 py-3"
              value={document.reviewStatus}
              disabled={!canManageDocuments}
              onChange={(event) => onReviewDocument(document.id, { ...document, reviewStatus: event.target.value }, false)}
            >
              {["Pending", "Reviewed", "Approved"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4">
            <Field
              label="Room Dimensions"
              type="textarea"
              rows={4}
              value={roomDimensions}
              disabled={!canManageDocuments}
              onChange={(event) =>
              onReviewDocument(
                document.id,
                {
                  ...document,
                  extracted: {
                    ...extracted,
                    roomDimensions: event.target.value.split("\n").filter(Boolean)
                  }
                },
                false
              )
            }
          />
            <Field
              label="Structural Elements"
              type="textarea"
              rows={4}
              value={structuralElements}
              disabled={!canManageDocuments}
              onChange={(event) =>
              onReviewDocument(
                document.id,
                {
                  ...document,
                  extracted: {
                    ...extracted,
                    structuralElements: event.target.value.split("\n").filter(Boolean)
                  }
                },
                false
              )
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => onReviewDocument(document.id, document, true)}
              disabled={reviewBusy || !canManageDocuments}
            >
              {reviewBusy ? "Saving..." : canManageDocuments ? "Save Review" : "Read Only"}
            </button>
            <p className="surface-copy text-sm">
              {canManageDocuments
                ? "Saving keeps the extracted geometry aligned with downstream estimate assumptions."
                : "Viewers can inspect extracted geometry here, but only admins and estimators can edit the review."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocumentsPage({
  data,
  documentForm,
  setDocumentForm,
  onUploadDocument,
  uploadBusy,
  onReviewDocument,
  reviewBusy,
  notice,
  error
}) {
  const canManageDocuments = ["Admin", "Estimator"].includes(data.user?.role);
  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="Document Workflow"
        eyebrow="Documents"
        actions={
          <div className="flex flex-wrap gap-2">
            <QuickLink to="/projects" label="Projects" />
            <QuickLink to="/estimates" label="Estimates" />
          </div>
        }
      >
        <ReviewQueueSummary documents={data.documents} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Upload and Analyze" eyebrow="Intake">
          <div className="space-y-5">
            <UploadGuidance currentProject={data.currentProject} />
            {data.projects.length && canManageDocuments ? (
              <form className="grid gap-4 md:grid-cols-2" onSubmit={onUploadDocument}>
                <label className="app-label block text-sm">
                  <span>Project</span>
                  <select
                    className="app-input mt-2 w-full rounded-2xl px-4 py-3"
                    value={documentForm.projectId}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, projectId: event.target.value }))}
                  >
                    <option value="">Choose project</option>
                    {data.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Area Hint"
                  type="number"
                  min="1"
                  value={documentForm.areaHint}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, areaHint: event.target.value }))}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Upload File"
                    type="file"
                    accept=".pdf,.txt,.md,.csv,.json"
                    onChange={(event) =>
                      setDocumentForm((current) => ({
                        ...current,
                        file: event.target.files?.[0] || null,
                        filename: event.target.files?.[0]?.name || ""
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Field
                    label="Notes"
                    type="textarea"
                    rows={4}
                    placeholder="Add any context that will help review the file after extraction."
                    value={documentForm.notes}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <button className="primary-btn" type="submit" disabled={uploadBusy}>
                    {uploadBusy ? "Uploading..." : "Upload and Analyze"}
                  </button>
                  <p className="surface-copy text-sm">Uploaded files appear immediately in the review queue below.</p>
                </div>
              </form>
            ) : data.projects.length ? (
              <EmptyState
                title="Uploads are restricted"
                description="Viewers can review document findings here, but only admins and estimators can upload or analyze new files."
              />
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Review Queue" eyebrow="Validate">
          {data.documents.length ? (
            <div className="space-y-4">
              {data.documents.map((document) => (
                <ReviewCard
                  key={document.id}
                  document={document}
                  onReviewDocument={onReviewDocument}
                  reviewBusy={reviewBusy}
                  canManageDocuments={canManageDocuments}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No documents uploaded yet"
              description="Upload a plan, scope sheet, or text file to start the extraction and review workflow."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
