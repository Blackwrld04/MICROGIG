import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

for (const envCandidate of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env"),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
]) {
  try {
    process.loadEnvFile?.(envCandidate);
  } catch {}
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres URL"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 chars"),

  // Business constants
  PLATFORM_FEE_BPS: z.coerce.number().int().default(2000),
  AUTO_COMPLETE_DELAY_HOURS: z.coerce.number().int().default(72),
  REVISION_DEADLINE_HOURS: z.coerce.number().int().default(24),
  CLEARING_PERIOD_DAYS: z.coerce.number().int().default(3),

  // Cloud storage (optional for MVP)
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  // In development without .env, provide safe fallbacks if DATABASE_URL is not yet provided
  if (process.env.NODE_ENV !== "production") {
    console.warn("⚠️ Using fallback development environment variables.");
  }
}

export const env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: "development" as const,
      PORT: 4000,
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/microgig",
      WEB_ORIGIN: "http://localhost:3000",
      COOKIE_SECRET: process.env.COOKIE_SECRET || "development-insecure-cookie-secret-at-least-32-chars-long",
      PLATFORM_FEE_BPS: 2000,
      AUTO_COMPLETE_DELAY_HOURS: 72,
      REVISION_DEADLINE_HOURS: 24,
      CLEARING_PERIOD_DAYS: 3,
      STORAGE_ENDPOINT: undefined,
      STORAGE_ACCESS_KEY_ID: undefined,
      STORAGE_SECRET_ACCESS_KEY: undefined,
      STORAGE_BUCKET: undefined,
      STORAGE_PUBLIC_URL: undefined,
    };

export type Env = typeof env;
