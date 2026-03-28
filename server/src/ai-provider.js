import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config.js";
import { analyzeBlueprint, recalculateEstimate } from "./ai.js";

// ─── Token Usage Tracker ──────────────────────────────────────────────────────
const tokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  requests: 0,
  rateLimitHits: 0,
  lastUpdated: null
};

export const getTokenUsage = () => ({ ...tokenUsage });

const trackUsage = (usage) => {
  if (!usage) return;
  tokenUsage.promptTokens += usage.prompt_tokens || 0;
  tokenUsage.completionTokens += usage.completion_tokens || 0;
  tokenUsage.totalTokens += usage.total_tokens || 0;
  tokenUsage.requests += 1;
  tokenUsage.lastUpdated = new Date().toISOString();
};

const itemSchema = z.object({
  material: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  category: z.enum(["Materials", "Labor", "Equipment"])
});

const estimateSchema = z.object({
  location: z.string().min(1),
  areaSqm: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()),
  wasteFactorPercent: z.number().min(0),
  overheadPercent: z.number().min(0),
  profitPercent: z.number().min(0),
  contingencyPercent: z.number().min(0),
  items: z.array(itemSchema).min(1)
});

const toStringArray = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);

const blueprintSchema = z.object({
  extractionSummary: z.string().min(10),
  extracted: z.object({
    roomDimensions: z.preprocess(toStringArray, z.array(z.string())),
    wallLengths: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()),
    floorAreas: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()),
    structuralElements: z.preprocess(toStringArray, z.array(z.string()))
  }),
  boq: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(
      z.object({
        material: z.string().min(1),
        quantity: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()),
        unit: z.string().min(1)
      })
    )
  )
});

const priceRefreshSchema = z.object({
  summary: z.string().min(10),
  updates: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      unitPrice: z.number().nonnegative(),
      supplier: z.string().min(1).optional().default(""),
      rationale: z.string().min(3)
    })
  )
});

let openaiClient;

const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }

  return openaiClient;
};

const buildMaterialsContext = (materials) =>
  materials.map((material) => ({
    name: material.name,
    unit: material.unit,
    averagePrice: material.averagePrice,
    trend: material.trend
  }));

const parseJsonObject = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a valid JSON object.");
  }

  return JSON.parse(text.slice(start, end + 1));
};

const ESTIMATE_SYSTEM_PROMPT = [
  "You are a senior construction estimator producing contractor-ready draft BOQs.",
  "Return only one valid JSON object matching the requested shape.",
  "Use categories Materials, Labor, or Equipment only.",
  "Prefer practical Philippine residential/commercial construction conventions when the prompt is local.",
  "Use the provided material catalog prices when there is a close name match.",
  "Generate concrete line items, not vague placeholders.",
  "Avoid duplicate or overlapping items unless they are clearly separate scopes.",
  "Include enough detail for an editable BOQ, usually around 12 to 30 total rows unless the prompt is explicitly small or shell-only.",
  "Keep labor and equipment realistic but concise, usually lot-based or day-based when appropriate.",
  "CIVIL WORKS (discipline=civil or prompt contains waterline/drainage/road/subdivision signals):",
  "Read exact pipe sizes from the prompt text (e.g. '100mm PVC waterline: 2952m') — do NOT invent sizes not mentioned.",
  "If the prompt lists pipe entries like '100mm PVC waterline: 2952m', emit exactly one pipe row per entry with that quantity (+ 5% waste).",
  "After pipes, include: PVC couplings (1 per 6m), elbows (1 per 40m), tees (1 per 80m), reducers (1 per 200m).",
  "Also include: GI pipe stubs (1.5m per 20m of main), gate valve box covers (1 per gate valve), hydrant marker posts.",
  "Also include: concrete thrust blocks (1 per elbow+tee), gravel bedding (0.08 m³/m), Portland cement for manholes/catch basins, 10mm rebar for structures.",
  "Also include: PVC primer, PVC solvent cement, pipe joint lubricant, Teflon tape, sand bedding.",
  "Also include: safety vests, hard hats, barricades/traffic signs (1 set per 50m), safety cones.",
  "ROAD PAVEMENT (when prompt contains totalRoad or road length in meters):",
  "If road length is present, add: gravel sub-base 300mm (road_length * 6m width * 0.30m depth m³), crushed aggregate base 150mm (same width * 0.15m depth m³), Portland cement for PCC slab, 12mm rebar for road slab, curb and gutter (road_length * 2 sides meters), pavement markings (m²).",
  "LABOR for civil: excavation (days), pipe laying (days), structures (days), pressure testing (days), backfilling (days), licensed CE supervision (lot).",
  "EQUIPMENT for civil: excavator (days), dump truck (days), plate compactor (days), concrete mixer (days), pressure test pump (days), water truck (days).",
  "Do not include markdown, commentary, code fences, or extra text outside the JSON object."
].join(" ");

