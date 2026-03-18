import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const here = dirname(fileURLToPath(import.meta.url));
const uploadsDir = resolve(here, "../uploads");

const sanitize = (filename) => filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
const textExtensions = new Set([".txt", ".md", ".csv", ".json"]);

const getExtension = (filename) => {
  const normalized = String(filename || "").toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index === -1 ? "" : normalized.slice(index);
};

export const extractUploadText = ({ filename, contentBase64, notes = "" }) => {
  if (!contentBase64) {
    return notes;
  }

  if (!textExtensions.has(getExtension(filename))) {
    return notes;
  }

  try {
    const text = Buffer.from(contentBase64, "base64").toString("utf8").trim();
    return text || notes;
  } catch {
    return notes;
  }
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
