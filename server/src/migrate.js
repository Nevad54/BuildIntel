import { closePool, databaseEnabled, runMigrations } from "./db.js";

if (!databaseEnabled) {
  console.log("Skipping migrations because PostgreSQL mode is not enabled.");
  process.exit(0);
}

await runMigrations();
console.log("PostgreSQL migrations applied.");
await closePool();
