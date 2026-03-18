import { config } from "./config.js";

const normalize = (value) => String(value || "").trim();

const parseCsv = (csvText) => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {});
  });
};

const parseJsonFeed = (jsonText) => {
  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed) ? parsed : [];
};

const mapRow = (row, source) => ({
  material: normalize(row.material),
  supplier: normalize(row.supplier),
  source,
  location: normalize(row.location),
  price: Number(row.price) || 0,
  unit: normalize(row.unit || "unit"),
  delivery: normalize(row.delivery || "Unknown"),
  distanceKm: Number(row.distanceKm || row.distance_km || 0),
  confidence: normalize(row.confidence || "medium"),
  checkedAt: new Date().toISOString()
});

export const importPricingFeed = async ({ csvText, source = "manual-import" }, store) => {
  const rows = parseCsv(csvText);
  const inserted = [];

  for (const row of rows) {
    if (!row.material || !row.supplier || !row.location || !row.price) {
      continue;
    }

    const record = await store.insert("priceResearch", mapRow(row, source));

    inserted.push(record);
  }

  return inserted;
};

export const importRemotePricingFeed = async ({ source = "remote-feed", url }, store) => {
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    const error = new Error("Only http and https pricing feeds are supported.");
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Remote pricing feed request failed with status ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > config.maxRemoteFeedBytes) {
    const error = new Error(`Remote feed exceeds limit of ${config.maxRemoteFeedBytes} bytes.`);
    error.statusCode = 413;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  const rows = contentType.includes("json") ? parseJsonFeed(text) : parseCsv(text);
  const inserted = [];

  for (const row of rows) {
    if (!row.material || !row.supplier || !row.location || !row.price) {
      continue;
    }

    inserted.push(await store.insert("priceResearch", mapRow(row, source)));
  }

  return inserted;
};
