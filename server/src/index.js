import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { config } from "./config.js";
import { store } from "./store.js";
import { authMiddleware, authorize, forgotPassword, login, register } from "./auth.js";
import { analyzeBlueprint, analyzeDocumentForBOQ, checkBoqCompleteness, generateEstimate, recalculateEstimate, refineEstimateBOQ, simulatePricing } from "./ai.js";
import {
  analyzeBlueprintWithProvider,
  analyzeCivilWithProvider,
  analyzeMEPWithProvider,
  canUseOpenAIWebSearch,
  generateEstimateWithProvider,
  getTokenUsage,
  refreshEstimatePricesWithWebSearch,
  researchMaterialPricesWithAI,
  runAgentPlan,
  shouldUseManagedAI
} from "./ai-provider.js";
import { buildPriceAlerts, researchPrices, supplierFinder } from "./pricing.js";
import { importPricingFeed, importRemotePricingFeed } from "./pricing-provider.js";
import { buildEstimatePdf, buildEstimateSummaryPdf, buildDpwhBoqPdf } from "./pdf.js";
import { extractUploadText, extractUploadContent, extractCivilSignals, extractCivilSignalsFromDXF, persistProjectDocument, persistProjectFile, extractProjectFileText } from "./files.js";
import { recordAudit } from "./audit.js";
import { buildPlanUsage, getPlanRule } from "./plans.js";
import { getExchangeRates } from "./exchange-rates.js";

const here = dirname(fileURLToPath(import.meta.url));
const clientDistDir = resolve(here, "../../client/dist");

export const createApp = async () => {
  const app = express();
  const preferenceSchema = z.object({
    currencyCode: z.enum(["USD", "EUR", "GBP", "PHP", "AED"]).optional(),
    themeMode: z.enum(["system", "dark", "light"]).optional()
  });

  await store.init();

  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "120mb" }));
  app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs
      })
    );
  });

  next();
  });

  app.get("/api/token-usage", authMiddleware, (_req, res) => {
    res.json(getTokenUsage());
  });

  app.get("/api/health", async (_req, res) => {
  const auditLogs = await store.list("auditLogs");
  res.json({
    ok: true,
    demoMode: config.demoMode,
    storageMode: store.mode,
    maxUploadBytes: config.maxUploadBytes,
    auditLogEntries: auditLogs.length,
    aiProvider: config.aiProvider
  });
  });

  app.get("/api/reference-data/exchange-rates", async (_req, res, next) => {
  try {
    res.json(await getExchangeRates());
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/auth/register", async (req, res, next) => {
  try {
    await register(req, res);
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/auth/login", async (req, res, next) => {
  try {
    await login(req, res);
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    await forgotPassword(req, res);
  } catch (error) {
    next(error);
  }
  });

  app.patch("/api/account", authMiddleware, async (req, res, next) => {
  try {
    const payload = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      password: z.string().min(8).optional(),
      companyName: z.string().min(2).optional(),
      preferences: preferenceSchema.optional()
    }).parse(req.body);

    const userPatch = {};

    if (payload.name) {
      userPatch.name = payload.name.trim();
    }

    if (payload.email) {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const existing = await store.find(
        "users",
        (entry) => entry.email.trim().toLowerCase() === normalizedEmail && entry.id !== req.user.id
      );

      if (existing) {
        return res.status(409).json({ message: "Email already exists" });
      }

      userPatch.email = normalizedEmail;
    }

    if (payload.password) {
      userPatch.passwordHash = await bcrypt.hash(payload.password, 10);
    }

    if (payload.preferences) {
      userPatch.profileSettings = {
        ...(req.user.profileSettings || {}),
        ...payload.preferences
      };
    }

    const updatedUser = Object.keys(userPatch).length
      ? await store.update("users", req.user.id, userPatch)
      : await store.find("users", (entry) => entry.id === req.user.id);

    let updatedCompany = await store.find("companies", (entry) => entry.id === req.user.companyId);

    if (payload.companyName) {
      if (req.user.role !== "Admin") {
        return res.status(403).json({ message: "Only admins can update company settings." });
      }

      updatedCompany = await store.update("companies", req.user.companyId, {
        name: payload.companyName.trim()
      });
    }

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "account.update",
      entityType: "user",
      entityId: req.user.id,
      details: {
        nameUpdated: Boolean(payload.name),
        emailUpdated: Boolean(payload.email),
        passwordUpdated: Boolean(payload.password),
        companyNameUpdated: Boolean(payload.companyName),
        preferencesUpdated: Boolean(payload.preferences)
      }
    });

    return res.json({
      user: {
        ...updatedUser,
        passwordHash: undefined
      },
      company: updatedCompany
    });
  } catch (error) {
    next(error);
  }
  });

  app.get("/api/bootstrap", authMiddleware, async (req, res, next) => {
  try {
    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    const projects = await store.list("projects", (entry) => entry.companyId === req.user.companyId);
    const documents = await store.list("documents", (entry) => entry.companyId === req.user.companyId);
    const estimates = await store.list("estimates", (entry) => entry.companyId === req.user.companyId);
    const materials = await store.list("materials", (entry) => entry.companyId === req.user.companyId);
    const templates = await store.list("estimateTemplates", (entry) => entry.companyId === req.user.companyId);
    const promptTemplates = await store.list("promptTemplates", (entry) => entry.companyId === req.user.companyId);
    const team = (await store.list("users", (entry) => entry.companyId === req.user.companyId)).map((user) => ({
      ...user,
      passwordHash: undefined
    }));
    const averageProjectValue = estimates.length
      ? Math.round(estimates.reduce((sum, estimate) => sum + estimate.finalContractPrice, 0) / estimates.length)
      : 0;
    const planUsage = buildPlanUsage({
      plan: company?.plan || "Starter",
      projectsCount: projects.length
    });

    res.json({
      company,
      user: { ...req.user, passwordHash: undefined },
      stats: {
        totalProjects: projects.length,
        totalDocuments: documents.length,
        totalEstimates: estimates.length,
        averageProjectValue
      },
      projects,
      documents,
      estimates,
      materials,
      templates,
      promptTemplates,
      team,
      alerts: await buildPriceAlerts(store, req.user.companyId),
      subscriptions: await store.list("subscriptions"),
      planUsage,
      tokenUsage: getTokenUsage(),
      aiProvider: config.aiProvider
    });
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/projects", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      name: z.string().min(2),
      location: z.string().optional().default(""),
      description: z.string().optional().default(""),
      areaSqm: z.number().nonnegative().optional().default(0)
    }).parse(req.body);

    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    const projects = await store.list("projects", (entry) => entry.companyId === req.user.companyId);
    const planRule = getPlanRule(company?.plan);

    if (planRule.maxProjects !== null && projects.length >= planRule.maxProjects) {
      return res.status(403).json({ message: `Project limit reached for the ${company.plan} plan.` });
    }

    const project = await store.insert("projects", {
      ...payload,
      companyId: req.user.companyId,
      status: "Estimating",
      createdAt: new Date().toISOString(),
      blueprintSummary: analyzeBlueprint({ filename: `${payload.name}.pdf`, areaHint: payload.areaSqm }).extracted
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      details: { name: project.name, location: project.location }
    });

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

  app.patch("/api/projects/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      name: z.string().min(2).optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["Estimating", "Submitted", "Won", "Lost"]).optional(),
      areaSqm: z.number().nonnegative().optional()
    }).parse(req.body);

    const current = await store.find(
      "projects",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!current) {
      return res.status(404).json({ message: "Project not found" });
    }

    const updated = await store.update("projects", req.params.id, payload);
    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "project.update",
      entityType: "project",
      entityId: updated.id,
      details: payload
    });
    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

  app.delete("/api/projects/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const existing = await store.find(
      "projects",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!existing) {
      return res.status(404).json({ message: "Project not found" });
    }

    await store.delete("projects", existing.id);
    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "project.delete",
      entityType: "project",
      entityId: existing.id,
      details: { name: existing.name }
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/templates", authMiddleware, authorize("Admin"), async (req, res, next) => {
  try {
    const payload = z.object({
      name: z.string().min(2),
      overheadPercent: z.number().min(0),
      profitPercent: z.number().min(0),
      contingencyPercent: z.number().min(0)
    }).parse(req.body);

    const template = await store.insert("estimateTemplates", {
      companyId: req.user.companyId,
      ...payload
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "template.create",
      entityType: "estimateTemplate",
      entityId: template.id,
      details: payload
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

app.post("/api/materials", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      name: z.string().min(2),
      unit: z.string().min(1),
      averagePrice: z.number().nonnegative(),
      lastMonthPrice: z.number().nonnegative(),
      trend: z.enum(["Rising", "Stable", "Falling"]),
      suppliers: z.array(z.string().min(2)).default([])
    }).parse(req.body);

    const material = await store.insert("materials", {
      companyId: req.user.companyId,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "material.create",
      entityType: "material",
      entityId: material.id,
      details: { name: material.name, trend: material.trend }
    });

    res.status(201).json(material);
  } catch (error) {
    next(error);
  }
});

  app.patch("/api/materials/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      averagePrice: z.number().nonnegative().optional(),
      lastMonthPrice: z.number().nonnegative().optional(),
      trend: z.enum(["Rising", "Stable", "Falling"]).optional(),
      suppliers: z.array(z.string().min(2)).optional()
    }).parse(req.body);

    const current = await store.find(
      "materials",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!current) {
      return res.status(404).json({ message: "Material not found" });
    }

    const updated = await store.update("materials", req.params.id, {
      ...payload,
      updatedAt: new Date().toISOString()
    });
    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "material.update",
      entityType: "material",
      entityId: updated.id,
      details: payload
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

  app.post("/api/ai/blueprint", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      filename: z.string().default("plan.pdf"),
      notes: z.string().optional(),
      areaHint: z.number().positive().optional(),
      contentBase64: z.string().optional()
    }).parse(req.body);

    res.json(
      await analyzeBlueprintWithProvider({
        ...payload,
        extractedText: await extractUploadText(payload)
      })
    );
  } catch (error) {
    next(error);
  }
});

