import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../env.js";
import * as schema from "./schema/index.js";

const client = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: env.NODE_ENV === "production" ? "require" : undefined,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;

/**
 * One dedicated connection for cron advisory locks. Session-level locks live as long as this
 * connection, so it never idles out; if the process dies, Postgres releases them.
 */
export const lockConnection = postgres(env.DATABASE_URL, {
  max: 1,
  idle_timeout: 0,
  connect_timeout: 10,
  ssl: env.NODE_ENV === "production" ? "require" : undefined,
});
