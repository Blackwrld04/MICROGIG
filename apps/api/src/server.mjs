/**
 * PLACEHOLDER backend server — no dependencies, no framework.
 *
 * It exists so apps/api can be deployed to Render/Railway today and the frontend proxy
 * can be tested end to end. The backend owner replaces this file with the real app
 * (framework, Prisma, BullMQ worker, PRD §12 endpoints). Keep:
 *   - GET /api/v1/health   (Appendix E health check, used by render.yaml / railway.json)
 *   - listening on process.env.PORT
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Locally, read the single repo-root .env (Render/Railway inject env vars themselves).
const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
try {
  process.loadEnvFile(rootEnv);
} catch {
  /* no .env file: fine in production */
}

const PORT = Number(process.env.PORT) || 4000;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/api/v1/health") {
    return json(res, 200, { status: "ok", service: "microgig-api", time: new Date().toISOString() });
  }

  // Error envelope the frontend understands: { error: { message, fieldErrors? } }
  return json(res, 501, { error: { message: `Not implemented yet: ${req.method} ${url.pathname}` } });
});

server.listen(PORT, () => {
  console.log(`microgig-api listening on http://localhost:${PORT} (health: /api/v1/health)`);
});