// ── Project File Library ─────────────────────────────────────────────────────
// Upload a file to the project library (any file type — PDF, DXF, image, Excel, Word, PPT…)
app.post("/api/projects/:id/files", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      filename: z.string().min(1),
      mimeType: z.string().optional().default("application/octet-stream"),
      sizeBytes: z.number().optional().default(0),
      contentBase64: z.string()
    }).parse(req.body);

    const project = await store.find(
      "projects",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!project) return res.status(404).json({ message: "Project not found" });

    const storedPath = await persistProjectFile({
      companyId: req.user.companyId,
      filename: payload.filename,
      contentBase64: payload.contentBase64
    });

    // Best-effort text extraction for AI context
    const extractedText = await extractProjectFileText(storedPath, payload.filename);

    const file = await store.insert("projectFiles", {
      companyId: req.user.companyId,
      projectId: project.id,
      filename: payload.filename,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
      storedPath,
      extractedText: extractedText || null,
      uploadedAt: new Date().toISOString()
    });

    res.status(201).json(file);
  } catch (error) {
    next(error);
  }
});

// List files for a project
app.get("/api/projects/:id/files", authMiddleware, async (req, res, next) => {
  try {
    const project = await store.find(
      "projects",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!project) return res.status(404).json({ message: "Project not found" });

    const files = await store.list(
      "projectFiles",
      (entry) => entry.projectId === req.params.id && entry.companyId === req.user.companyId
    );
    res.json(files.map((f) => ({ id: f.id, filename: f.filename, mimeType: f.mimeType, sizeBytes: f.sizeBytes, uploadedAt: f.uploadedAt })));
  } catch (error) {
    next(error);
  }
});

