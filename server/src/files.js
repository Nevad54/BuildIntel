import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const here = dirname(fileURLToPath(import.meta.url));
const uploadsDir = resolve(here, "../uploads");

const sanitize = (filename) => filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
const textExtensions = new Set([".txt", ".md", ".csv", ".json"]);
const dxfExtensions  = new Set([".dxf"]);
const MIN_USEFUL_TEXT = 80; // chars — below this we treat the PDF as image-only
const MAX_VISION_PAGES = 8;
const PAGE_SCALE = 1.0; // render resolution multiplier — lower = smaller payload, fewer rate limit hits

const getExtension = (filename) => {
  const normalized = String(filename || "").toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index === -1 ? "" : normalized.slice(index);
};

const extractPdfText = async (buffer) => {
  try {
    const result = await pdfParse(buffer, { max: 0 });
    return result.text?.trim() || "";
  } catch {
    return "";
  }
};

// Render the first N pages of a PDF to base64 JPEG images using pdfjs-dist + canvas
const renderPdfToImages = async (buffer) => {
  try {
    const { createCanvas } = require("canvas");
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfjs = pdfjsLib.default ?? pdfjsLib;

    // pdfjs-dist's built-in NodeCanvasFactory uses @napi-rs/canvas, which is
    // incompatible with the "canvas" package we use for the main render target.
    // Providing a custom CanvasFactory ensures all internal canvases (temp
    // buffers, scaled images) use the same implementation so drawImage works.
    class NodeCanvasFactory {
      constructor({ enableHWA = false } = {}) {}
      create(width, height) {
        const c = createCanvas(width, height);
        return { canvas: c, context: c.getContext("2d") };
      }
      reset(entry, width, height) {
        entry.canvas.width = width;
        entry.canvas.height = height;
      }
      destroy(entry) {
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        entry.canvas = null;
        entry.context = null;
      }
    }

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), CanvasFactory: NodeCanvasFactory });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, MAX_VISION_PAGES);
    const images = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: PAGE_SCALE });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;

      images.push(canvas.toBuffer("image/jpeg", { quality: 0.75 }).toString("base64"));
    }

    return images;
  } catch {
    return [];
  }
};

// Returns { text, images } — images is [] for text PDFs, base64 JPEGs for drawing PDFs
export const extractUploadContent = async ({ filename, contentBase64, notes = "" }) => {
  if (!contentBase64) {
    return { text: notes, images: [] };
  }

  const ext = getExtension(filename);

  if (ext === ".pdf") {
    const buffer = Buffer.from(contentBase64, "base64");
    const pdfText = await extractPdfText(buffer);

    if (pdfText.length >= MIN_USEFUL_TEXT) {
      // Text-based PDF — no vision needed
      return { text: pdfText, images: [] };
    }

    // Image-only or sparse PDF — render pages for vision
    const images = await renderPdfToImages(buffer);
    return { text: notes, images };
  }

  if (dxfExtensions.has(ext)) {
    try {
      const text = Buffer.from(contentBase64, "base64").toString("utf8");
      return { text, images: [], isDxf: true };
    } catch {
      return { text: notes, images: [], isDxf: false };
    }
  }

  if (textExtensions.has(ext)) {
    try {
      const text = Buffer.from(contentBase64, "base64").toString("utf8").trim();
      return { text: text || notes, images: [] };
    } catch {
      return { text: notes, images: [] };
    }
  }

  return { text: notes, images: [] };
};

