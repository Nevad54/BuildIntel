import { useState } from "react";
import { number } from "../lib/app.js";
import { ActionMenu, Banner, EmptyState, Field, MetricCard, QuickLink, SectionCard } from "../components/ui.jsx";

function ReviewQueueSummary({ documents }) {
  const pending = documents.filter((d) => d.reviewStatus === "Pending").length;
  const reviewed = documents.filter((d) => d.reviewStatus === "Reviewed").length;
  const approved = documents.filter((d) => d.reviewStatus === "Approved").length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total Files" value={number.format(documents.length)} />
      <MetricCard label="Pending" value={number.format(pending)} />
      <MetricCard label="Reviewed" value={number.format(reviewed)} />
      <MetricCard label="Approved" value={number.format(approved)} />
    </div>
  );
}

const isMEP = (doc) => doc.docType === "mep";
const isCivil = (doc) => doc.docType === "civil";

function ArchitecturalFields({ draft, setDraft, canManageDocuments }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Wall Lengths (m)"
          type="number"
          min="0"
          value={draft.extracted.wallLengths ?? 0}
          disabled={!canManageDocuments}
          onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, wallLengths: e.target.value } }))}
        />
        <Field
          label="Floor Areas (sqm)"
          type="number"
          min="0"
          value={draft.extracted.floorAreas ?? 0}
          disabled={!canManageDocuments}
          onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, floorAreas: e.target.value } }))}
        />
      </div>
      <Field
        label="Room Dimensions (one per line)"
        type="textarea"
        rows={4}
        value={draft.extracted.roomDimensions ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, roomDimensions: e.target.value } }))}
      />
      <Field
        label="Structural Elements (one per line)"
        type="textarea"
        rows={4}
        value={draft.extracted.structuralElements ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, structuralElements: e.target.value } }))}
      />
    </>
  );
}

function MEPFields({ draft, setDraft, canManageDocuments }) {
  return (
    <>
      <Field
        label="Pipes (one per line — material, diameter, run length)"
        type="textarea"
        rows={4}
        value={draft.extracted.pipes ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, pipes: e.target.value } }))}
      />
      <Field
        label="Fixtures (one per line — type and count)"
        type="textarea"
        rows={3}
        value={draft.extracted.fixtures ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, fixtures: e.target.value } }))}
      />
      <Field
        label="Valves (one per line — type, size, count)"
        type="textarea"
        rows={3}
        value={draft.extracted.valves ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, valves: e.target.value } }))}
      />
      <Field
        label="Equipment (one per line — pumps, tanks, heaters)"
        type="textarea"
        rows={3}
        value={draft.extracted.equipment ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, equipment: e.target.value } }))}
      />
    </>
  );
}

function CivilFields({ draft, setDraft, canManageDocuments, lowConfidence }) {
  return (
    <>
      {lowConfidence && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          CAD-generated PDFs use character-spaced text that AI cannot reliably count or measure. For best results, export a <strong>DXF file</strong> from AutoCAD (File → Save As → DXF) and re-upload — the app will read exact lengths and symbol counts directly. Otherwise, verify and fill in the fields below from your own reading of the drawing.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Total Lots"
          type="number"
          min="0"
          placeholder="e.g. 164"
          value={draft.extracted.lotCount ?? 0}
          disabled={!canManageDocuments}
          onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, lotCount: e.target.value } }))}
        />
        <Field
          label="Typical Lot Size (sqm)"
          type="number"
          min="0"
          placeholder="e.g. 36"
          value={draft.extracted.lotSizeSqm ?? 0}
          disabled={!canManageDocuments}
          onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, lotSizeSqm: e.target.value } }))}
        />
      </div>
      <Field
        label="Total Road Length (m)"
        type="number"
        min="0"
        placeholder="e.g. 850"
        value={draft.extracted.roadLengthM ?? 0}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, roadLengthM: e.target.value } }))}
      />
      <Field
        label="Road Details (one per line)"
        type="textarea"
        rows={3}
        placeholder={"Road Lot 1: 8.0m wide, ~200m long\nRoad Lot 2: 6.5m wide, ~150m long…"}
        value={draft.extracted.roadDetails ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, roadDetails: e.target.value } }))}
      />
      <Field
        label="Drainage Pipes (one per line)"
        type="textarea"
        rows={3}
        placeholder={"24\" RCP: est. 620m\n15\" RCP: est. 320m…"}
        value={draft.extracted.drainagePipes ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, drainagePipes: e.target.value } }))}
      />
      <Field
        label="Waterline Pipes (one per line)"
        type="textarea"
        rows={3}
        placeholder={"100mm PVC: est. 180m\n75mm PVC: est. 400m\n50mm PVC: est. 850m…"}
        value={draft.extracted.waterlinePipes ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, waterlinePipes: e.target.value } }))}
      />
      <Field
        label="Other Infrastructure (one per line)"
        type="textarea"
        rows={3}
        placeholder={"Fire hydrants: 6 pcs\nGate valves: 7 pcs\nJetmatic pump: 1 unit"}
        value={draft.extracted.otherInfrastructure ?? ""}
        disabled={!canManageDocuments}
        onChange={(e) => setDraft((d) => ({ ...d, extracted: { ...d.extracted, otherInfrastructure: e.target.value } }))}
      />
    </>
  );
}

