import path from "node:path";
import { fileURLToPath } from "node:url";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);
try {
  process.loadEnvFile(rootEnv);
} catch {
  // .env may not be present or already loaded
}

import { env } from "./env.js";
import { buildApp } from "./app.js";
import { startReconcilerCron } from "./lib/cron.js";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`microgig-api listening on http://0.0.0.0:${env.PORT}`);
    app.log.info(`Health: http://localhost:${env.PORT}/api/v1/health`);

    startReconcilerCron(app.log);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