// Attach a file to the project library from an existing document
app.post("/api/projects/:id/files/from-document", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const { documentId } = z.object({ documentId: z.string().min(1) }).parse(req.body);

    const project = await store.find(
      "projects",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!project) return res.status(404).json({ message: "Project not found" });

    const doc = await store.find(
      "documents",
      (entry) => entry.id === documentId && entry.companyId === req.user.companyId
    );
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Read the stored document file and re-persist as a project file
    const buffer = await import("node:fs/promises").then(m => m.readFile(doc.storedPath));
    const contentBase64 = buffer.toString("base64");

    const storedPath = await persistProjectFile({
      companyId: req.user.companyId,
      filename: doc.filename,
      contentBase64
    });

    const extractedText = await extractProjectFileText(storedPath, doc.filename);

    const mimeType = doc.filename.endsWith(".pdf") ? "application/pdf"
      : doc.filename.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? `image/${doc.filename.split(".").pop().toLowerCase()}`
      : "application/octet-stream";

    const file = await store.insert("projectFiles", {
      companyId: req.user.companyId,
      projectId: project.id,
      filename: doc.filename,
      mimeType,
      sizeBytes: buffer.byteLength,
      storedPath,
      extractedText: extractedText || null,
      uploadedAt: new Date().toISOString()
    });

    res.status(201).json({ id: file.id, filename: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes, uploadedAt: file.uploadedAt });
  } catch (error) {
    next(error);
  }
});