function ReviewCard({ document, projects, onSaveReview, onDeleteDocument, reviewBusy, canManageDocuments, onGenerateFromDocument, generateBusy }) {
  const projectName = projects?.find((p) => p.id === document.projectId)?.name;
  const mep = isMEP(document);
  const civil = isCivil(document);
  const civilLowConfidence = civil && (
    !document.extracted?.lotCount &&
    !document.extracted?.roadLengthM &&
    !(document.extracted?.waterlinePipes?.length) &&
    !(document.extracted?.drainagePipes?.length)
  );

  const initExtracted = mep
    ? {
        pipes: (document.extracted?.pipes || []).join("\n"),
        fixtures: (document.extracted?.fixtures || []).join("\n"),
        valves: (document.extracted?.valves || []).join("\n"),
        equipment: (document.extracted?.equipment || []).join("\n")
      }
    : civil
    ? {
        lotCount: document.extracted?.lotCount ?? 0,
        lotSizeSqm: document.extracted?.lotSizeSqm ?? 0,
        roadLengthM: document.extracted?.roadLengthM ?? 0,
        roadDetails: (document.extracted?.roadDetails || []).join("\n"),
        drainagePipes: (document.extracted?.drainagePipes || []).join("\n"),
        waterlinePipes: (document.extracted?.waterlinePipes || []).join("\n"),
        otherInfrastructure: (document.extracted?.otherInfrastructure || []).join("\n")
      }
    : {
        wallLengths: document.extracted?.wallLengths ?? 0,
        floorAreas: document.extracted?.floorAreas ?? 0,
        roomDimensions: (document.extracted?.roomDimensions || []).join("\n"),
        structuralElements: (document.extracted?.structuralElements || []).join("\n")
      };

  const [draft, setDraft] = useState({
    extractionSummary: document.extractionSummary,
    reviewStatus: document.reviewStatus,
    extracted: initExtracted
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    const extracted = mep
      ? {
          pipes: draft.extracted.pipes.split("\n").filter(Boolean),
          fixtures: draft.extracted.fixtures.split("\n").filter(Boolean),
          valves: draft.extracted.valves.split("\n").filter(Boolean),
          equipment: draft.extracted.equipment.split("\n").filter(Boolean)
        }
      : civil
      ? {
          lotCount: Number(draft.extracted.lotCount),
          lotSizeSqm: Number(draft.extracted.lotSizeSqm),
          roadLengthM: Number(draft.extracted.roadLengthM),
          roadDetails: draft.extracted.roadDetails.split("\n").filter(Boolean),
          drainagePipes: draft.extracted.drainagePipes.split("\n").filter(Boolean),
          waterlinePipes: draft.extracted.waterlinePipes.split("\n").filter(Boolean),
          otherInfrastructure: draft.extracted.otherInfrastructure.split("\n").filter(Boolean)
        }
      : {
          wallLengths: Number(draft.extracted.wallLengths),
          floorAreas: Number(draft.extracted.floorAreas),
          roomDimensions: draft.extracted.roomDimensions.split("\n").filter(Boolean),
          structuralElements: draft.extracted.structuralElements.split("\n").filter(Boolean)
        };

    onSaveReview(document.id, {
      extractionSummary: draft.extractionSummary,
      reviewStatus: draft.reviewStatus,
      extracted
    });
  };

  const buildPrompt = () => {
    const parts = [document.extractionSummary || ""];
    const ex = document.extracted || {};
    if (mep) {
      if (ex.pipes?.length) parts.push("Pipes:\n" + ex.pipes.join("\n"));
      if (ex.fixtures?.length) parts.push("Fixtures:\n" + ex.fixtures.join("\n"));
      if (ex.valves?.length) parts.push("Valves:\n" + ex.valves.join("\n"));
      if (ex.equipment?.length) parts.push("Equipment:\n" + ex.equipment.join("\n"));
    } else if (civil) {
      if (ex.lotCount) parts.push(`Lots: ${ex.lotCount} lots @ ${ex.lotSizeSqm} sqm each`);
      if (ex.roadLengthM) parts.push(`Total road length: ${ex.roadLengthM}m`);
      if (ex.roadDetails?.length) parts.push("Roads:\n" + ex.roadDetails.join("\n"));
      if (ex.drainagePipes?.length) parts.push("Drainage:\n" + ex.drainagePipes.join("\n"));
      if (ex.waterlinePipes?.length) parts.push("Waterline:\n" + ex.waterlinePipes.join("\n"));
      if (ex.otherInfrastructure?.length) parts.push("Other:\n" + ex.otherInfrastructure.join("\n"));
    } else {
      if (ex.roomDimensions?.length) parts.push("Room Dimensions:\n" + ex.roomDimensions.join("\n"));
      if (ex.structuralElements?.length) parts.push("Structural Elements:\n" + ex.structuralElements.join("\n"));
      if (ex.wallLengths) parts.push(`Wall lengths: ${ex.wallLengths}m`);
      if (ex.floorAreas) parts.push(`Floor areas: ${ex.floorAreas} sqm`);
    }
    if (document.notes) parts.push(`Notes: ${document.notes}`);
    const area = document.areaHint || ex.floorAreas;
    return `[Document: ${document.filename}] ${parts.filter(Boolean).join("\n\n")}${area ? ` Area: ${area} sqm.` : ""}`;
  };

  return (
    <div className="surface-card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <h3 className="surface-title text-lg font-semibold">{document.filename}</h3>
            {mep && (
              <span className="surface-pill rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.15em]">MEP</span>
            )}
            {civil && (
              <span className="surface-pill rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.15em]">Civil</span>
            )}
          </div>
          {projectName ? (
            <p className="surface-meta mt-0.5 text-xs">Project: {projectName}</p>
          ) : null}
          <p className="surface-copy mt-1 text-sm">{document.extractionSummary}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="surface-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
            {draft.reviewStatus}
          </span>
          {canManageDocuments ? (
            confirmDelete ? (
              <div className="flex gap-2">
                <button
                  className="ghost-btn text-xs text-rose-400"
                  type="button"
                  onClick={() => onDeleteDocument(document.id)}
                  disabled={reviewBusy}
                >
                  {reviewBusy ? "Deleting…" : "Confirm Delete"}
                </button>
                <button className="ghost-btn text-xs" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button className="ghost-btn text-xs" type="button" onClick={() => setConfirmDelete(true)}>Delete</button>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-4">
          <Field
            label="Summary"
            type="textarea"
            rows={4}
            value={draft.extractionSummary}
            disabled={!canManageDocuments}
            onChange={(e) => setDraft((d) => ({ ...d, extractionSummary: e.target.value }))}
          />
          <label className="app-label block text-sm">
            <span>Review Status</span>
            <select
              className="app-input mt-1.5 w-full px-3 py-2"
              value={draft.reviewStatus}
              disabled={!canManageDocuments}
              onChange={(e) => setDraft((d) => ({ ...d, reviewStatus: e.target.value }))}
            >
              {["Pending", "Reviewed", "Approved"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4">
          {mep
            ? <MEPFields draft={draft} setDraft={setDraft} canManageDocuments={canManageDocuments} />
            : civil
            ? <CivilFields draft={draft} setDraft={setDraft} canManageDocuments={canManageDocuments} lowConfidence={civilLowConfidence} />
            : <ArchitecturalFields draft={draft} setDraft={setDraft} canManageDocuments={canManageDocuments} />
          }
          {canManageDocuments ? (
            <div className="flex flex-wrap items-center gap-3">
              <button className="ghost-btn" type="button" onClick={handleSave} disabled={reviewBusy}>
                {reviewBusy ? "Saving…" : "Save Review"}
              </button>
              <p className="surface-copy text-sm">Saving keeps extracted signals aligned with downstream estimate assumptions.</p>
            </div>
          ) : (
            <p className="surface-copy text-sm">Viewers can inspect extracted signals, but only admins and estimators can edit the review.</p>
          )}
          {canManageDocuments ? (
            <div className="mt-4">
              <button
                className="primary-btn"
                type="button"
                disabled={generateBusy}
                onClick={() => onGenerateFromDocument({ prompt: buildPrompt(), projectId: document.projectId, discipline: document.docType || "architectural", documentId: document.id })}
              >
                {generateBusy ? "Generating…" : "Generate Estimate from this Document"}
              </button>
              <p className="surface-copy text-xs mt-2">Creates a new AI estimate using the extracted document content.</p>
            </div>
          ) : null}
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
  onDeleteDocument,
  reviewBusy,
  notice,
  error,
  onGenerateFromDocument,
  generateBusy
}) {
  const canManageDocuments = ["Admin", "Estimator"].includes(data.user?.role);

  const handleSaveReview = (documentId, payload) => {
    onReviewDocument(documentId, { ...data.documents.find((d) => d.id === documentId), ...payload, extracted: payload.extracted }, true);
  };

  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard
        title="Document Workflow"
        eyebrow="Documents"
        actions={
          <ActionMenu
            items={[
              { label: "Projects", to: "/projects" },
              { label: "Estimates", to: "/estimates" }
            ]}
          />
        }
      >
        <ReviewQueueSummary documents={data.documents} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Upload and Analyze" eyebrow="Intake">
          <div className="space-y-5">
            {canManageDocuments ? (
              <form className="grid gap-4 md:grid-cols-2" onSubmit={onUploadDocument}>
                <label className="app-label block text-sm">
                  <span>Project</span>
                  <select
                    className="app-input mt-1.5 w-full px-3 py-2"
                    value={documentForm.projectId}
                    onChange={(e) => setDocumentForm((c) => ({ ...c, projectId: e.target.value, newProjectName: "" }))}
                  >
                    <option value="">— Create new project —</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
                {!documentForm.projectId ? (
                  <Field
                    label="New Project Name"
                    placeholder="e.g. Barangay Hall Renovation"
                    value={documentForm.newProjectName}
                    onChange={(e) => setDocumentForm((c) => ({ ...c, newProjectName: e.target.value }))}
                  />
                ) : <div />}
                <label className="app-label block text-sm">
                  <span>Document Type</span>
                  <select
                    className="app-input mt-1.5 w-full px-3 py-2"
                    value={documentForm.docType}
                    onChange={(e) => setDocumentForm((c) => ({ ...c, docType: e.target.value }))}
                  >
                    <option value="architectural">Architectural / Structural</option>
                    <option value="mep">Plumbing / MEP</option>
                    <option value="civil">Site / Civil Works</option>
                  </select>
                </label>
                <Field
                  label="Expected Floor Area (sqm)"
                  type="number"
                  min="1"
                  value={documentForm.areaHint}
                  onChange={(e) => setDocumentForm((c) => ({ ...c, areaHint: e.target.value }))}
                />
                <div className="md:col-span-2">
                  <Field
                    label={documentForm.docType === "civil" ? "Upload File(s) — PDF or DXF (select multiple for civil)" : "Upload File"}
                    type="file"
                    accept=".pdf,.dxf,.txt,.md,.csv,.json"
                    multiple={documentForm.docType === "civil"}
                    fileName={documentForm.files?.length > 1
                      ? `${documentForm.files.length} files selected`
                      : documentForm.filename}
                    onChange={(e) => {
                      const fileList = Array.from(e.target.files || []);
                      const firstName = fileList[0]?.name || "";
                      const baseName = firstName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
                      setDocumentForm((c) => ({
                        ...c,
                        files: fileList,
                        file: fileList[0] || null,
                        filename: fileList.length === 1 ? firstName : fileList.map(f => f.name).join(", "),
                        newProjectName: c.projectId ? c.newProjectName : (c.newProjectName || baseName)
                      }));
                    }}
                  />
                </div>
                <div className="md:col-span-2">
                  <Field
                    label="Notes"
                    type="textarea"
                    rows={4}
                    autoComplete="off"
                    placeholder="Add any context that will help review the file after extraction."
                    value={documentForm.notes}
                    onChange={(e) => setDocumentForm((c) => ({ ...c, notes: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <button className="primary-btn" type="submit" disabled={uploadBusy}>
                    {uploadBusy ? "Uploading…" : "Upload and Analyze"}
                  </button>
                  <p className="surface-copy text-sm">Uploaded files appear immediately in the review queue.</p>
                </div>
              </form>
            ) : data.projects.length ? (
              <EmptyState
                title="Uploads are restricted"
                description="Viewers can review document findings, but only admins and estimators can upload or analyze new files."
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
                  projects={data.projects}
                  onSaveReview={handleSaveReview}
                  onDeleteDocument={onDeleteDocument}
                  reviewBusy={reviewBusy}
                  canManageDocuments={canManageDocuments}
                  onGenerateFromDocument={onGenerateFromDocument}
                  generateBusy={generateBusy}
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
