import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { databaseEnabled, getPool, runMigrations } from "./db.js";
import { demoData } from "./data.js";

const here = dirname(fileURLToPath(import.meta.url));
const runtimeDir = resolve(here, "../data");
const runtimeFile = resolve(runtimeDir, "runtime.json");

const clone = (value) => JSON.parse(JSON.stringify(value));

const entityDefinitions = {
  alerts: {
    table: "alerts",
    fields: {
      id: { column: "id" },
      type: { column: "type" },
      title: { column: "title" },
      severity: { column: "severity" }
    }
  },
  auditLogs: {
    table: "audit_logs",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      actorUserId: { column: "actor_user_id" },
      action: { column: "action" },
      entityType: { column: "entity_type" },
      entityId: { column: "entity_id" },
      details: { column: "details", type: "json" },
      createdAt: { column: "created_at" }
    }
  },
  companies: {
    table: "companies",
    fields: {
      id: { column: "id" },
      name: { column: "name" },
      slug: { column: "slug" },
      plan: { column: "plan" },
      ownerId: { column: "owner_id" },
      createdAt: { column: "created_at" }
    }
  },
  documents: {
    table: "documents",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      projectId: { column: "project_id" },
      filename: { column: "filename" },
      storedPath: { column: "stored_path" },
      notes: { column: "notes" },
      areaHint: { column: "area_hint", type: "number" },
      extractionSummary: { column: "extraction_summary" },
      extracted: { column: "extracted", type: "json" },
      boq: { column: "boq", type: "json" },
      reviewStatus: { column: "review_status" },
      createdAt: { column: "created_at" }
    }
  },
  promptTemplates: {
    table: "prompt_templates",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      label: { column: "label" },
      type: { column: "type" },
      isDefault: { column: "is_default", type: "boolean" },
      prompt: { column: "prompt" },
      createdAt: { column: "created_at" }
    }
  },
  estimateTemplates: {
    table: "estimate_templates",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      name: { column: "name" },
      overheadPercent: { column: "overhead_percent", type: "number" },
      profitPercent: { column: "profit_percent", type: "number" },
      contingencyPercent: { column: "contingency_percent", type: "number" }
    }
  },
  estimates: {
    table: "estimates",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      projectId: { column: "project_id" },
      prompt: { column: "prompt" },
      status: { column: "status" },
      location: { column: "location" },
      areaSqm: { column: "area_sqm", type: "number" },
      directCost: { column: "direct_cost", type: "number" },
      finalContractPrice: { column: "final_contract_price", type: "number" },
      laborCost: { column: "labor_cost", type: "number" },
      equipmentCost: { column: "equipment_cost", type: "number" },
      wasteFactorPercent: { column: "waste_factor_percent", type: "number" },
      overheadPercent: { column: "overhead_percent", type: "number" },
      profitPercent: { column: "profit_percent", type: "number" },
      contingencyPercent: { column: "contingency_percent", type: "number" },
      items: { column: "items", type: "json" },
      approvedByUserId: { column: "approved_by_user_id" },
      reviewedAt: { column: "reviewed_at" },
      approvedAt: { column: "approved_at" },
      updatedAt: { column: "updated_at" },
      createdAt: { column: "created_at" }
    }
  },
  materials: {
    table: "materials",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      name: { column: "name" },
      unit: { column: "unit" },
      averagePrice: { column: "average_price", type: "number" },
      lastMonthPrice: { column: "last_month_price", type: "number" },
      trend: { column: "trend" },
      suppliers: { column: "suppliers", type: "json" }
    }
  },
  priceResearch: {
    table: "price_research",
    fields: {
      id: { column: "id" },
      material: { column: "material" },
      supplier: { column: "supplier" },
      source: { column: "source" },
      location: { column: "location" },
      price: { column: "price", type: "number" },
      unit: { column: "unit" },
      delivery: { column: "delivery" },
      distanceKm: { column: "distance_km", type: "number" },
      confidence: { column: "confidence" },
      checkedAt: { column: "checked_at" }
    }
  },
  projects: {
    table: "projects",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      name: { column: "name" },
      location: { column: "location" },
      description: { column: "description" },
      status: { column: "status" },
      areaSqm: { column: "area_sqm", type: "number" },
      blueprintSummary: { column: "blueprint_summary", type: "json" },
      createdAt: { column: "created_at" }
    }
  },
  resets: {
    table: "resets",
    fields: {
      id: { column: "id" },
      userId: { column: "user_id" },
      email: { column: "email" },
      token: { column: "token" },
      createdAt: { column: "created_at" }
    }
  },
  subscriptions: {
    table: "subscriptions",
    fields: {
      id: { column: "id" },
      name: { column: "name" },
      priceMonthly: { column: "price_monthly", type: "number" },
      features: { column: "features", type: "json" }
    }
  },
  users: {
    table: "users",
    fields: {
      id: { column: "id" },
      companyId: { column: "company_id" },
      name: { column: "name" },
      email: { column: "email" },
      passwordHash: { column: "password_hash" },
      role: { column: "role" },
      profileSettings: { column: "profile_settings", type: "json" },
      isActive: { column: "is_active", type: "boolean" },
      createdAt: { column: "created_at" }
    }
  }
};

