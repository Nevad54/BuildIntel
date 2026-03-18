import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config.js";
import { analyzeBlueprint, recalculateEstimate } from "./ai.js";

const itemSchema = z.object({
  material: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  category: z.enum(["Materials", "Labor", "Equipment"])
});

const estimateSchema = z.object({
  location: z.string().min(1),
  areaSqm: z.number().positive(),
  wasteFactorPercent: z.number().min(0),
  overheadPercent: z.number().min(0),
  profitPercent: z.number().min(0),
  contingencyPercent: z.number().min(0),
  items: z.array(itemSchema).min(1)
});

const blueprintSchema = z.object({
  extractionSummary: z.string().min(10),
  extracted: z.object({
    roomDimensions: z.array(z.string()).min(1),
    wallLengths: z.number().nonnegative(),
    floorAreas: z.number().nonnegative(),
    structuralElements: z.array(z.string()).min(1)
  }),
  boq: z
    .array(
      z.object({
        material: z.string().min(1),
        quantity: z.number().nonnegative(),
        unit: z.string().min(1)
      })
    )
    .min(1)
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
  "Do not include markdown, commentary, code fences, or extra text outside the JSON object."
].join(" ");

const BLUEPRINT_SYSTEM_PROMPT = [
  "You are a construction document extraction assistant.",
  "Return only one valid JSON object matching the requested shape.",
  "Extract estimating-relevant signals conservatively.",
  "Do not invent dimensions or scope that are not reasonably supported by the input."
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

const buildEstimateRequestPayload = ({ prompt, materials, template }) => JSON.stringify({
  task: "Generate a construction estimate draft from the prompt and available material catalog.",
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
  areaHint,
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

const runGitHubModelsChatCompletion = async ({ systemPrompt, userPayload }) => {
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
    const message = responseBody || `GitHub Models request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const parsed = JSON.parse(responseBody);
  return parsed?.choices?.[0]?.message?.content || "";
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

export const generateEstimateWithOpenAI = async ({ prompt, materials, template }) => {
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
            text: buildEstimateRequestPayload({ prompt, materials, template })
          }
        ]
      }
    ]
  });

  const rawText = response.output_text || "";
  const parsed = estimateSchema.parse(parseJsonObject(rawText));

  return recalculateEstimate(parsed);
};

export const generateEstimateWithGitHubModels = async ({ prompt, materials, template }) => {
  const rawText = await runGitHubModelsChatCompletion({
    systemPrompt: ESTIMATE_SYSTEM_PROMPT,
    userPayload: buildEstimateRequestPayload({ prompt, materials, template })
  });

  const parsed = estimateSchema.parse(parseJsonObject(rawText));
  return recalculateEstimate(parsed);
};

export const generateEstimateWithProvider = async (payload) => {
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

export const analyzeBlueprintWithGitHubModels = async ({ filename, notes = "", areaHint = 60, extractedText = "" }) => {
  const rawText = await runGitHubModelsChatCompletion({
    systemPrompt: BLUEPRINT_SYSTEM_PROMPT,
    userPayload: buildBlueprintRequestPayload({ filename, notes, areaHint, extractedText })
  });

  const parsed = blueprintSchema.parse(parseJsonObject(rawText));

  return {
    fileName: filename,
    summary: parsed.extractionSummary,
    extracted: parsed.extracted,
    boq: parsed.boq
  };
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
