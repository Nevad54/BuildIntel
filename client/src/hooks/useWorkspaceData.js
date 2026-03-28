import { useEffect, useMemo, useState } from "react";
import {
  createClientId,
  documentDefaults,
  estimateDefaults,
  materialDefaults,
  pricingImportDefaults,
  projectDefaults,
  remoteImportDefaults,
  researchDefaults,
  simulationDefaults,
  supplierDefaults,
  templateDefaults,
  toBase64
} from "../lib/app.js";
import { workspaceApi } from "../lib/workspaceApi.js";

const withEstimateRowIds = (items = []) =>
  items.map((item) => ({
    ...item,
    _rowId: item._rowId || createClientId("estimate-row"),
    remarks: item.remarks || "",
    payItem: item.payItem || "",
    locked: item.locked || false,
    qtoFormula: item.qtoFormula || ""
  }));

export function useWorkspaceData({ token, onUnauthorized, setGlobalError, setGlobalNotice }) {
  const [workspace, setWorkspace] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [projectForm, setProjectForm] = useState(projectDefaults);
  const [templateForm, setTemplateForm] = useState(templateDefaults);
  const [materialForm, setMaterialForm] = useState(materialDefaults);
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    companyName: "",
    password: ""
  });
  const [estimateForm, setEstimateForm] = useState(estimateDefaults);
  const [documentForm, setDocumentForm] = useState(documentDefaults);
  const [researchForm, setResearchForm] = useState(researchDefaults);
  const [supplierForm, setSupplierForm] = useState(supplierDefaults);
  const [pricingImportForm, setPricingImportForm] = useState(pricingImportDefaults);
  const [remoteImportForm, setRemoteImportForm] = useState(remoteImportDefaults);
  const [simulationForm, setSimulationForm] = useState(simulationDefaults);
  const [simulation, setSimulation] = useState(null);
  const [pricingResult, setPricingResult] = useState(null);
  const [supplierResults, setSupplierResults] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [selectedEstimateId, setSelectedEstimateId] = useState("");
  const [lastGeneratedEstimateId, setLastGeneratedEstimateId] = useState("");
  const [marketRefreshResult, setMarketRefreshResult] = useState(null);
  const [editEstimate, setEditEstimate] = useState({ items: [] });
  const [createBusy, setCreateBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [patchBusy, setPatchBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [promptTemplateBusy, setPromptTemplateBusy] = useState(false);
  const [marketRefreshBusy, setMarketRefreshBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [bulkRepriceBusy, setBulkRepriceBusy] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const user = workspace?.user;

  const loadWorkspace = async (activeToken = token) => {
    if (!activeToken) {
      return;
    }

    setLoadingWorkspace(true);
    try {
      const bootstrap = await workspaceApi.bootstrap(activeToken);
      setWorkspace(bootstrap);
      setCurrentProjectId((current) => current || bootstrap.projects?.[0]?.id || "");
      setSelectedEstimateId((current) => current || bootstrap.estimates?.[0]?.id || "");
      setDocumentForm((current) => current.projectId ? current : { ...current, projectId: bootstrap.projects?.[0]?.id || "" });
      if (bootstrap.projects?.[0]?.id) {
        setDocumentForm((current) => ({ ...current, projectId: current.projectId || bootstrap.projects[0].id }));
        setEstimateForm((current) => ({ ...current, projectId: current.projectId || bootstrap.projects[0].id }));
      }
      if (!estimateForm.templateId && bootstrap.templates?.[0]?.id) {
        setEstimateForm((current) => ({ ...current, templateId: current.templateId || bootstrap.templates[0].id }));
      }
    } catch (error) {
      onUnauthorized?.(error);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadWorkspace(token);
    } else {
      setWorkspace(null);
    }
  }, [token]);

  useEffect(() => {
    const activeEstimate = workspace?.estimates?.find((estimate) => estimate.id === selectedEstimateId) || workspace?.estimates?.[0];
    if (activeEstimate) {
      setSelectedEstimateId(activeEstimate.id);
      setEditEstimate({
        ...activeEstimate,
        items: withEstimateRowIds(activeEstimate.items)
      });
      setMarketRefreshResult((current) => (current?.estimateId === activeEstimate.id ? current : null));
    }
  }, [workspace?.estimates, selectedEstimateId]);

  useEffect(() => {
    if (!workspace?.user || !workspace?.company) {
      return;
    }

    setAccountForm((current) => ({
      ...current,
      name: workspace.user.name || "",
      email: workspace.user.email || "",
      companyName: workspace.company.name || "",
      password: ""
    }));
  }, [workspace?.user?.name, workspace?.user?.email, workspace?.company?.name]);

  useEffect(() => {
    if (!workspace?.projects?.length) {
      if (currentProjectId) {
        setCurrentProjectId("");
      }
      return;
    }

    const exists = workspace.projects.some((project) => project.id === currentProjectId);
    if (!exists) {
      setCurrentProjectId(workspace.projects[0].id);
    }
  }, [workspace?.projects, currentProjectId]);

  const data = useMemo(() => {
    if (!workspace) {
      return null;
    }

    const projects = [...workspace.projects].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      ...workspace,
      estimates: [...workspace.estimates].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      documents: [...workspace.documents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      projects,
      currentProject: projects.find((project) => project.id === currentProjectId) || projects[0] || null
    };
  }, [workspace, currentProjectId]);

  const onSelectCurrentProject = (projectId) => {
    setCurrentProjectId(projectId);
    setDocumentForm((current) => ({ ...current, projectId }));
    setEstimateForm((current) => ({ ...current, projectId }));
  };

  const onUpdateAccount = async (event) => {
    event.preventDefault();
    await withAction(setAccountBusy, async () => {
      await workspaceApi.updateAccount(token, {
        name: accountForm.name,
        email: accountForm.email,
        companyName: accountForm.companyName,
        ...(accountForm.password ? { password: accountForm.password } : {})
      });
      await loadWorkspace();
    }, "Account settings saved.");
  };

  const withAction = async (setter, action, successMessage) => {
    setter(true);
    setGlobalError("");
    try {
      await action();
      if (successMessage) {
        setGlobalNotice(successMessage);
      }
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setter(false);
    }
  };

  const onCreateProject = async (event) => {
    event.preventDefault();
    await withAction(setCreateBusy, async () => {
      const project = await workspaceApi.createProject(token, { ...projectForm, areaSqm: Number(projectForm.areaSqm) });
      setProjectForm(projectDefaults);
      setCurrentProjectId(project.id);
      setDocumentForm((current) => ({ ...current, projectId: project.id }));
      setEstimateForm((current) => ({ ...current, projectId: project.id }));
      await loadWorkspace();
    }, "Project added.");
  };

  const onUpdateProject = async (projectId, updates) => {
    await withAction(setUpdateBusy, async () => {
      await workspaceApi.updateProject(token, projectId, updates);
      await loadWorkspace();
    });
  };

  const onDeleteProject = async (projectId) => {
    await withAction(setUpdateBusy, async () => {
      await workspaceApi.deleteProject(token, projectId);
      if (currentProjectId === projectId) {
        setCurrentProjectId("");
      }
      await loadWorkspace();
    }, "Project deleted.");
  };

  const onDeleteDocument = async (documentId) => {
    await withAction(setUpdateBusy, async () => {
      await workspaceApi.deleteDocument(token, documentId);
      await loadWorkspace();
    }, "Document deleted.");
  };

  const onDeleteEstimate = async (estimateId) => {
    await withAction(setUpdateBusy, async () => {
      await workspaceApi.deleteEstimate(token, estimateId);
      setSelectedEstimateId("");
      await loadWorkspace();
    }, "Estimate deleted.");
  };

  const onCreateTemplate = async (event) => {
    event.preventDefault();
    await withAction(setTemplateBusy, async () => {
      await workspaceApi.createTemplate(token, {
        ...templateForm,
        overheadPercent: Number(templateForm.overheadPercent),
        profitPercent: Number(templateForm.profitPercent),
        contingencyPercent: Number(templateForm.contingencyPercent)
      });
      setTemplateForm(templateDefaults);
      await loadWorkspace();
    }, "Template created.");
  };

  const createMaterialRecord = async (payload, successMessage = "Material added.") => {
    let createdMaterial;

    await withAction(setMaterialBusy, async () => {
      createdMaterial = await workspaceApi.createMaterial(token, payload);
      setMaterialForm(materialDefaults);
      await loadWorkspace();
    }, successMessage);

    return createdMaterial;
  };

  const onUpdateMaterial = async (materialId, payload) => {
    await withAction(setMaterialBusy, async () => {
      await workspaceApi.updateMaterial(token, materialId, payload);
      await loadWorkspace();
    }, "Price updated.");
  };

  const onCreateMaterial = async (event) => {
    event.preventDefault();
    await createMaterialRecord({
      ...materialForm,
      averagePrice: Number(materialForm.averagePrice),
      lastMonthPrice: Number(materialForm.lastMonthPrice),
      suppliers: materialForm.suppliers.split(",").map((value) => value.trim()).filter(Boolean)
    });
  };

  const onCreateMaterialInline = async (payload) =>
    createMaterialRecord(
      {
        ...payload,
        averagePrice: Number(payload.averagePrice),
        lastMonthPrice: Number(payload.lastMonthPrice),
        suppliers: (payload.suppliers || []).map((value) => value.trim()).filter(Boolean)
      },
      "Material added to catalog."
    );

  const onGenerateFromDocument = async (payload) => {
    if (docBusy) return; // prevent duplicate submissions
    await withAction(setDocBusy, async () => {
      const estimate = await workspaceApi.generateEstimate(token, payload);
      await loadWorkspace();
      setSelectedEstimateId(estimate.id);
      setLastGeneratedEstimateId(estimate.id);
    }, "Document analyzed. Estimate created.");
  };

  const onGenerateEstimate = async (event) => {
    event.preventDefault();
    if (generateBusy) return; // prevent duplicate submissions
    await withAction(setGenerateBusy, async () => {
      const estimate = await workspaceApi.generateEstimate(token, estimateForm);
      await loadWorkspace();
      setSelectedEstimateId(estimate.id);
      setLastGeneratedEstimateId(estimate.id);
    }, "Estimate generated.");
  };

  const onGenerateWithPrompt = async (prompt) => {
    await withAction(setGenerateBusy, async () => {
      const estimate = await workspaceApi.generateEstimate(token, { ...estimateForm, prompt });
      await loadWorkspace();
      setSelectedEstimateId(estimate.id);
      setLastGeneratedEstimateId(estimate.id);
    }, "Estimate generated.");
  };

  const onCreatePromptTemplate = async (payload) => {
    let createdPromptTemplate;

    await withAction(setPromptTemplateBusy, async () => {
      createdPromptTemplate = await workspaceApi.createPromptTemplate(token, payload);
      await loadWorkspace();
    }, "Prompt template saved.");

    return createdPromptTemplate;
  };

  const onDeletePromptTemplate = async (promptTemplateId) => {
    await withAction(setPromptTemplateBusy, async () => {
      await workspaceApi.deletePromptTemplate(token, promptTemplateId);
      await loadWorkspace();
    }, "Prompt template removed.");
  };

  const onUpdatePromptTemplate = async (promptTemplateId, payload) => {
    await withAction(setPromptTemplateBusy, async () => {
      await workspaceApi.updatePromptTemplate(token, promptTemplateId, payload);
      await loadWorkspace();
    }, "Prompt template updated.");
  };

  const onSimulate = async (event) => {
    event.preventDefault();
    await withAction(() => {}, async () => {
      const result = await workspaceApi.simulateEstimate(
        token,
        Object.fromEntries(Object.entries(simulationForm).map(([key, value]) => [key, Number(value)]))
      );
      setSimulation(result);
    });
  };

  const onPatchEstimate = async (exportType) => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) return;

    if (exportType === true || exportType === "pdf") {
      setExportBusy(true);
      setGlobalError("");
      try {
        const { blob, filename } = await workspaceApi.exportEstimatePdf(token, estimate.id);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        setGlobalError(error.message);
      } finally {
        setExportBusy(false);
      }
      return;
    }

    if (exportType === "csv") {
      setExportBusy(true);
      setGlobalError("");
      try {
        const { blob, filename } = await workspaceApi.exportEstimateCsv(token, estimate.id);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        setGlobalError(error.message);
      } finally {
        setExportBusy(false);
      }
      return;
    }

    await withAction(setPatchBusy, async () => {
      const parsedAreaSqm = Number(editEstimate.areaSqm);
      await workspaceApi.updateEstimate(token, estimate.id, {
        ...editEstimate,
        ...(Number.isFinite(parsedAreaSqm) ? { areaSqm: parsedAreaSqm } : {}),
        wasteFactorPercent: Number(editEstimate.wasteFactorPercent),
        overheadPercent: Number(editEstimate.overheadPercent),
        profitPercent: Number(editEstimate.profitPercent),
        contingencyPercent: Number(editEstimate.contingencyPercent),
        items: editEstimate.items.map((item) => ({
          material: item.material,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          category: item.category,
          remarks: item.remarks || "",
          payItem: item.payItem || "",
          locked: item.locked || false,
          qtoFormula: item.qtoFormula || ""
        }))
      });
      await loadWorkspace();
    }, "Estimate saved.");
  };

  const onRefreshEstimateMarketPrices = async () => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) {
      return;
    }

    await withAction(setMarketRefreshBusy, async () => {
      const payload = await workspaceApi.refreshEstimateMarketPrices(token, estimate.id);
      const updatesByIndex = new Map((payload.updates || []).map((entry) => [entry.index, entry]));
      setEditEstimate({
        ...payload.estimate,
        items: withEstimateRowIds(payload.estimate.items).map((item, index) => {
          const update = updatesByIndex.get(index);
          return update
            ? {
                ...item,
                _priceRefresh: {
                  previousUnitPrice: estimate.items?.[index]?.unitPrice ?? item.unitPrice,
                  refreshedUnitPrice: update.unitPrice,
                  supplier: update.supplier || "",
                  rationale: update.rationale || ""
                }
              }
            : item;
        })
      });
      setMarketRefreshResult({
        estimateId: estimate.id,
        refreshedCount: payload.refreshedCount,
        summary: payload.summary,
        sources: payload.sources || [],
        updates: payload.updates || [],
        mode: payload.mode || "web-search"
      });
    }, "Live market prices applied to the draft.");
  };

  const onUpdateEstimateStatus = async (estimateId, status) => {
    await withAction(setStatusBusy, async () => {
      await workspaceApi.updateEstimateStatus(token, estimateId, status);
      await loadWorkspace();
    }, `Estimate marked as ${status}.`);
  };

  const onUploadDocument = async (event) => {
    event.preventDefault();
    const hasFiles = documentForm.files?.length > 0 || documentForm.file;
    if (!hasFiles) {
      setGlobalError("Choose a file before uploading.");
      return;
    }
    if (!documentForm.projectId && !documentForm.newProjectName?.trim()) {
      setGlobalError("Choose a project or enter a new project name.");
      return;
    }

    await withAction(setUploadBusy, async () => {
      // Auto-create project if none selected
      let projectId = documentForm.projectId;
      if (!projectId && documentForm.newProjectName?.trim()) {
        const created = await workspaceApi.createProject(token, {
          name: documentForm.newProjectName.trim(),
          location: "Philippines",
          areaSqm: documentForm.areaHint ? Number(documentForm.areaHint) : 0
        });
        projectId = created.id;
      }

      const files = documentForm.files?.length > 0 ? documentForm.files : [documentForm.file];
      if (files.length === 1) {
        // Single file — existing behaviour
        const contentBase64 = await toBase64(files[0]);
        await workspaceApi.uploadDocument(token, projectId, {
          filename: documentForm.filename || files[0].name,
          notes: documentForm.notes,
          ...(documentForm.areaHint ? { areaHint: Number(documentForm.areaHint) } : {}),
          docType: documentForm.docType || "architectural",
          contentBase64
        });
      } else {
        // Multiple files — encode all and send as array
        const encoded = await Promise.all(files.map(toBase64));
        const combinedName = files.map((f) => f.name).join(", ");
        await workspaceApi.uploadDocument(token, projectId, {
          filename: combinedName,
          notes: documentForm.notes,
          ...(documentForm.areaHint ? { areaHint: Number(documentForm.areaHint) } : {}),
          docType: documentForm.docType || "architectural",
          contentBase64: encoded,
          filenames: files.map((f) => f.name)
        });
      }
      setDocumentForm((current) => ({ ...documentDefaults, projectId: current.projectId }));
      await loadWorkspace();
    }, "Document uploaded.");
  };

  const onReviewDocument = async (documentId, nextDocument, commit) => {
    if (!commit) {
      setWorkspace((current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((entry) => (entry.id === documentId ? nextDocument : entry))
            }
          : current
      );
      return;
    }

    await withAction(setReviewBusy, async () => {
      const ex = nextDocument.extracted || {};
      let extracted;
      if (nextDocument.docType === "mep") {
        extracted = {
          pipes: ex.pipes || [],
          fixtures: ex.fixtures || [],
          valves: ex.valves || [],
          equipment: ex.equipment || []
        };
      } else if (nextDocument.docType === "civil") {
        extracted = {
          lotCount: Number(ex.lotCount) || 0,
          lotSizeSqm: Number(ex.lotSizeSqm) || 0,
          roadLengthM: Number(ex.roadLengthM) || 0,
          roadDetails: ex.roadDetails || [],
          drainagePipes: ex.drainagePipes || [],
          waterlinePipes: ex.waterlinePipes || [],
          otherInfrastructure: ex.otherInfrastructure || []
        };
      } else {
        extracted = {
          roomDimensions: ex.roomDimensions || [],
          wallLengths: Number(ex.wallLengths) || 0,
          floorAreas: Number(ex.floorAreas) || 0,
          structuralElements: ex.structuralElements || []
        };
      }
      await workspaceApi.reviewDocument(token, documentId, {
        extractionSummary: nextDocument.extractionSummary,
        reviewStatus: nextDocument.reviewStatus,
        extracted
      });
      await loadWorkspace();
    }, "Document review saved.");
  };

  const onResearchPricing = async (event) => {
    event.preventDefault();
    await withAction(() => {}, async () => {
      const result = await workspaceApi.researchPricing(token, researchForm);
      setPricingResult(result);
    });
  };

  const onResearchPricingDirect = async (payload) => {
    await withAction(() => {}, async () => {
      const result = await workspaceApi.researchPricing(token, payload);
      setPricingResult(result);
    });
  };

  const onBulkReprice = async (materialKeyword, newUnitPrice) => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) return null;
    let result = null;
    await withAction(setBulkRepriceBusy, async () => {
      result = await workspaceApi.bulkReprice(token, estimate.id, { materialKeyword, newUnitPrice: Number(newUnitPrice) });
      await loadWorkspace();
    }, `Bulk reprice applied to ${result?.matchCount || 0} rows.`);
    return result;
  };

  const onCreateSnapshot = async (label) => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) return;
    await withAction(setSnapshotBusy, async () => {
      await workspaceApi.createSnapshot(token, estimate.id, label);
      const payload = await workspaceApi.listSnapshots(token, estimate.id);
      setSnapshots(payload.snapshots || []);
    }, "Snapshot saved.");
  };

  const onCheckCompleteness = async () => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) return null;
    try {
      return await workspaceApi.checkCompleteness(token, estimate.id);
    } catch (_) {
      return null;
    }
  };

  const onExportSummaryPdf = async () => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) return;
    setExportBusy(true);
    setGlobalError("");
    try {
      const { blob, filename } = await workspaceApi.exportEstimateSummaryPdf(token, estimate.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setExportBusy(false);
    }
  };

  const onExportDpwhPdf = async () => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) return;
    setExportBusy(true);
    setGlobalError("");
    try {
      const { blob, filename } = await workspaceApi.exportDpwhBoqPdf(token, estimate.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setExportBusy(false);
    }
  };

  const onLoadSnapshots = async () => {
    const estimate = data?.estimates?.find((entry) => entry.id === selectedEstimateId);
    if (!estimate) return;
    try {
      const payload = await workspaceApi.listSnapshots(token, estimate.id);
      setSnapshots(payload.snapshots || []);
    } catch (_) {
      setSnapshots([]);
    }
  };

  const onFindSuppliersDirect = async (payload) => {
    await withAction(() => {}, async () => {
      const result = await workspaceApi.findSuppliers(token, payload);
      setSupplierResults(result.suppliers || []);
    });
  };

  const onFindSuppliers = async (event) => {
    event.preventDefault();
    await withAction(() => {}, async () => {
      const result = await workspaceApi.findSuppliers(token, supplierForm);
      setSupplierResults(result.suppliers || []);
    });
  };

  const onImportPricing = async (event) => {
    event.preventDefault();
    await withAction(setImportBusy, async () => {
      await workspaceApi.importPricingFeed(token, pricingImportForm);
      await loadWorkspace();
    }, "Pricing feed imported.");
  };

  const onImportRemotePricing = async (event) => {
    event.preventDefault();
    await withAction(setImportBusy, async () => {
      await workspaceApi.importRemotePricingFeed(token, remoteImportForm);
      await loadWorkspace();
    }, "Remote feed imported.");
  };

  const onChangePlan = async (plan) => {
    await withAction(setPlanBusy, async () => {
      await workspaceApi.updatePlan(token, plan);
      await loadWorkspace();
    }, `Plan switched to ${plan}.`);
  };

  useEffect(() => {
    if (!token || user?.role !== "Admin") {
      setAuditLogs([]);
      return;
    }

    workspaceApi.listAuditLogs(token)
      .then((payload) => setAuditLogs(payload.logs || []))
      .catch(() => setAuditLogs([]));
  }, [token, user?.role, workspace?.company?.plan, workspace?.projects?.length, workspace?.documents?.length, workspace?.estimates?.length]);

  return {
    data,
    loadingWorkspace,
    auditLogs,
    loadWorkspace,
    forms: {
      projectForm,
      setProjectForm,
      templateForm,
      setTemplateForm,
      materialForm,
      setMaterialForm,
      accountForm,
      setAccountForm,
      estimateForm,
      setEstimateForm,
      documentForm,
      setDocumentForm,
      researchForm,
      setResearchForm,
      supplierForm,
      setSupplierForm,
      pricingImportForm,
      setPricingImportForm,
      remoteImportForm,
      setRemoteImportForm,
      simulationForm,
      setSimulationForm,
      editEstimate,
      setEditEstimate,
      selectedEstimateId,
      setSelectedEstimateId,
      currentProjectId,
      setCurrentProjectId: onSelectCurrentProject
    },
    results: {
      simulation,
      pricingResult,
      supplierResults,
      lastGeneratedEstimateId,
      marketRefreshResult,
      snapshots
    },
    busy: {
      createBusy,
      updateBusy,
      generateBusy,
      patchBusy,
      uploadBusy,
      reviewBusy,
      materialBusy,
      templateBusy,
      promptTemplateBusy,
      marketRefreshBusy,
      statusBusy,
      importBusy,
      planBusy,
      exportBusy,
      accountBusy,
      docBusy,
      refineBusy,
      bulkRepriceBusy,
      snapshotBusy
    },
    actions: {
      onCreateProject,
      onUpdateProject,
      onDeleteProject,
      onDeleteDocument,
      onDeleteEstimate,
      onCreateTemplate,
      onCreateMaterial,
      onCreateMaterialInline,
      onGenerateEstimate,
      onCreatePromptTemplate,
      onUpdatePromptTemplate,
      onDeletePromptTemplate,
      onSimulate,
      onPatchEstimate,
      onRefreshEstimateMarketPrices,
      onUpdateEstimateStatus,
      onUploadDocument,
      onReviewDocument,
      onResearchPricing,
      onFindSuppliers,
      onImportPricing,
      onImportRemotePricing,
      onChangePlan,
      onUpdateAccount,
      onGenerateFromDocument,
      onGenerateWithPrompt,
      onUpdateMaterial,
      onResearchPricingDirect,
      onFindSuppliersDirect,
      onBulkReprice,
      onCreateSnapshot,
      onLoadSnapshots,
      onCheckCompleteness,
      onExportSummaryPdf,
      onExportDpwhPdf
    }
  };
}