const seedOrder = [
  "auditLogs",
  "companies",
  "users",
  "projects",
  "documents",
  "estimateTemplates",
  "promptTemplates",
  "materials",
  "estimates",
  "priceResearch",
  "alerts",
  "subscriptions",
  "resets"
];

const truncateOrder = [
  "auditLogs",
  "resets",
  "estimates",
  "documents",
  "materials",
  "promptTemplates",
  "estimateTemplates",
  "projects",
  "users",
  "companies",
  "priceResearch",
  "alerts",
  "subscriptions"
];

const normalizeSeedData = (source) => ({
  ...clone(source),
  promptTemplates: source.promptTemplates || [],
  users: source.users.map((user) => ({
    isActive: true,
    profileSettings: {},
    ...user
  }))
});

class JsonStore {
  constructor() {
    this.data = normalizeSeedData(demoData);
    this.mode = "demo";
  }

  async init() {
    try {
      const raw = await fs.readFile(runtimeFile, "utf8");
      this.data = normalizeSeedData(JSON.parse(raw));
    } catch {
      await this.persist();
    }
  }

  async persist() {
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(runtimeFile, JSON.stringify(this.data, null, 2));
  }

  async list(key, predicate = () => true) {
    return clone(this.data[key].filter(predicate));
  }

  async find(key, predicate) {
    const record = this.data[key].find(predicate);
    return record ? clone(record) : undefined;
  }

  async insert(key, value) {
    const record = { id: randomUUID(), ...value };
    this.data[key].push(record);
    await this.persist();
    return clone(record);
  }

  async update(key, id, patch) {
    const index = this.data[key].findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    this.data[key][index] = { ...this.data[key][index], ...patch };
    await this.persist();
    return clone(this.data[key][index]);
  }

  async delete(key, id) {
    const index = this.data[key].findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.data[key].splice(index, 1);
    await this.persist();
    return true;
  }

  async replaceAll(nextData) {
    this.data = normalizeSeedData(nextData);
    await this.persist();
  }
}

class PgStore {
  constructor() {
    this.mode = "postgres";
  }

  async init() {
    await runMigrations();
  }

  async list(key, predicate = () => true) {
    const definition = entityDefinitions[key];
    const result = await getPool().query(`SELECT * FROM ${definition.table}`);
    return result.rows.map((row) => this.deserialize(key, row)).filter(predicate);
  }

  async find(key, predicate) {
    const rows = await this.list(key, predicate);
    return rows[0];
  }

  async insert(key, value) {
    const definition = entityDefinitions[key];
    const record = {
      id: randomUUID(),
      ...value
    };

    const fields = Object.keys(record).filter((field) => definition.fields[field]);
    const columns = fields.map((field) => definition.fields[field].column);
    const placeholders = fields.map((_, index) => `$${index + 1}`);
    const values = fields.map((field) => this.serializeField(key, field, record[field]));

    const result = await getPool().query(
      `INSERT INTO ${definition.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );

    return this.deserialize(key, result.rows[0]);
  }

  async update(key, id, patch) {
    const definition = entityDefinitions[key];
    const fields = Object.keys(patch).filter((field) => definition.fields[field]);

    if (!fields.length) {
      return this.find(key, (entry) => entry.id === id);
    }

    const assignments = fields.map((field, index) => `${definition.fields[field].column} = $${index + 2}`);
    const values = [id, ...fields.map((field) => this.serializeField(key, field, patch[field]))];

    const result = await getPool().query(
      `UPDATE ${definition.table} SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
      values
    );

    return result.rows[0] ? this.deserialize(key, result.rows[0]) : null;
  }

  async delete(key, id) {
    const definition = entityDefinitions[key];
    const result = await getPool().query(`DELETE FROM ${definition.table} WHERE id = $1`, [id]);
    return result.rowCount > 0;
  }

  async replaceAll(nextData) {
    await runMigrations();
    const client = await getPool().connect();
    const seededData = normalizeSeedData(nextData);

    try {
      await client.query("BEGIN");
      await client.query(`TRUNCATE TABLE ${truncateOrder.map((key) => entityDefinitions[key].table).join(", ")} RESTART IDENTITY CASCADE`);

      for (const key of seedOrder) {
        for (const record of seededData[key]) {
          const definition = entityDefinitions[key];
          const fields = Object.keys(record).filter((field) => definition.fields[field]);
          const columns = fields.map((field) => definition.fields[field].column);
          const placeholders = fields.map((_, index) => `$${index + 1}`);
          const values = fields.map((field) => this.serializeField(key, field, record[field]));

          await client.query(
            `INSERT INTO ${definition.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
            values
          );
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  serializeField(key, field, value) {
    const definition = entityDefinitions[key].fields[field];

    if (value === undefined) {
      return null;
    }

    if (definition.type === "json") {
      return JSON.stringify(value);
    }

    return value;
  }

  deserialize(key, row) {
    const definition = entityDefinitions[key];

    return Object.entries(definition.fields).reduce((record, [field, metadata]) => {
      let value = row[metadata.column];

      if (metadata.type === "number" && value !== null && value !== undefined) {
        value = Number(value);
      }

      if (metadata.type === "boolean" && value !== null && value !== undefined) {
        value = Boolean(value);
      }

      if (metadata.type === "json" && typeof value === "string") {
        value = JSON.parse(value);
      }

      record[field] = value;
      return record;
    }, {});
  }
}

export const store = databaseEnabled && !config.demoMode ? new PgStore() : new JsonStore();
