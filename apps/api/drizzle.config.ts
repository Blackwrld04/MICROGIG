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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && process.env.NODE_ENV === "production") {
  console.error("❌ ERROR: DATABASE_URL is not set in your Render environment variables!");
  throw new Error("DATABASE_URL environment variable is missing in production.");
}

export default defineConfig({
  schema: "./dist/db/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl || "postgresql://postgres:postgres@localhost:5432/microgig",
  },
  verbose: true,
  strict: true,
});