const BLUEPRINT_SYSTEM_PROMPT = [
  "You are a construction document extraction assistant.",
  "Return only one valid JSON object matching the requested shape.",
  "Extract estimating-relevant signals conservatively.",
  "Do not invent dimensions or scope that are not reasonably supported by the input.",
  "CRITICAL: You MUST calculate floorAreas by reading actual dimension numbers from the extractedText.",
  "Dimensions in construction drawings are in millimeters — divide by 1000 to convert to meters.",
  "For example: 5000mm x 4850mm = 5.0m x 4.85m = 24.25 sqm per unit.",
  "If multiple identical units are shown (e.g. a row of townhouses), count them and multiply: total GFA = units x area per unit.",
  "The fallbackAreaSqm field is ONLY used if no dimensions whatsoever are readable in the document — ignore it if you can read any dimension numbers.",
  "Show your area calculation clearly in extractionSummary (e.g. '4 units x 5.0m x 4.85m = 97 sqm total GFA')."
].join(" ");

const PRICE_REFRESH_SYSTEM_PROMPT = [
  "You are a construction pricing analyst refreshing BOQ unit prices from current web sources.",
  "Return only one valid JSON object matching the requested shape.",
  "Update unit prices only. Do not change quantities, units, materials, or categories.",
  "Use current web results and prioritize supplier, retailer, or recent market sources relevant to the project's location.",
  "If a precise local match is unavailable, use the closest practical market equivalent and explain the rationale.",
  "Keep supplier names short and human-readable.",
  "Do not include markdown, commentary, code fences, or extra text outside the JSON object."
].join(" ");

const buildEstimateRequestPayload = ({ prompt, materials, template, discipline }) => JSON.stringify({
  task: "Generate a construction estimate draft from the prompt and available material catalog.",
  discipline: discipline || "",
  prompt,
  template: template
    ? {
        name: template.name || "Default template",
        description: template.description || "",
        defaults: template.defaults || null
      }
    : null,
  materials: buildMaterialsContext(materials),
  outputGuidance: {
    intent: "editable draft estimate for BOQ review",
    preferredUnits: ["bags", "pcs", "m2", "m3", "kg", "liters", "meters", "sets", "days", "lot"],
    qualityRules: [
      "Prefer practical contractor-style quantities.",
      "Use location and area cues from the prompt when present.",
      "Reflect finish level, exclusions, and building type from the prompt.",
      "Use specific material names such as Portland Cement, CHB 4\\\", PVC Pipe, Lighting Fixtures, and similar real-world items.",
      "Keep labor and equipment scopes distinct from materials."
    ]
  },
  requiredShape: {
    location: "string",
    areaSqm: "number",
    wasteFactorPercent: "number",
    overheadPercent: "number",
    profitPercent: "number",
    contingencyPercent: "number",
    items: [
      {
        material: "string",
        quantity: "number",
        unit: "string",
        unitPrice: "number",
        category: "Materials | Labor | Equipment"
      }
    ]
  }
});

const buildBlueprintRequestPayload = ({ filename, notes, areaHint, extractedText }) => JSON.stringify({
  task: "Extract estimating signals from a construction document.",
  filename,
  notes,
  fallbackAreaSqm: areaHint,
  extractedText,
  requiredShape: {
    extractionSummary: "string",
    extracted: {
      roomDimensions: ["string"],
      wallLengths: "number",
      floorAreas: "number",
      structuralElements: ["string"]
    },
    boq: [
      {
        material: "string",
        quantity: "number",
        unit: "string"
      }
    ]
  }
});

