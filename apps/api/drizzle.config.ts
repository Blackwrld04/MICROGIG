import path from "node:path";
import { defineConfig } from "drizzle-kit";

for (const envCandidate of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
]) {
  try {
    process.loadEnvFile?.(envCandidate);
  } catch {}
}

export default defineConfig({
  schema: "./dist/db/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/microgig",
  },
  verbose: true,
  strict: true,
});
