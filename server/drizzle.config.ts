import { defineConfig } from "drizzle-kit";

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