const buildPriceRefreshPayload = ({ estimate, location }) => JSON.stringify({
  task: "Refresh BOQ unit prices using current web search results.",
  location,
  currency: "PHP",
  instructions: [
    "Use current market signals relevant to the estimate location.",
    "Return updates only for rows where you found a meaningful refreshed price.",
    "Preserve the original unit and compare like-for-like units when possible.",
    "Prefer Philippine supplier or retailer sources when the project is in the Philippines."
  ],
  items: (estimate.items || []).map((item, index) => ({
    index,
    material: item.material,
    unit: item.unit,
    currentUnitPrice: item.unitPrice,
    category: item.category
  })),
  requiredShape: {
    summary: "string",
    updates: [
      {
        index: "number",
        unitPrice: "number",
        supplier: "string",
        rationale: "string"
      }
    ]
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runGitHubModelsChatCompletion = async ({ systemPrompt, userPayload }, retries = 3) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.githubModelsToken}`,
        "X-GitHub-Api-Version": config.githubModelsApiVersion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.githubModelsModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload }
        ]
      })
    });

    const responseBody = await response.text();
    if (!response.ok) {
      if (response.status === 429) {
        tokenUsage.rateLimitHits += 1;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 30000; // 30s, 60s, 120s
          console.warn(`GitHub Models rate limited (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay / 1000}s…`);
          await sleep(delay);
          continue;
        }
      }
      const message = responseBody || `GitHub Models request failed with status ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const parsed = JSON.parse(responseBody);
    trackUsage(parsed?.usage);
    return parsed?.choices?.[0]?.message?.content || "";
  }
};

const extractWebSearchSources = (response) =>
  (response?.output || [])
    .filter((entry) => entry?.type === "web_search_call")
    .flatMap((entry) => entry?.action?.sources || [])
    .map((source) => ({
      title: source?.title || source?.site_name || source?.url || "Source",
      url: source?.url || "",
      siteName: source?.site_name || ""
    }))
    .filter((source) => source.url);

export const shouldUseManagedAI = () => config.aiProvider === "openai" || config.aiProvider === "github-models";

// ─── Agent ────────────────────────────────────────────────────────────────────

const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a new project in BuildIntel",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          location: { type: "string" },
          areaSqm: { type: "number" },
          description: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_estimate",
      description: "Generate a new AI estimate using a description prompt",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Full construction brief to estimate" },
          projectId: { type: "string", description: "Project ID to link to (optional)" }
        },
        required: ["prompt"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_estimate_status",
      description: "Change the status of the current estimate",
      parameters: {
        type: "object",
        properties: { status: { type: "string", enum: ["Draft", "Reviewed", "Approved"] } },
        required: ["status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_boq_items",
      description: "Add new line items to the current estimate BOQ",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                material: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
                unitPrice: { type: "number" },
                category: { type: "string", enum: ["Materials", "Labor", "Equipment"] }
              },
              required: ["material", "quantity", "unit", "unitPrice", "category"]
            }
          }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_boq_items",
      description: "Remove BOQ items matching a keyword",
      parameters: {
        type: "object",
        properties: { pattern: { type: "string", description: "Material name or keyword to match for removal" } },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_document",
      description: "Delete a document from the system by name",
      parameters: {
        type: "object",
        properties: { documentName: { type: "string" } },
        required: ["documentName"]
      }
    }
  }
];

const READ_ONLY_TOOLS = new Set([]);

const TOOL_LABELS = {
  create_project: "Create project",
  generate_estimate: "Generate estimate",
  update_estimate_status: "Update status",
  add_boq_items: "Add BOQ items",
  remove_boq_items: "Remove BOQ items",
  delete_document: "Delete document"
};

const TOOL_RISK = {
  create_project: "low",
  generate_estimate: "low",
  update_estimate_status: "medium",
  add_boq_items: "low",
  remove_boq_items: "medium",
  delete_document: "high"
};

