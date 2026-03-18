import { Pool } from "pg";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const here = dirname(fileURLToPath(import.meta.url));
const schemaFile = resolve(here, "../db/schema.sql");

let pool;
let migrationsRan = false;

export const databaseEnabled = config.storageMode === "postgres";

export const getPool = () => {
  if (!databaseEnabled) {
    throw new Error("PostgreSQL is not enabled for this environment.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl
    });
  }

  return pool;
};

export const runMigrations = async () => {
  if (!databaseEnabled || migrationsRan) {
    return;
  }

  const sql = await fs.readFile(schemaFile, "utf8");
  await getPool().query(sql);
  migrationsRan = true;
};

export const closePool = async () => {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
  migrationsRan = false;
};
