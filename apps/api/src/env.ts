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
  WEB_ORIGIN: z
    .string()
    .transform((val) => {
      let clean = val.trim().replace(/\/+$/, "");
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = `https://${clean}`;
      }
      return clean;
    })
    .pipe(z.string().url())
    .default("http://localhost:3000"),
  // Proxies in front of the API whose X-Forwarded-For entries are trusted for req.ip (rate
  // limits). 1 = the host's load balancer only; behind Vercel rewrites -> Render, use 2.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 chars"),

  // Business constants
  PLATFORM_FEE_BPS: z.coerce.number().int().default(2000),
  AUTO_COMPLETE_DELAY_HOURS: z.coerce.number().int().default(72),
  REVISION_DEADLINE_HOURS: z.coerce.number().int().default(24),
  CLEARING_PERIOD_DAYS: z.coerce.number().int().default(3),

  // Cloud storage (AWS S3 / Cloudflare R2 / MinIO)
  REDIS_URL: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BUCKET_NAME: z.string().default("microgig-showcase-public"),
  S3_PRIVATE_BUCKET_NAME: z.string().default("microgig-deliverables-private"),
  STORAGE_PUBLIC_URL: z.string().optional(),

  // Transactional Email (Resend or SMTP / Gmail)
  EMAIL_FROM: z.string().default("microgig <notifications@microgig.dev>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === "production") {
    console.error("💥 Fatal: Invalid environment configuration in production. Refusing to start.");
    process.exit(1);
  }
  console.warn("⚠️ Using fallback development environment variables.");
}

export const env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: "development" as const,
      PORT: 4000,
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/microgig",
      WEB_ORIGIN: "http://localhost:3000",
      TRUST_PROXY_HOPS: 1,
      COOKIE_SECRET: process.env.COOKIE_SECRET || "development-insecure-cookie-secret-at-least-32-chars-long",
      PLATFORM_FEE_BPS: 2000,
      AUTO_COMPLETE_DELAY_HOURS: 72,
      REVISION_DEADLINE_HOURS: 24,
      CLEARING_PERIOD_DAYS: 3,
      REDIS_URL: process.env.REDIS_URL,
      S3_REGION: process.env.S3_REGION || "auto",
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
      S3_PUBLIC_BUCKET_NAME: process.env.S3_PUBLIC_BUCKET_NAME || "microgig-showcase-public",
      S3_PRIVATE_BUCKET_NAME: process.env.S3_PRIVATE_BUCKET_NAME || "microgig-deliverables-private",
      STORAGE_PUBLIC_URL: process.env.STORAGE_PUBLIC_URL,
      EMAIL_FROM: process.env.EMAIL_FROM || "microgig <notifications@microgig.dev>",
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_SECURE: process.env.SMTP_SECURE !== "false",
    };

export type Env = typeof env;