const buildActionDescription = (tool, args, context) => {
  switch (tool) {
    case "create_project": return `Create "${args.name}"${args.location ? ` in ${args.location}` : ""}${args.areaSqm ? ` — ${args.areaSqm} sqm` : ""}`;
    case "generate_estimate": return `"${(args.prompt || "").slice(0, 80)}"`;
    case "update_estimate_status": return `Mark current estimate as "${args.status}"`;
    case "add_boq_items": return `Add ${args.items?.length || 0} line item(s) to BOQ`;
    case "remove_boq_items": return `Remove items matching "${args.pattern}"`;
    case "delete_document": return `Delete "${args.documentName}"`;
    default: return JSON.stringify(args).slice(0, 100);
  }
};

export const runAgentPlan = async ({ message, context }) => {
  if (config.aiProvider !== "github-models") {
    throw new Error("Agent mode requires AI_PROVIDER=github-models");
  }

  const contextLines = [
    context.currentEstimate
      ? `Active estimate: "${context.currentEstimate.prompt}" — ${context.itemCount || 0} items, status: ${context.currentEstimate.status}`
      : "No active estimate selected.",
    `Projects: ${(context.projects || []).map((p) => `${p.name} (id:${p.id})`).join(", ") || "none"}`,
    `Documents: ${context.documentCount || 0} uploaded`,
    context.boqSample?.length
      ? `Sample BOQ items: ${context.boqSample.map((i) => `${i.material} (${i.category})`).join(", ")}`
      : ""
  ].filter(Boolean).join("\n");

  const systemPrompt = [
    "You are an AI assistant embedded in BuildIntel, a construction estimating platform.",
    "You help users manage estimates, projects, documents, and BOQ items using the available tools.",
    "For analysis or explanation requests (e.g. 'analyze BOQ', 'what's missing', 'explain cost'), reply with a clear, detailed text answer — do NOT call any tool.",
    "For write operations (create, generate, update, add, remove, delete), propose them as tool calls — the user confirms before execution.",
    "Keep replies concise but specific. Reference actual items and numbers from the context.",
    "Current workspace context:\n" + contextLines
  ].join(" ");

  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubModelsToken}`,
      "X-GitHub-Api-Version": config.githubModelsApiVersion,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.githubModelsModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      tools: AGENT_TOOLS,
      tool_choice: "auto"
    })
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Agent request failed: ${response.status} — ${body}`);

  const data = JSON.parse(body);
  const choice = data.choices?.[0];
  const reply = choice?.message?.content || "Here's my plan:";
  const toolCalls = choice?.message?.tool_calls || [];

  const actions = toolCalls.map((tc) => {
    const name = tc.function?.name || "";
    let args = {};
    try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
    return {
      id: tc.id || `action-${Date.now()}-${Math.random()}`,
      tool: name,
      label: TOOL_LABELS[name] || name,
      description: buildActionDescription(name, args, context),
      args,
      autoRun: READ_ONLY_TOOLS.has(name),
      risk: TOOL_RISK[name] || "low"
    };
  });

  return { reply, actions };
};

export const generateEstimateWithOpenAI = async ({ prompt, materials, template, discipline }) => {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: config.openaiModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: ESTIMATE_SYSTEM_PROMPT
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildEstimateRequestPayload({ prompt, materials, template, discipline })
          }
        ]
      }
    ]
  });

  const rawText = response.output_text || "";
  const parsed = estimateSchema.parse(parseJsonObject(rawText));

  return recalculateEstimate(parsed);
};

export const generateEstimateWithGitHubModels = async ({ prompt, materials, template, discipline }) => {
  const rawText = await runGitHubModelsChatCompletion({
    systemPrompt: ESTIMATE_SYSTEM_PROMPT,
    userPayload: buildEstimateRequestPayload({ prompt, materials, template, discipline })
  });

  const parsed = estimateSchema.parse(parseJsonObject(rawText));
  return recalculateEstimate(parsed);
};

export const generateEstimateWithProvider = async (payload) => {
  // payload must include { prompt, materials, template, discipline }
  if (config.aiProvider === "openai") {
    return generateEstimateWithOpenAI(payload);
  }

  if (config.aiProvider === "github-models") {
    return generateEstimateWithGitHubModels(payload);
  }

  throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
};

export const canUseOpenAIWebSearch = () => Boolean(config.openaiApiKey);