// Delete a project file
app.delete("/api/projects/:id/files/:fileId", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const file = await store.find(
      "projectFiles",
      (entry) => entry.id === req.params.fileId && entry.projectId === req.params.id && entry.companyId === req.user.companyId
    );
    if (!file) return res.status(404).json({ message: "File not found" });
    await store.delete("projectFiles", file.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Promote a project file into the Documents review queue for AI analysis
app.post("/api/projects/:id/files/:fileId/promote", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const { docType } = z.object({ docType: z.enum(["architectural", "mep", "civil"]).default("architectural") }).parse(req.body);

    const project = await store.find("projects", (e) => e.id === req.params.id && e.companyId === req.user.companyId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const file = await store.find("projectFiles", (e) => e.id === req.params.fileId && e.projectId === req.params.id && e.companyId === req.user.companyId);
    if (!file) return res.status(404).json({ message: "File not found" });

    // Re-persist the file as a document (separate stored copy)
    const buffer = await import("node:fs/promises").then(m => m.readFile(file.storedPath));
    const contentBase64 = buffer.toString("base64");
    const storedPath = await persistProjectDocument({ companyId: req.user.companyId, filename: file.filename, contentBase64 });

    // Use the already-extracted text from the project file as the summary
    const document = await store.insert("documents", {
      companyId: req.user.companyId,
      projectId: project.id,
      filename: file.filename,
      storedPath,
      notes: file.extractedText || "",
      areaHint: project.areaSqm,
      docType,
      extractionSummary: file.extractedText ? file.extractedText.slice(0, 500) : null,
      extracted: {},
      boq: [],
      reviewStatus: "Pending",
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ id: document.id, filename: document.filename, reviewStatus: document.reviewStatus });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/documents", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      filename: z.string().min(1),
      notes: z.string().optional().default(""),
      areaHint: z.number().positive().optional(),
      contentBase64: z.union([z.string(), z.array(z.string())]).optional(),
      filenames: z.array(z.string()).optional(),
      docType: z.enum(["architectural", "mep", "civil"]).default("architectural")
    }).parse(req.body);

    const project = await store.find(
      "projects",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Handle multiple files — extract and merge signals from each
    const contentArray = Array.isArray(payload.contentBase64)
      ? payload.contentBase64
      : payload.contentBase64 ? [payload.contentBase64] : [];
    const filenameArray = payload.filenames || [payload.filename];

    const decodedBytes = contentArray.reduce((total, entry) => {
      const sanitized = String(entry || "").replace(/\s+/g, "");
      if (!sanitized) {
        return total;
      }

      const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
      return total + Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
    }, 0);

    if (decodedBytes > config.maxUploadBytes) {
      return res.status(413).json({
        message: `Upload exceeds limit of ${config.maxUploadBytes} bytes.`
      });
    }

    // For the primary content (used by blueprint/MEP analysis), use the first file
    const primaryPayload = { ...payload, contentBase64: contentArray[0] };
    const { text: extractedText, images: extractedImages, isDxf } = await extractUploadContent(primaryPayload);

    // For civil docs, extract signals deterministically before calling AI.
    // DXF gives exact geometry; PDF falls back to symbol counting from text.
    // Multiple DXFs: extract from each and merge counts.
    let civilSignals = null;
    if (payload.docType === "civil") {
      // Extract signals from every uploaded file (PDF or DXF), then merge.
      // This supports mixed uploads: e.g. one PDF (symbol counts) + one or more DXFs (geometry).
      const allSignals = await Promise.all(
        contentArray.map(async (b64, i) => {
          const fname = filenameArray[i] || payload.filename;
          const { text, isDxf: isThisDxf } = await extractUploadContent({ ...payload, filename: fname, contentBase64: b64 });
          if (isThisDxf) return extractCivilSignalsFromDXF(text);
          if (text) return extractCivilSignals(text);
          return null;
        })
      );
      const valid = allSignals.filter(Boolean);
      if (valid.length > 0) {
        // Merge strategy:
        // - Symbol counts (FH, G, CB, MH, SM): take the MAX across files — PDF has the real counts,
        //   DXF blocks are usually 0 (symbols drawn as geometry). Max avoids double-counting.
        // - Road / pipe lengths: prefer DXF values (exact geometry) over PDF stationing estimates.
        //   Concat pipe arrays so all layers from all files appear.
        const dxfSignals = valid.filter(s => s.source === "dxf");
        const pdfSignals = valid.filter(s => s.source !== "dxf");
        const symbolSource = pdfSignals.length > 0 ? pdfSignals : dxfSignals;
        civilSignals = {
          source: dxfSignals.length > 0 ? "dxf+pdf" : "pdf",
          fireHydrants:   Math.max(...symbolSource.map(s => s.fireHydrants  || 0)),
          gateValves:     Math.max(...symbolSource.map(s => s.gateValves    || 0)),
          blowOffValves:  Math.max(...symbolSource.map(s => s.blowOffValves || 0)),
          catchBasins:    Math.max(...symbolSource.map(s => s.catchBasins   || 0)),
          manholes:       Math.max(...symbolSource.map(s => s.manholes      || 0)),
          sewerManholes:  Math.max(...symbolSource.map(s => s.sewerManholes || 0)),
          // Road length: prefer DXF (geometry) over PDF (stationing estimate)
          totalRoadLengthM: dxfSignals.length > 0
            ? Math.max(...dxfSignals.map(s => s.totalRoadLengthM || 0))
            : Math.max(...pdfSignals.map(s => s.totalRoadLengthM || 0)),
          // Deduplicate pipe entries by their size label — keep the one with the largest length.
          // Entry format from files.js: "100mm PVC waterline: 2952m" or "Waterline pipe (size TBC): 2952m"
          waterlinePipes: (() => {
            const bySizeKey = {};
            valid.flatMap(s => s.waterlinePipes || []).forEach(entry => {
              const sizeMatch = entry.match(/^([^:]+):/);
              const lenMatch  = entry.match(/:?\s*(\d+(?:\.\d+)?)m$/);
              const key = sizeMatch ? sizeMatch[1].trim().toLowerCase() : entry;
              const len = lenMatch ? Number(lenMatch[1]) : 0;
              if (!bySizeKey[key] || len > bySizeKey[key].len) {
                bySizeKey[key] = { entry, len };
              }
            });
            return Object.values(bySizeKey).map(v => v.entry);
          })(),
          drainagePipes: (() => {
            const bySizeKey = {};
            valid.flatMap(s => s.drainagePipes || []).forEach(entry => {
              const sizeMatch = entry.match(/^([^:]+):/);
              const lenMatch  = entry.match(/:?\s*(\d+(?:\.\d+)?)m$/);
              const key = sizeMatch ? sizeMatch[1].trim().toLowerCase() : entry;
              const len = lenMatch ? Number(lenMatch[1]) : 0;
              if (!bySizeKey[key] || len > bySizeKey[key].len) {
                bySizeKey[key] = { entry, len };
              }
            });
            return Object.values(bySizeKey).map(v => v.entry);
          })(),
          allBlocks:      valid.flatMap(s => s.allBlocks      || []),
          layerSummary:   valid.flatMap(s => s.layerSummary   || [])
        };
      }
    }

    const analyzeDoc = payload.docType === "mep" ? analyzeMEPWithProvider : payload.docType === "civil" ? analyzeCivilWithProvider : analyzeBlueprintWithProvider;
    const analysis = await analyzeDoc({
      ...payload,
      extractedText,
      images: extractedImages,
      civilSignals
    });
    const storedPath = await persistProjectDocument({
      companyId: req.user.companyId,
      filename: payload.filename,
      contentBase64: contentArray[0],
      notes: payload.notes
    });

    const document = await store.insert("documents", {
      companyId: req.user.companyId,
      projectId: project.id,
      filename: payload.filename,
      storedPath,
      notes: payload.notes,
      areaHint: payload.areaHint || project.areaSqm,
      docType: payload.docType,
      extractionSummary: analysis.summary,
      extracted: analysis.extracted,
      boq: analysis.boq,
      reviewStatus: "Pending",
      createdAt: new Date().toISOString()
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "document.upload",
      entityType: "document",
      entityId: document.id,
      details: { projectId: project.id, filename: document.filename, aiProvider: config.aiProvider }
    });

    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/documents/:id/review", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const architecturalExtracted = z.object({
      roomDimensions: z.array(z.string()),
      wallLengths: z.number().nonnegative(),
      floorAreas: z.number().nonnegative(),
      structuralElements: z.array(z.string())
    });
    const mepExtracted = z.object({
      pipes: z.array(z.string()),
      fixtures: z.array(z.string()),
      valves: z.array(z.string()),
      equipment: z.array(z.string())
    });
    const civilExtracted = z.object({
      lotCount: z.number().nonnegative(),
      lotSizeSqm: z.number().nonnegative(),
      roadLengthM: z.number().nonnegative(),
      roadDetails: z.array(z.string()),
      drainagePipes: z.array(z.string()),
      waterlinePipes: z.array(z.string()),
      otherInfrastructure: z.array(z.string())
    });
    const payload = z.object({
      extractionSummary: z.string().min(10),
      extracted: z.union([architecturalExtracted, mepExtracted, civilExtracted]),
      reviewStatus: z.enum(["Pending", "Reviewed", "Approved"])
    }).parse(req.body);

    const current = await store.find(
      "documents",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!current) {
      return res.status(404).json({ message: "Document not found" });
    }

    const updated = await store.update("documents", req.params.id, payload);
    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "document.review",
      entityType: "document",
      entityId: updated.id,
      details: { reviewStatus: updated.reviewStatus }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

  app.delete("/api/documents/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const existing = await store.find(
      "documents",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!existing) {
      return res.status(404).json({ message: "Document not found" });
    }

    await store.delete("documents", existing.id);
    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "document.delete",
      entityType: "document",
      entityId: existing.id,
      details: { filename: existing.filename }
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/ai/estimate", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      prompt: z.string().min(10),
      projectId: z.string().optional(),
      templateId: z.string().optional(),
      discipline: z.string().optional(),
      documentId: z.string().optional()
    }).parse(req.body);

    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    const planRule = getPlanRule(company?.plan);

    if (!planRule.aiEstimates) {
      return res.status(403).json({ message: `AI estimate generation requires the Pro plan or higher.` });
    }

    const template =
      (payload.templateId
        ? await store.find(
            "estimateTemplates",
            (entry) => entry.id === payload.templateId && entry.companyId === req.user.companyId
          )
        : undefined) ||
      (await store.find("estimateTemplates", (entry) => entry.companyId === req.user.companyId));

    if (!template) {
      return res.status(400).json({ message: "No estimate template available for this company." });
    }

    const materials = await store.list("materials", (entry) => entry.companyId === req.user.companyId);
    const defaultProject = await store.find("projects", (entry) => entry.companyId === req.user.companyId);
    const projectId = payload.projectId || defaultProject?.id;

    if (payload.projectId) {
      const project = await store.find(
        "projects",
        (entry) => entry.id === payload.projectId && entry.companyId === req.user.companyId
      );

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
    }

    // Build project file context for AI — list filenames + extracted text from library
    let projectFileContext = "";
    if (projectId) {
      const projectFiles = await store.list(
        "projectFiles",
        (entry) => entry.projectId === projectId && entry.companyId === req.user.companyId
      );
      if (projectFiles.length > 0) {
        const lines = projectFiles.map((f) =>
          f.extractedText
            ? `- ${f.filename} (${f.mimeType}): ${f.extractedText.slice(0, 800)}`
            : `- ${f.filename} (${f.mimeType})`
        );
        projectFileContext = `\n\nProject file library (${projectFiles.length} attached files):\n${lines.join("\n")}`;
      }
    }

    const enrichedPrompt = payload.prompt + projectFileContext;

      const estimate = shouldUseManagedAI()
        ? await generateEstimateWithProvider({
            prompt: enrichedPrompt,
            materials,
            template,
            discipline: payload.discipline || ""
        })
      : generateEstimate({
          prompt: enrichedPrompt,
          materials,
          template,
          discipline: payload.discipline || ""
        });

    // Deduplicate BOQ items: merge rows with identical (material, unit, category)
    // keeping the one with the highest quantity. This prevents the same pipe or
    // fitting from appearing multiple times when the AI repeats profile items.
    const dedupedItems = (() => {
      const seen = new Map();
      const order = [];
      for (const item of estimate.items || []) {
        const key = `${(item.material || "").toLowerCase().trim()}||${(item.unit || "").toLowerCase().trim()}||${item.category}`;
        if (seen.has(key)) {
          const existing = seen.get(key);
          if ((Number(item.quantity) || 0) > (Number(existing.quantity) || 0)) {
            seen.set(key, item);
          }
        } else {
          seen.set(key, item);
          order.push(key);
        }
      }
      return order.map((k) => seen.get(k));
    })();

    const saved = await store.insert("estimates", {
      companyId: req.user.companyId,
      projectId,
      documentId: payload.documentId || null,
      discipline: payload.discipline || "",
      prompt: payload.prompt,
      createdAt: new Date().toISOString(),
      ...estimate,
      items: dedupedItems
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "estimate.generate",
      entityType: "estimate",
      entityId: saved.id,
      details: { projectId, templateId: template.id, aiProvider: config.aiProvider }
    });

    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

  app.post("/api/ai/analyze-document", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
    try {
      const payload = z.object({
        text: z.string().min(5),
        areaHint: z.number().optional(),
        discipline: z.string().optional(),
        templateId: z.string().optional()
      }).parse(req.body);

      const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
      const planRule = getPlanRule(company?.plan);
      if (!planRule.aiEstimates) {
        return res.status(403).json({ message: "AI document analysis requires the Pro plan or higher." });
      }

      const materials = await store.list("materials", (entry) => entry.companyId === req.user.companyId);
      const template =
        (payload.templateId
          ? await store.find("estimateTemplates", (entry) => entry.id === payload.templateId && entry.companyId === req.user.companyId)
          : undefined) ||
        (await store.find("estimateTemplates", (entry) => entry.companyId === req.user.companyId));

      if (!template) {
        return res.status(400).json({ message: "No estimate template available." });
      }

      const promptText = payload.areaHint ? `${payload.text} (area: ${payload.areaHint} sqm)` : payload.text;
      const result = analyzeDocumentForBOQ({ text: promptText, materials, template, discipline: payload.discipline || "" });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/refine-estimate", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
    try {
      const payload = z.object({
        items: z.array(z.object({}).passthrough()).min(1),
        instruction: z.string().min(3),
        areaHint: z.number().optional()
      }).parse(req.body);

      const materials = await store.list("materials", (entry) => entry.companyId === req.user.companyId);
      const result = refineEstimateBOQ({ items: payload.items, instruction: payload.instruction, materials, areaHint: payload.areaHint });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/agent", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
    try {
      const payload = z.object({
        message: z.string().min(2),
        context: z.object({
          currentEstimate: z.object({}).passthrough().optional(),
          itemCount: z.number().optional(),
          boqSample: z.array(z.object({}).passthrough()).optional(),
          projects: z.array(z.object({}).passthrough()).optional(),
          documentCount: z.number().optional()
        }).optional().default({})
      }).parse(req.body);

      const result = await runAgentPlan({ message: payload.message, context: payload.context });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/pricing/research", authMiddleware, async (req, res, next) => {
  try {
    const payload = z.object({
      material: z.string().min(2),
      location: z.string().optional()
    }).parse(req.body);

    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    const planRule = getPlanRule(company?.plan);

    if (!planRule.supplierComparison) {
      return res.status(403).json({ message: `Supplier comparison requires the Pro plan or higher.` });
    }

    const localResult = await researchPrices(payload, store);
    if (localResult.suppliers?.length) {
      res.json(localResult);
    } else {
      const aiResult = await researchMaterialPricesWithAI(payload);
      res.json(aiResult);
    }
  } catch (error) {
    next(error);
  }
});

  app.post("/api/pricing/suppliers", authMiddleware, async (req, res, next) => {
  try {
    const payload = z.object({
      location: z.string().optional(),
      material: z.string().optional()
    }).parse(req.body);

    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    const planRule = getPlanRule(company?.plan);

    if (!planRule.supplierComparison) {
      return res.status(403).json({ message: `Supplier comparison requires the Pro plan or higher.` });
    }

    res.json({
      suppliers: await supplierFinder(payload, store)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/estimates/simulate", authMiddleware, (req, res, next) => {
  try {
    const payload = z.object({
      directCost: z.number().positive(),
      overheadPercent: z.number().min(0),
      profitPercent: z.number().min(0),
      contingencyPercent: z.number().min(0)
    }).parse(req.body);

    res.json(simulatePricing(payload));
  } catch (error) {
    next(error);
  }
});

app.post("/api/estimates/:id/refresh-market-prices", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    const planRule = getPlanRule(company?.plan);

    if (!planRule.supplierComparison) {
      return res.status(403).json({ message: `Live market refresh requires the Pro plan or higher.` });
    }

    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!estimate) {
      return res.status(404).json({ message: "Estimate not found" });
    }

    const project = estimate.projectId
      ? await store.find(
          "projects",
          (entry) => entry.id === estimate.projectId && entry.companyId === req.user.companyId
        )
      : null;
    const refreshLocation = estimate.location || project?.location || "Metro Manila";

    const refreshResult = await (canUseOpenAIWebSearch()
      ? refreshEstimatePricesWithWebSearch({
          estimate,
          location: refreshLocation
        })
      : (() => {
          const updates = [];
          const sources = [];

          return Promise.all(
            estimate.items.map(async (item, index) => {
              if (item.category !== "Materials") {
                return;
              }

              const research = await researchPrices({ material: item.material, location: refreshLocation }, store);
              if (!research?.bestSupplier?.price || Number(research.bestSupplier.price) <= 0) {
                return;
              }

              updates.push({
                index,
                unitPrice: Number(research.bestSupplier.price),
                supplier: research.bestSupplier.supplier,
                rationale: `Best catalog source in ${research.location}`
              });

              if (research.bestSupplier.source || research.bestSupplier.supplier) {
                sources.push({
                  title: `${research.bestSupplier.supplier} / ${item.material}`,
                  url: "",
                  siteName: research.bestSupplier.source || "Workspace catalog"
                });
              }
            })
          ).then(() => ({
            summary: updates.length
              ? "Applied the best matching supplier prices from your workspace pricing data."
              : "No matching supplier pricing records were found for this estimate yet.",
            updates,
            sources,
            mode: "catalog"
          }));
        })());

    const updatesByIndex = new Map(
      refreshResult.updates
        .filter((entry) => Number.isInteger(entry.index) && estimate.items[entry.index])
        .map((entry) => [entry.index, entry])
    );

    const refreshedItems = estimate.items.map((item, index) => {
      const update = updatesByIndex.get(index);
      return update
        ? {
            ...item,
            unitPrice: Number(update.unitPrice)
          }
        : item;
    });

    const recalculated = recalculateEstimate({
      ...estimate,
      items: refreshedItems
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "estimate.market_refresh",
      entityType: "estimate",
      entityId: estimate.id,
      details: {
        refreshedCount: updatesByIndex.size,
        sourceCount: refreshResult.sources.length,
        mode: refreshResult.mode || "web-search"
      }
    });

    res.json({
      estimate: recalculated,
      refreshedCount: updatesByIndex.size,
      summary: refreshResult.summary,
      sources: refreshResult.sources,
      updates: refreshResult.updates,
      mode: refreshResult.mode || "web-search"
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/estimates/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      location: z.string().optional(),
      areaSqm: z.number().nonnegative().optional(),
      wasteFactorPercent: z.number().min(0),
      overheadPercent: z.number().min(0),
      profitPercent: z.number().min(0),
      contingencyPercent: z.number().min(0),
      items: z.array(
        z.object({
          material: z.string().min(1),
          quantity: z.number().nonnegative(),
          unit: z.string().min(1),
          unitPrice: z.number().nonnegative(),
          category: z.enum(["Materials", "Labor", "Equipment"]),
          remarks: z.string().optional().default(""),
          payItem: z.string().optional().default(""),
          locked: z.boolean().optional().default(false),
          qtoFormula: z.string().optional().default("")
        })
      )
    }).parse(req.body);

    const current = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!current) {
      return res.status(404).json({ message: "Estimate not found" });
    }

    if (current.status === "Approved" && req.user.role !== "Admin") {
      return res.status(403).json({ message: "Approved estimates can only be edited by admins." });
    }

    const recalculated = recalculateEstimate({
      ...current,
      ...payload,
      updatedAt: new Date().toISOString()
    });

    const updated = await store.update("estimates", req.params.id, recalculated);
    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "estimate.update",
      entityType: "estimate",
      entityId: updated.id,
      details: {
        itemCount: updated.items.length,
        overheadPercent: updated.overheadPercent,
        profitPercent: updated.profitPercent,
        contingencyPercent: updated.contingencyPercent
      }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/estimates/:id/status", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      status: z.enum(["Draft", "Reviewed", "Approved"])
    }).parse(req.body);

    const current = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!current) {
      return res.status(404).json({ message: "Estimate not found" });
    }

    if (payload.status === "Approved" && req.user.role !== "Admin") {
      return res.status(403).json({ message: "Only admins can approve estimates." });
    }

    if (current.status === "Approved" && payload.status !== "Approved" && req.user.role !== "Admin") {
      return res.status(403).json({ message: "Only admins can reopen approved estimates." });
    }

    const now = new Date().toISOString();
    const patch = {
      status: payload.status,
      updatedAt: now
    };

    if (payload.status === "Reviewed") {
      patch.reviewedAt = current.reviewedAt || now;
      patch.approvedAt = null;
      patch.approvedByUserId = null;
    }

    if (payload.status === "Approved") {
      patch.reviewedAt = current.reviewedAt || now;
      patch.approvedAt = now;
      patch.approvedByUserId = req.user.id;
    }

    if (payload.status === "Draft") {
      patch.approvedAt = null;
      patch.approvedByUserId = null;
    }

    const updated = await store.update("estimates", req.params.id, patch);
    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "estimate.status_update",
      entityType: "estimate",
      entityId: updated.id,
      details: {
        status: updated.status
      }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/estimates/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const current = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!current) return res.status(404).json({ message: "Estimate not found" });
    if (current.status === "Approved" && req.user.role !== "Admin") {
      return res.status(403).json({ message: "Only admins can delete approved estimates." });
    }
    await store.delete("estimates", req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/estimates/:id/pdf", authMiddleware, async (req, res, next) => {
  try {
    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!estimate) {
      return res.status(404).json({ message: "Estimate not found" });
    }

    const project =
      (await store.find(
        "projects",
        (entry) => entry.id === estimate.projectId && entry.companyId === req.user.companyId
      )) || {
        name: "Construction Estimate",
        location: "N/A"
      };
    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    buildEstimatePdf(estimate, project, company, res);
  } catch (error) {
    next(error);
  }
});

