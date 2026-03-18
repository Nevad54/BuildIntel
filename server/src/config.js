import dotenv from "dotenv";
import { z } from "zod";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(here, "../../.env") });
dotenv.config();

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.string().min(1).default("http://localhost:5173"),
    JWT_SECRET: z.string().min(1).default("change-me"),
    DEMO_MODE: z
      .enum(["true", "false"])
      .optional()
      .default("true")
      .transform((value) => value !== "false"),
    DATABASE_URL: z.string().optional().default(""),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().optional().default(1048576),
    AI_PROVIDER: z.enum(["demo", "openai", "github-models"]).optional().default("demo"),
    OPENAI_API_KEY: z.string().optional().default(""),
    OPENAI_MODEL: z.string().optional().default("gpt-4.1-mini"),
    GITHUB_MODELS_TOKEN: z.string().optional().default(""),
    GITHUB_MODELS_MODEL: z.string().optional().default("openai/gpt-4.1"),
    GITHUB_MODELS_API_VERSION: z.string().optional().default("2022-11-28"),
    MAX_REMOTE_FEED_BYTES: z.coerce.number().int().positive().optional().default(1048576),
    NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development")
  })
  .superRefine((env, context) => {
    if (env.DEMO_MODE === false && !env.DATABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when DEMO_MODE=false."
      });
    }

    if (env.DEMO_MODE === false && env.JWT_SECRET === "change-me") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be changed before running outside demo mode."
      });
    }

    if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai."
      });
    }

    if (env.AI_PROVIDER === "github-models" && !env.GITHUB_MODELS_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GITHUB_MODELS_TOKEN"],
        message: "GITHUB_MODELS_TOKEN is required when AI_PROVIDER=github-models."
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration.");
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  clientOrigin: parsed.data.CLIENT_ORIGIN,
  jwtSecret: parsed.data.JWT_SECRET,
  demoMode: parsed.data.DEMO_MODE,
  databaseUrl: parsed.data.DATABASE_URL,
  maxUploadBytes: parsed.data.MAX_UPLOAD_BYTES,
  aiProvider: parsed.data.AI_PROVIDER,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  openaiModel: parsed.data.OPENAI_MODEL,
  githubModelsToken: parsed.data.GITHUB_MODELS_TOKEN,
  githubModelsModel: parsed.data.GITHUB_MODELS_MODEL,
  githubModelsApiVersion: parsed.data.GITHUB_MODELS_API_VERSION,
  maxRemoteFeedBytes: parsed.data.MAX_REMOTE_FEED_BYTES,
  nodeEnv: parsed.data.NODE_ENV,
  storageMode: parsed.data.DATABASE_URL && !parsed.data.DEMO_MODE ? "postgres" : "demo"
};