export const refreshEstimatePricesWithWebSearch = async ({ estimate, location }) => {
  if (!canUseOpenAIWebSearch()) {
    const error = new Error("OpenAI web search is not configured. Add OPENAI_API_KEY to enable live market refresh.");
    error.statusCode = 503;
    throw error;
  }

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: config.openaiModel,
    tools: [
      {
        type: "web_search"
      }
    ],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: PRICE_REFRESH_SYSTEM_PROMPT
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPriceRefreshPayload({ estimate, location })
          }
        ]
      }
    ]
  });

  const parsed = priceRefreshSchema.parse(parseJsonObject(response.output_text || ""));

  return {
    ...parsed,
    sources: extractWebSearchSources(response)
  };
};

export const analyzeBlueprintWithOpenAI = async ({ filename, notes = "", areaHint = 60, extractedText = "" }) => {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: config.openaiModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: BLUEPRINT_SYSTEM_PROMPT
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildBlueprintRequestPayload({ filename, notes, areaHint, extractedText })
          }
        ]
      }
    ]
  });

  const rawText = response.output_text || "";
  const parsed = blueprintSchema.parse(parseJsonObject(rawText));

  return {
    fileName: filename,
    summary: parsed.extractionSummary,
    extracted: parsed.extracted,
    boq: parsed.boq
  };
};

const runGitHubModelsVisionCompletion = async ({ systemPrompt, userPayload, images }, retries = 3) => {
  const content = [
    { type: "text", text: userPayload },
    ...images.map((b64) => ({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" }
    }))
  ];

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.githubModelsToken}`,
        "X-GitHub-Api-Version": config.githubModelsApiVersion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.githubModelsModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content }
        ]
      })
    });

    const responseBody = await response.text();
    if (!response.ok) {
      if (response.status === 429) {
        tokenUsage.rateLimitHits += 1;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 30000; // 30s, 60s, 120s
          console.warn(`GitHub Models vision rate limited (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay / 1000}s…`);
          await sleep(delay);
          continue;
        }
      }
      const message = responseBody || `GitHub Models vision request failed with status ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const parsed = JSON.parse(responseBody);
    trackUsage(parsed?.usage);
    return parsed?.choices?.[0]?.message?.content || "";
  }
};

export const analyzeBlueprintWithGitHubModels = async ({ filename, notes = "", areaHint = 60, extractedText = "", images = [] }) => {
  const userPayload = buildBlueprintRequestPayload({ filename, notes, areaHint, extractedText });

  const rawText = images.length > 0
    ? await runGitHubModelsVisionCompletion({ systemPrompt: BLUEPRINT_SYSTEM_PROMPT, userPayload, images })
    : await runGitHubModelsChatCompletion({ systemPrompt: BLUEPRINT_SYSTEM_PROMPT, userPayload });

  const parsed = blueprintSchema.parse(parseJsonObject(rawText));

  return {
    fileName: filename,
    summary: parsed.extractionSummary,
    extracted: parsed.extracted,
    boq: parsed.boq
  };
};

const MEP_SYSTEM_PROMPT = [
  "You are a construction MEP (mechanical, electrical, plumbing) document extraction assistant specialising in waterline and plumbing systems.",
  "Return only one valid JSON object matching the requested shape.",
  "Extract all plumbing signals: pipe schedules (material, diameter, estimated run length), fixtures (type and count), valves (type, size, count), and equipment (pumps, tanks, water heaters, pressure regulators).",
  "For large systems with many sheets, extract every pipe run, fixture, and valve you can observe — do not truncate.",
  "Do not invent items not supported by the input. Be conservative but thorough.",
  "Do not include markdown, commentary, code fences, or extra text outside the JSON object."
].join(" ");

const mepSchema = z.object({
  extractionSummary: z.string().min(10),
  extracted: z.object({
    pipes: z.preprocess(toStringArray, z.array(z.string())),
    fixtures: z.preprocess(toStringArray, z.array(z.string())),
    valves: z.preprocess(toStringArray, z.array(z.string())),
    equipment: z.preprocess(toStringArray, z.array(z.string()))
  }),
  boq: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(
      z.object({
        material: z.string().min(1),
        quantity: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()),
        unit: z.string().min(1)
      })
    )
  )
});