// DXF civil signal extractor — reads geometry directly from AutoCAD DXF files.
// Returns the same shape as extractCivilSignals so the rest of the pipeline is unchanged.
export const extractCivilSignalsFromDXF = (dxfText) => {
  try {
    const { parseString, denormalise, groupEntitiesByLayer } = require("dxf");
    const parsed = parseString(dxfText);
    const entities = denormalise(parsed);
    const byLayer = groupEntitiesByLayer(entities);

    // Block inserts = symbol placements (fire hydrants, gate valves, catch basins etc.)
    const inserts = entities.filter((e) => e.type === "INSERT");
    const blockCounts = {};
    inserts.forEach((e) => {
      const name = (e.name || "").toUpperCase();
      blockCounts[name] = (blockCounts[name] || 0) + 1;
    });

    // Match common civil block name patterns
    const sumBlocks = (...patterns) =>
      Object.entries(blockCounts)
        .filter(([k]) => patterns.some((p) => k.includes(p)))
        .reduce((s, [, v]) => s + v, 0);

    const fireHydrants  = sumBlocks("FH", "HYDRANT", "FIRE");
    const gateValves    = sumBlocks("GV", "GATE", "_G");
    const blowOffValves = sumBlocks("BOV", "BLOW");
    const catchBasins   = sumBlocks("CB", "CATCH");
    const manholes      = sumBlocks("MH", "MANHOLE") - sumBlocks("SM", "SEWER");
    const sewerManholes = sumBlocks("SM", "SEWER");

    // Pipe lengths — sum LWPOLYLINE and LINE entities per layer
    const calcLength = (ents) => {
      let total = 0;
      ents.forEach((e) => {
        if (e.vertices && e.vertices.length > 1) {
          for (let i = 0; i < e.vertices.length - 1; i++) {
            const a = e.vertices[i], b = e.vertices[i + 1];
            total += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
          }
        } else if (e.start && e.end) {
          total += Math.sqrt((e.end.x - e.start.x) ** 2 + (e.end.y - e.start.y) ** 2);
        }
      });
      return total;
    };

    // Detect unit scale: if coordinates are in the thousands, likely mm → divide by 1000
    const sampleCoords = entities.filter((e) => e.start || (e.vertices && e.vertices[0])).slice(0, 5);
    const maxCoord = sampleCoords.reduce((m, e) => {
      const pt = e.start || e.vertices?.[0] || {};
      return Math.max(m, Math.abs(pt.x || 0), Math.abs(pt.y || 0));
    }, 0);
    const unitScale = maxCoord > 10000 ? 1 / 1000 : 1; // mm→m if coords > 10,000

    // Group lines by layer name keywords — cast wide net for Philippine CAD conventions
    const waterlinePipeM = {};
    const drainagePipeM  = {};
    const roadLengths    = {};

    Object.entries(byLayer).forEach(([layer, ents]) => {
      const L = layer.toUpperCase();
      const lineEnts = ents.filter((e) => ["LWPOLYLINE", "POLYLINE", "LINE"].includes(e.type));
      if (!lineEnts.length) return;
      const len = Math.round(calcLength(lineEnts) * unitScale);
      if (len === 0) return;

      // Waterline: waterline/water pipe/wl/pipe layers — exclude vague hydrology names
      const isWaterline = (L.includes("WATERLINE") || L.includes("WATER PIPE") || L === "WL" ||
          L.includes("WL-") || L === "PIPE" || L.includes("PIPE-") || L.includes("-PIPE") ||
          /^P-?\d/.test(L)) &&
          !L.includes("WATERSHED") && !L.includes("WASTEWATER") && !L.includes("SEWAGE");
      // Drainage: drain, sewer, rcp, storm, mh (manhole), cb, culvert — exclude "drainage lot" (lot boundaries)
      const isDrainage = (L.includes("DRAIN") || L.includes("SEWER") || L.includes("RCP") ||
                 L.includes("STORM") || L === "MH" || L.includes("MH-") || L.includes("-MH") ||
                 L.includes("CULVERT") || L === "CB" || L.includes("CB-") || L.includes("-CB")) &&
                 !L.includes("DRAINAGE LOT") && !L.includes("DRAIN LOT");
      // Roads: road, proposed road, carriageway, pavement — exclude road network/national/street/lot labels
      const isRoad = (L.includes("PROPOSED ROAD") || L === "ROAD" || L.includes("CARRIAGEWAY") ||
                 L.includes("PAVEMENT") || (L.includes("ROAD") && !L.includes("NATIONAL") &&
                 !L.includes("NETWORK") && !L.includes("STREET") && !L.includes("LOT")));
      if (isWaterline) {
        waterlinePipeM[layer] = (waterlinePipeM[layer] || 0) + len;
      } else if (isDrainage) {
        drainagePipeM[layer] = (drainagePipeM[layer] || 0) + len;
      } else if (isRoad) {
        roadLengths[layer] = (roadLengths[layer] || 0) + len;
      }
    });

    const totalRoadLengthM = Object.values(roadLengths).reduce((s, v) => s + v, 0);

    // Consolidate waterline pipes: try to parse a nominal diameter from the layer name.
    // Philippine CAD files often have many layers (p-3, PIPE, WATERLINE, WL-50, etc.) that
    // all trace the same network → same length → fake duplicates. Group by parsed size and
    // keep the maximum length per size group (layers trace the same geometry, not additive).
    const parseDiameterFromLayer = (layer) => {
      // Match patterns like: WL-50, PIPE-75, 100MM, P-3 (ignore P-3 style — no real size)
      const L = layer.toUpperCase();
      // Explicit mm size in name: "WL-50", "WATERLINE-100", "PIPE-75", "50MM", "W-150"
      const explicit = L.match(/[-_\s](\d{2,4})(?:MM)?$/) || L.match(/^(\d{2,4})(?:MM)?[-_\s]/);
      if (explicit) {
        const n = Number(explicit[1]);
        if (n >= 20 && n <= 1200) return `${n}mm`;
      }
      // inch sizes: 4", 6", 8" in layer name
      const inch = L.match(/(\d{1,2})["']/);
      if (inch) return `${inch[1]}"`;
      return null; // no parseable size
    };

    // Group waterline layers by size key; max-length wins (same network, not additive)
    const waterlineBySizeKey = {};
    Object.entries(waterlinePipeM).forEach(([layer, len]) => {
      const sizeKey = parseDiameterFromLayer(layer) || "__unknown__";
      if (!waterlineBySizeKey[sizeKey] || len > waterlineBySizeKey[sizeKey].len) {
        waterlineBySizeKey[sizeKey] = { len, layer };
      }
    });
    const waterlinePipes = Object.entries(waterlineBySizeKey).map(([sizeKey, { len }]) =>
      sizeKey === "__unknown__"
        ? `Waterline pipe (size TBC): ${len}m`
        : `${sizeKey} PVC waterline: ${len}m`
    );

    // Same consolidation for drainage pipes
    const drainageBySizeKey = {};
    Object.entries(drainagePipeM).forEach(([layer, len]) => {
      const sizeKey = parseDiameterFromLayer(layer) || "__unknown__";
      if (!drainageBySizeKey[sizeKey] || len > drainageBySizeKey[sizeKey].len) {
        drainageBySizeKey[sizeKey] = { len, layer };
      }
    });
    const drainagePipes = Object.entries(drainageBySizeKey).map(([sizeKey, { len }]) =>
      sizeKey === "__unknown__"
        ? `Drainage pipe (size TBC): ${len}m`
        : `${sizeKey} RCP drainage: ${len}m`
    );

    // All block types found — useful for the AI to understand the drawing
    const allBlocks = Object.entries(blockCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `${k}: ${v} pcs`);

    return {
      source: "dxf",
      fireHydrants,
      gateValves,
      blowOffValves,
      catchBasins,
      manholes,
      sewerManholes,
      totalRoadLengthM,
      waterlinePipes,
      drainagePipes,
      allBlocks,
      layerSummary: Object.keys(byLayer)
    };
  } catch (err) {
    console.error("DXF parse failed:", err.message);
    return null;
  }
};

// Deterministic civil signal extractor — counts symbols and stationing from CAD-exported PDF text.
// CAD PDFs export each character on its own line, so symbols like FH, G, CB, MH appear as
// standalone trimmed lines. This is reliable even when the text is character-spaced.
export const extractCivilSignals = (rawText) => {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Symbol counts — only exact standalone tokens
  const count = (token) => lines.filter((l) => l === token).length;

  // Waterline symbols
  const fireHydrants  = count("FH");
  const gateValves    = Math.max(0, count("G") - 1); // subtract 1 for the legend label "G"
  const blowOffValves = Math.max(0, count("BOV") - 1);

  // Drainage symbols
  const catchBasins    = count("CB");
  const manholes       = count("MH");
  const sewerManholes  = count("SM");

  // Pipe sizes — look for lines like "50 MM Ø", "75MM Ø", "24\"Ø", "15\"Ø", "18\"Ø" etc.
  // After character-spacing removal they appear as joined strings e.g. "50 MM Ø" or "50MMØ"
  const pipePattern = /(\d+)\s*(?:MM|")\s*[ØO]/gi;
  const fullText = lines.join(" ");
  const pipeSizesRaw = [...fullText.matchAll(pipePattern)].map((m) => m[1]);
  // Deduplicate and sort numerically
  const pipeSizes = [...new Set(pipeSizesRaw)].sort((a, b) => Number(a) - Number(b));

  // Road stationing — values like 0+157, 0+092 etc. give end-of-road-lot lengths
  const staMatches = rawText.match(/0\+(\d{3})/g) || [];
  const staValues  = staMatches.map((s) => parseInt(s.split("+")[1]));
  // Group into road runs: each run is a sequence that starts from 0.
  // Heuristic: sort unique values, find the distinct maximums per run.
  // A new run starts when a value is less than the previous — collect the peaks.
  const uniqueSta = [...new Set(staValues)].sort((a, b) => a - b).filter((v) => v > 0);
  // Sum of all unique end-station values approximates total road network length
  const totalRoadLengthM = uniqueSta.reduce((sum, v) => sum + v, 0);

  // Waterline pipe mentions from text (character-spaced lines joined)
  const waterlinePipes = [];
  const drainagePipes  = [];
  if (pipeSizes.length) {
    // Sizes <= 150 that appear near "MM" are likely waterline (mm units)
    // Sizes that appear with " (inch marker) are likely drainage RCP
    const inchPipes = [...fullText.matchAll(/(\d+)"\s*[ØO]/gi)].map((m) => m[1]);
    const mmPipes   = [...fullText.matchAll(/(\d+)\s*MM\s*[ØO]/gi)].map((m) => m[1]);
    [...new Set(mmPipes)].sort((a,b)=>Number(a)-Number(b)).forEach((s) => waterlinePipes.push(`${s}mm PVC`));
    [...new Set(inchPipes)].sort((a,b)=>Number(a)-Number(b)).forEach((s) => drainagePipes.push(`${s}" RCP`));
  }

  return {
    fireHydrants,
    gateValves,
    blowOffValves,
    catchBasins,
    manholes,
    sewerManholes,
    totalRoadLengthM,
    waterlinePipes,
    drainagePipes,
    pipeSizes
  };
};

// Legacy shim used by the /api/ai/blueprint route (text-only)
export const extractUploadText = async ({ filename, contentBase64, notes = "" }) => {
  const { text } = await extractUploadContent({ filename, contentBase64, notes });
  return text;
};

// Generic file persist — used for project file library (any file type)
export const persistProjectFile = async ({ companyId, filename, contentBase64 }) => {
  const directory = resolve(uploadsDir, companyId);
  const storedName = `${randomUUID()}-${sanitize(filename || "file")}`;
  const target = resolve(directory, storedName);
  await fs.mkdir(directory, { recursive: true });
  const content = Buffer.from(contentBase64, "base64");
  if (content.byteLength > config.maxUploadBytes) {
    const error = new Error(`Upload exceeds limit of ${config.maxUploadBytes} bytes.`);
    error.statusCode = 413;
    throw error;
  }
  await fs.writeFile(target, content);
  return target;
};

// Extract readable text from a stored project file (best-effort, for AI context)
export const extractProjectFileText = async (storedPath, filename) => {
  const ext = getExtension(filename);
  try {
    const buffer = await fs.readFile(storedPath);
    if (textExtensions.has(ext)) return buffer.toString("utf8").slice(0, 4000);
    if (ext === ".pdf") return (await extractPdfText(buffer)).slice(0, 4000);
  } catch {
    // unreadable or binary — skip
  }
  return null;
};

export const persistProjectDocument = async ({ companyId, filename, contentBase64, notes }) => {
  const directory = resolve(uploadsDir, companyId);
  const storedName = `${randomUUID()}-${sanitize(filename || "document.txt")}`;
  const target = resolve(directory, storedName);

  await fs.mkdir(directory, { recursive: true });

  const content = contentBase64
    ? Buffer.from(contentBase64, "base64")
    : Buffer.from(notes || "No raw file content was provided for this demo upload.", "utf8");

  if (content.byteLength > config.maxUploadBytes) {
    const error = new Error(`Upload exceeds limit of ${config.maxUploadBytes} bytes.`);
    error.statusCode = 413;
    throw error;
  }

  await fs.writeFile(target, content);

  return target;
};
