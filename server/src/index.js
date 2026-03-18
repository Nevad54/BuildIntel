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
import { analyzeBlueprint, generateEstimate, recalculateEstimate, simulatePricing } from "./ai.js";
import {
  analyzeBlueprintWithProvider,
  canUseOpenAIWebSearch,
  generateEstimateWithProvider,
  refreshEstimatePricesWithWebSearch,
  shouldUseManagedAI
} from "./ai-provider.js";
import { buildPriceAlerts, researchPrices, supplierFinder } from "./pricing.js";
import { importPricingFeed, importRemotePricingFeed } from "./pricing-provider.js";
import { buildEstimatePdf } from "./pdf.js";
import { extractUploadText, persistProjectDocument } from "./files.js";
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
  app.use(express.json({ limit: "5mb" }));
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
      location: z.string().min(2),
      description: z.string().min(10),
      areaSqm: z.number().positive()
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
      location: z.string().min(2).optional(),
      description: z.string().min(10).optional(),
      status: z.enum(["Estimating", "Submitted", "Won", "Lost"]).optional(),
      areaSqm: z.number().positive().optional()
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
      ...payload
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

  app.patch("/api/materials/:id", authMiddleware, authorize("Admin"), async (req, res, next) => {
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

    const updated = await store.update("materials", req.params.id, payload);
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
        extractedText: extractUploadText(payload)
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/documents", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      filename: z.string().min(3),
      notes: z.string().optional().default(""),
      areaHint: z.number().positive().optional(),
      contentBase64: z.string().optional()
    }).parse(req.body);

    const project = await store.find(
      "projects",
      (entry) => entry.id === req.params.id && entry.companyId === req.user.companyId
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const analysis = await analyzeBlueprintWithProvider({
      ...payload,
      extractedText: extractUploadText(payload)
    });
    const storedPath = await persistProjectDocument({
      companyId: req.user.companyId,
      filename: payload.filename,
      contentBase64: payload.contentBase64,
      notes: payload.notes
    });

    const document = await store.insert("documents", {
      companyId: req.user.companyId,
      projectId: project.id,
      filename: payload.filename,
      storedPath,
      notes: payload.notes,
      areaHint: payload.areaHint || project.areaSqm,
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
    const payload = z.object({
      extractionSummary: z.string().min(10),
      extracted: z.object({
        roomDimensions: z.array(z.string()),
        wallLengths: z.number().nonnegative(),
        floorAreas: z.number().nonnegative(),
        structuralElements: z.array(z.string())
      }),
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

  app.post("/api/ai/estimate", authMiddleware, authorize("Admin", "Estimator"), async (req, res, next) => {
  try {
    const payload = z.object({
      prompt: z.string().min(10),
      projectId: z.string().optional(),
      templateId: z.string().optional()
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

      const estimate = shouldUseManagedAI()
        ? await generateEstimateWithProvider({
            prompt: payload.prompt,
            materials,
            template
        })
      : generateEstimate({
          prompt: payload.prompt,
          materials,
          template
        });

    const saved = await store.insert("estimates", {
      companyId: req.user.companyId,
      projectId,
      prompt: payload.prompt,
      createdAt: new Date().toISOString(),
      ...estimate
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

    res.json(await researchPrices(payload, store));
  } catch (error) {
    next(error);
  }
});

  app.post("/api/pricing/suppliers", authMiddleware, async (req, res, next) => {
  try {
    const payload = z.object({
      location: z.string().min(2),
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
          category: z.enum(["Materials", "Labor", "Equipment"])
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