const buildMEPRequestPayload = ({ filename, notes, areaHint, extractedText }) => JSON.stringify({
  task: "Extract MEP plumbing and waterline signals from a construction document or drawing.",
  filename,
  notes,
  areaHint,
  extractedText,
  instructions: [
    "List every distinct pipe run with material, nominal diameter, and estimated length.",
    "List every fixture type with count (WC, lavatory, sink, floor drain, shower, urinal, faucet, etc.).",
    "List every valve type with nominal size and count (gate, ball, check, PRV, etc.).",
    "List all equipment: pumps, tanks, water heaters, pressure vessels, meters.",
    "BOQ should have one line per pipe schedule row, one per fixture type, one per valve type, one per equipment item.",
    "Use units: m (pipe length), pcs (fixtures/valves/equipment), units or sets where appropriate."
  ],
  requiredShape: {
    extractionSummary: "string",
    extracted: {
      pipes: ["string — e.g. '50mm uPVC Schedule 40 cold water supply, est. 28m'"],
      fixtures: ["string — e.g. 'Water closet (floor-mounted): 3 pcs'"],
      valves: ["string — e.g. 'Gate valve 50mm: 4 pcs'"],
      equipment: ["string — e.g. 'Centrifugal pressure pump 0.5HP: 1 unit'"]
    },
    boq: [{ material: "string", quantity: "number", unit: "string" }]
  }
});

export const analyzeMEPWithGitHubModels = async ({ filename, notes = "", areaHint = 60, extractedText = "", images = [] }) => {
  const userPayload = buildMEPRequestPayload({ filename, notes, areaHint, extractedText });

  const rawText = images.length > 0
    ? await runGitHubModelsVisionCompletion({ systemPrompt: MEP_SYSTEM_PROMPT, userPayload, images })
    : await runGitHubModelsChatCompletion({ systemPrompt: MEP_SYSTEM_PROMPT, userPayload });

  const parsed = mepSchema.parse(parseJsonObject(rawText));

  return {
    fileName: filename,
    summary: parsed.extractionSummary,
    extracted: parsed.extracted,
    boq: parsed.boq
  };
};

export const analyzeMEPWithProvider = async (payload) => {
  if (!shouldUseManagedAI()) {
    return {
      fileName: payload.filename,
      summary: "MEP extraction is not available in demo mode.",
      extracted: { pipes: [], fixtures: [], valves: [], equipment: [] },
      boq: []
    };
  }

  try {
    return await analyzeMEPWithGitHubModels(payload);
  } catch (error) {
    console.error("MEP analysis failed.", error);
    return {
      fileName: payload.filename,
      summary: "MEP extraction failed — check server logs.",
      extracted: { pipes: [], fixtures: [], valves: [], equipment: [] },
      boq: []
    };
  }
};

const PRICE_RESEARCH_SYSTEM_PROMPT = [
  "You are a construction materials pricing expert with knowledge of local market prices.",
  "Return only one valid JSON object matching the requested shape.",
  "Provide realistic typical market prices for the material and location based on your knowledge.",
  "Include 3-5 plausible supplier entries with varied prices around the average.",
  "For Philippine locations use PHP prices. For UAE use AED. For US use USD. Match currency to location.",
  "Mark all results with source: 'ai-estimate' and confidence: 'estimated'.",
  "Do not include markdown, commentary, code fences, or extra text outside the JSON object."
].join(" ");

const priceResearchSchema = z.object({
  lowestPrice: z.number().nonnegative(),
  averagePrice: z.number().nonnegative(),
  recommendedEstimatePrice: z.number().nonnegative(),
  unit: z.string().min(1),
  suppliers: z.array(z.object({
    supplier: z.string().min(1),
    price: z.number().nonnegative(),
    unit: z.string().min(1),
    location: z.string().min(1),
    delivery: z.string().optional().default("Available"),
    distanceKm: z.number().nonnegative().optional().default(0),
    confidence: z.string().optional().default("estimated"),
    source: z.string().optional().default("ai-estimate")
  })).min(1)
});