app.get("/api/estimates/:id/csv", authMiddleware, async (req, res, next) => {
  try {
    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });

    const project = (await store.find(
      "projects",
      (entry) => entry.id === estimate.projectId && entry.companyId === req.user.companyId
    )) || { name: "Construction Estimate", location: "N/A" };

    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);

    // Build CSV
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = [
      // Header block
      [esc(company?.name || ""), "", "", "", "", "", "", "", ""],
      [esc("BuildIntel Construction Estimate"), "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", ""],
      [esc(`Project: ${project.name}`), "", "", "", "", "", "", "", ""],
      [esc(`Location: ${project.location}`), "", "", "", "", "", "", "", ""],
      [esc(`Status: ${estimate.status || "Draft"}`), "", "", "", "", "", "", "", ""],
      [esc(`Generated: ${new Date().toLocaleDateString()}`), "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", ""],
      // Column headers
      [esc("Category"), esc("Pay Item"), esc("Material / Description"), esc("Quantity"), esc("Unit"), esc("Unit Price (PHP)"), esc("Subtotal (PHP)"), esc("Remarks"), esc("Locked")],
      // Item rows grouped by category
      ...["Materials", "Labor", "Equipment"].flatMap((cat) => {
        const catItems = (estimate.items || []).filter((i) => i.category === cat);
        if (!catItems.length) return [];
        return [
          [esc(cat), "", "", "", "", "", "", "", ""],
          ...catItems.map((i) => [
            esc(cat),
            esc(i.payItem || ""),
            esc(i.material),
            esc(Number(i.quantity) || 0),
            esc(i.unit),
            esc(Number(i.unitPrice) || 0),
            esc((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)),
            esc(i.remarks || ""),
            esc(i.locked ? "Yes" : "")
          ])
        ];
      }),
      // Summary
      ["", "", "", "", "", "", "", "", ""],
      [esc("Direct Cost"), "", "", "", "", "", esc(estimate.directCost || 0), "", ""],
      [esc("Overhead"), esc(`${estimate.overheadPercent || 0}%`), "", "", "", "", esc(Math.round((estimate.directCost || 0) * (estimate.overheadPercent || 0) / 100)), "", ""],
      [esc("Profit"), esc(`${estimate.profitPercent || 0}%`), "", "", "", "", esc(Math.round((estimate.directCost || 0) * (estimate.profitPercent || 0) / 100)), "", ""],
      [esc("Contingency"), esc(`${estimate.contingencyPercent || 0}%`), "", "", "", "", esc(Math.round((estimate.directCost || 0) * (estimate.contingencyPercent || 0) / 100)), "", ""],
      [esc("Final Contract Price"), "", "", "", "", "", esc(estimate.finalContractPrice || 0), "", ""]
    ];

    const csv = rows.map((r) => r.join(",")).join("\r\n");
    const filename = `${project.name.replace(/\s+/g, "-").toLowerCase()}-estimate.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM for Excel UTF-8 compatibility
  } catch (error) {
    next(error);
  }
});

// Bulk reprice: update unitPrice for all rows whose material name matches a keyword
app.post("/api/estimates/:id/bulk-reprice", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      materialKeyword: z.string().min(1),
      newUnitPrice: z.number().nonnegative()
    }).parse(req.body);

    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    if (estimate.status === "Approved" && req.user.role !== "Admin") {
      return res.status(403).json({ message: "Approved estimates can only be edited by admins." });
    }

    const keyword = payload.materialKeyword.toLowerCase();
    let matchCount = 0;
    const updatedItems = (estimate.items || []).map((item) => {
      if (item.locked) return item; // respect locked rows
      if ((item.material || "").toLowerCase().includes(keyword)) {
        matchCount++;
        return { ...item, unitPrice: payload.newUnitPrice };
      }
      return item;
    });

    const recalculated = recalculateEstimate({ ...estimate, items: updatedItems, updatedAt: new Date().toISOString() });
    const updated = await store.update("estimates", req.params.id, recalculated);
    res.json({ ...updated, matchCount });
  } catch (error) {
    next(error);
  }
});

// Snapshot: save a named version snapshot of the current estimate for later diff
app.post("/api/estimates/:id/snapshot", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({ label: z.string().min(1).max(80) }).parse(req.body);
    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });

    const snapshot = await store.insert("estimateSnapshots", {
      companyId: req.user.companyId,
      estimateId: req.params.id,
      label: payload.label,
      createdAt: new Date().toISOString(),
      items: estimate.items,
      directCost: estimate.directCost,
      finalContractPrice: estimate.finalContractPrice,
      itemCount: (estimate.items || []).length
    });
    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

// List snapshots for an estimate
app.get("/api/estimates/:id/snapshots", authMiddleware, async (req, res, next) => {
  try {
    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    const snapshots = await store.list(
      "estimateSnapshots",
      (entry) => entry.estimateId === req.params.id && entry.companyId === req.user.companyId
    );
    res.json({ snapshots: snapshots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  } catch (error) {
    next(error);
  }
});

// BOQ completeness checker
app.get("/api/estimates/:id/completeness", authMiddleware, async (req, res, next) => {
  try {
    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    const result = checkBoqCompleteness({
      items: estimate.items || [],
      discipline: estimate.discipline || "",
      prompt: estimate.prompt || ""
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Executive summary PDF (single-page cover sheet)
app.get("/api/estimates/:id/summary-pdf", authMiddleware, async (req, res, next) => {
  try {
    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    const project = (await store.find(
      "projects",
      (entry) => entry.id === estimate.projectId && entry.companyId === req.user.companyId
    )) || { name: "Construction Project", location: "Philippines" };
    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    buildEstimateSummaryPdf(estimate, project, company, res);
  } catch (error) {
    next(error);
  }
});

// DPWH-formatted BOQ PDF
app.get("/api/estimates/:id/dpwh-pdf", authMiddleware, async (req, res, next) => {
  try {
    const estimate = await store.find(
      "estimates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    const project = (await store.find(
      "projects",
      (entry) => entry.id === estimate.projectId && entry.companyId === req.user.companyId
    )) || { name: "Construction Project", location: "Philippines" };
    const company = await store.find("companies", (entry) => entry.id === req.user.companyId);
    buildDpwhBoqPdf(estimate, project, company, res);
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit-logs", authMiddleware, authorize("Admin"), async (req, res, next) => {
  try {
    const logs = await store.list("auditLogs", (entry) => entry.companyId === req.user.companyId);
    res.json({
      logs: logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100)
    });
  } catch (error) {
    next(error);
  }
});

if (existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    return res.sendFile(resolve(clientDistDir, "index.html"));
  });

  app.post("/api/prompt-templates", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      label: z.string().min(2),
      type: z.string().min(2).max(40).optional().default("General"),
      isDefault: z.boolean().optional().default(false),
      prompt: z.string().min(10)
    }).parse(req.body);

    if (payload.isDefault) {
      const existing = await store.list("promptTemplates", (entry) => entry.companyId === req.user.companyId && entry.isDefault);
      await Promise.all(existing.map((entry) => store.update("promptTemplates", entry.id, { isDefault: false })));
    }

    const saved = await store.insert("promptTemplates", {
      companyId: req.user.companyId,
      label: payload.label.trim(),
      type: payload.type.trim(),
      isDefault: payload.isDefault,
      prompt: payload.prompt.trim(),
      createdAt: new Date().toISOString()
    });

    await recordAudit({
        companyId: req.user.companyId,
        actorUserId: req.user.id,
        action: "prompt-template.create",
        entityType: "prompt-template",
        entityId: saved.id,
        details: {
        label: saved.label,
        type: saved.type,
        isDefault: saved.isDefault
        }
      });

      res.status(201).json(saved);
    } catch (error) {
      next(error);
    }
    });

  app.patch("/api/prompt-templates/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      label: z.string().min(2).optional(),
      type: z.string().min(2).max(40).optional(),
      isDefault: z.boolean().optional(),
      prompt: z.string().min(10).optional()
    }).parse(req.body);

    const existing = await store.find(
      "promptTemplates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!existing) {
      return res.status(404).json({ message: "Prompt template not found" });
    }

    if (payload.isDefault) {
      const currentDefaults = await store.list("promptTemplates", (entry) => entry.companyId === req.user.companyId && entry.isDefault && entry.id !== existing.id);
      await Promise.all(currentDefaults.map((entry) => store.update("promptTemplates", entry.id, { isDefault: false })));
    }

    const updated = await store.update("promptTemplates", existing.id, {
      ...(payload.label ? { label: payload.label.trim() } : {}),
      ...(payload.type ? { type: payload.type.trim() } : {}),
      ...(payload.prompt ? { prompt: payload.prompt.trim() } : {}),
      ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {})
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "prompt-template.update",
      entityType: "prompt-template",
      entityId: updated.id,
      details: {
        label: updated.label,
        type: updated.type,
        isDefault: updated.isDefault
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
  });

  app.delete("/api/prompt-templates/:id", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const existing = await store.find(
      "promptTemplates",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!existing) {
      return res.status(404).json({ message: "Prompt template not found" });
    }

    await store.delete("promptTemplates", existing.id);

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "prompt-template.delete",
      entityType: "prompt-template",
      entityId: existing.id,
      details: {
        label: existing.label
      }
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/pricing/import", authMiddleware, authorize("Admin"), async (req, res, next) => {
  try {
    const payload = z.object({
      source: z.string().min(2).default("manual-import"),
      csvText: z.string().min(10)
    }).parse(req.body);

    const inserted = await importPricingFeed(payload, store);

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "pricing.import",
      entityType: "priceResearch",
      entityId: null,
      details: { source: payload.source, importedCount: inserted.length }
    });

    res.status(201).json({ importedCount: inserted.length, records: inserted });
  } catch (error) {
    next(error);
  }
  });

  app.post("/api/pricing/import-remote", authMiddleware, authorize("Admin"), async (req, res, next) => {
  try {
    const payload = z.object({
      source: z.string().min(2).default("remote-feed"),
      url: z.string().url()
    }).parse(req.body);

    const inserted = await importRemotePricingFeed(payload, store);

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "pricing.import_remote",
      entityType: "priceResearch",
      entityId: null,
      details: { source: payload.source, url: payload.url, importedCount: inserted.length }
    });

    res.status(201).json({ importedCount: inserted.length, records: inserted });
  } catch (error) {
    next(error);
  }
  });

  app.patch("/api/company/plan", authMiddleware, authorize("Admin"), async (req, res, next) => {
  try {
    const payload = z.object({
      plan: z.enum(["Starter", "Pro", "Enterprise"])
    }).parse(req.body);

    const updated = await store.update("companies", req.user.companyId, {
      plan: payload.plan
    });

    await recordAudit({
      companyId: req.user.companyId,
      actorUserId: req.user.id,
      action: "company.plan_update",
      entityType: "company",
      entityId: req.user.companyId,
      details: payload
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
  });
}

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: error.issues });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

  return app;
};

export const startServer = async (port = config.port) => {
  const app = await createApp();

  return app.listen(port, () => {
    console.log(`BuildIntel API listening on http://localhost:${port} using ${store.mode} storage`);
  });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await startServer();
}