export const researchMaterialPricesWithAI = async ({ material, location }) => {
  const loc = location || "Philippines";
  const payload = JSON.stringify({
    task: "Provide typical construction market prices for this material and location.",
    material,
    location: loc,
    requiredShape: {
      lowestPrice: "number",
      averagePrice: "number",
      recommendedEstimatePrice: "number (averagePrice * 1.03)",
      unit: "string (e.g. bag, kg, m2, pcs, sheet)",
      suppliers: [{
        supplier: "string (realistic local supplier name)",
        price: "number",
        unit: "string",
        location: "string",
        delivery: "string",
        distanceKm: "number",
        confidence: "estimated",
        source: "ai-estimate"
      }]
    }
  });

  const rawText = await runGitHubModelsChatCompletion({
    systemPrompt: PRICE_RESEARCH_SYSTEM_PROMPT,
    userPayload: payload
  });

  const parsed = priceResearchSchema.parse(parseJsonObject(rawText));

  return {
    material,
    location: loc,
    lowestPrice: parsed.lowestPrice,
    averagePrice: parsed.averagePrice,
    recommendedEstimatePrice: parsed.recommendedEstimatePrice,
    suppliers: parsed.suppliers.map((s) => ({ ...s, material })),
    bestSupplier: parsed.suppliers[0] ? { ...parsed.suppliers[0], material } : null,
    sources: ["ai-estimate"],
    aiPowered: true
  };
};

const CIVIL_SYSTEM_PROMPT = [
  "You are a senior civil works quantity surveyor extracting estimating signals from construction drawings.",
  "Return only one valid JSON object matching the requested shape.",
  "You will receive drawing images (rendered PDF pages). Read labels, dimensions, legends, and stationing data directly from the images.",
  "STEP 1 — Identify what type of civil document this is by reading the title block and drawing content.",
  "It may be one or more of: waterline layout, drainage layout, road/pavement plan, earthworks/grading, electrical site plan, subdivision scheme, topographic plan, or other civil work.",
  "State what you identified in extractionSummary (e.g. 'Identified as: Waterline Layout Plan + Drainage Layout Plan').",
  "STEP 2 — Extract quantities relevant to what you identified:",
  "Waterline: pipe sizes and estimated run lengths (read from stationing or scale bar), fire hydrant count, gate valve count, service connection count, pumps.",
  "Drainage: pipe sizes (e.g. 24\" RCP, 15\" RCP) and estimated run lengths, manhole count, catch basin count.",
  "Roads: road lot numbers, widths (from labels like '8.00 M. WIDE'), lengths from stationing (STA 0+000 to STA 0+157 = 157m).",
  "Earthworks: cut/fill volumes, subgrade, compaction layers.",
  "Electrical: pole counts, distribution line lengths, panel boards.",
  "Subdivision: count all numbered residential lots visible in the drawing, typical lot size if shown, block labels.",
  "For lot count: count actual lot numbers in the subdivision plan — do NOT count road lots.",
  "For road lengths: use stationing data if available; otherwise estimate from scale.",
  "Put findings relevant to the identified discipline in the matching fields. Leave unrelated fields empty.",
  "Do not invent quantities not supported by the drawings.",
  "Do not include markdown, commentary, code fences, or extra text outside the JSON object."
].join(" ");

const civilSchema = z.object({
  extractionSummary: z.string().min(1),
  extracted: z.object({
    lotCount: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()).optional().default(0),
    lotSizeSqm: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()).optional().default(0),
    roadLengthM: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()).optional().default(0),
    roadDetails: z.preprocess(toStringArray, z.array(z.string())).optional().default([]),
    drainagePipes: z.preprocess(toStringArray, z.array(z.string())).optional().default([]),
    waterlinePipes: z.preprocess(toStringArray, z.array(z.string())).optional().default([]),
    otherInfrastructure: z.preprocess(toStringArray, z.array(z.string())).optional().default([])
  }).optional().default({}),
  boq: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.object({
      material: z.string().min(1),
      quantity: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().nonnegative()),
      unit: z.string().min(1)
    }))
  )
});

const buildCivilRequestPayload = ({ filename, notes, extractedText, civilSignals }) => JSON.stringify({
  task: "Generate a civil works BOQ from pre-counted drawing signals and document text.",
  filename,
  notes,
  preCountedSignals: civilSignals || null,
  extractedTextHint: extractedText ? extractedText.slice(0, 800) : "",
  instructions: [
    "The preCountedSignals object contains symbol counts and pipe sizes extracted deterministically from the PDF — trust these numbers exactly.",
    "Identify the document disciplines from the text hint and signal types (waterline, drainage, road, subdivision, electrical).",
    "State what you identified in extractionSummary.",
    "Populate extracted fields using preCountedSignals: fireHydrants/gateValves/blowOffValves go in otherInfrastructure, waterlinePipes and drainagePipes go in their fields, totalRoadLengthM goes in roadLengthM.",
    "For pipe run lengths: estimate based on totalRoadLengthM and typical subdivision layout if not directly available.",
    "For BOQ: one row per pipe size (quantity in meters), one row per fitting/fixture type (quantity in pcs) — use the pre-counted pcs directly.",
    "Do not invent quantities not supported by preCountedSignals."
  ],
  requiredShape: {
    extractionSummary: "string",
    extracted: {
      lotCount: "number — total residential lots",
      lotSizeSqm: "number — typical lot size in sqm",
      roadLengthM: "number — total road length in meters",
      roadDetails: ["string — e.g. 'Road Lot 1: 8.0m wide, ~157m long'"],
      drainagePipes: ["string — e.g. '15\" RCP: est. 320m'"],
      waterlinePipes: ["string — e.g. '75mm PVC: est. 180m'"],
      otherInfrastructure: ["string — e.g. 'Electrical poles: 31 pcs', 'Fire hydrants: 6 pcs'"]
    },
    boq: [{ material: "string", quantity: "number", unit: "string" }]
  }
});

export const analyzeCivilWithGitHubModels = async ({ filename, notes = "", extractedText = "", images = [], civilSignals = null }) => {
  // Pass pre-counted signals + a short text hint (title blocks only) so token usage stays low
  const textHint = extractedText.slice(0, 800);
  const userPayload = buildCivilRequestPayload({ filename, notes, extractedText: textHint, civilSignals });

  const rawText = images.length > 0
    ? await runGitHubModelsVisionCompletion({ systemPrompt: CIVIL_SYSTEM_PROMPT, userPayload, images })
    : await runGitHubModelsChatCompletion({ systemPrompt: CIVIL_SYSTEM_PROMPT, userPayload });

  let parsed;
  try {
    parsed = civilSchema.parse(parseJsonObject(rawText));
  } catch (zodErr) {
    console.error("Civil schema parse failed:", zodErr.message, "\nRaw AI response:", rawText?.slice(0, 500));
    throw zodErr;
  }

  return {
    fileName: filename,
    summary: parsed.extractionSummary,
    extracted: parsed.extracted,
    boq: parsed.boq
  };
};

export const analyzeCivilWithProvider = async (payload) => {
  if (!shouldUseManagedAI()) {
    return {
      fileName: payload.filename,
      summary: "Civil/site extraction is not available in demo mode.",
      extracted: { lotCount: 0, lotSizeSqm: 0, roadLengthM: 0, roadDetails: [], drainagePipes: [], waterlinePipes: [], otherInfrastructure: [] },
      boq: []
    };
  }

  try {
    return await analyzeCivilWithGitHubModels({ ...payload, civilSignals: payload.civilSignals || null });
  } catch (error) {
    console.error("Civil analysis failed:", error?.message || error);
    return {
      fileName: payload.filename,
      summary: "Civil extraction failed — check server logs.",
      extracted: { lotCount: 0, lotSizeSqm: 0, roadLengthM: 0, roadDetails: [], drainagePipes: [], waterlinePipes: [], otherInfrastructure: [] },
      boq: []
    };
  }
};

export const analyzeBlueprintWithProvider = async (payload) => {
  if (!shouldUseManagedAI()) {
    return analyzeBlueprint(payload);
  }

  try {
    if (config.aiProvider === "openai") {
      return await analyzeBlueprintWithOpenAI(payload);
    }

    return await analyzeBlueprintWithGitHubModels(payload);
  } catch (error) {
    console.error(`${config.aiProvider} blueprint analysis failed, falling back to demo analyzer.`, error);
    return analyzeBlueprint(payload);
  }
};
