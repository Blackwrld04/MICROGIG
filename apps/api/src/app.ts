import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { errorHandler, notFound } from "./errors.js";
import { getRedisClient } from "./lib/redis.js";
import authenticatePlugin, {
  requireAuth,
  clearSessionCookie,
} from "./plugins/authenticate.js";

import { authRoutes } from "./modules/auth/auth.routes.js";
import { sellerRoutes } from "./modules/seller/seller.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { walletRoutes } from "./modules/ledger/wallet.routes.js";
import { inboxRoutes } from "./modules/messaging/inbox.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { storageRoutes } from "./modules/storage/storage.routes.js";

import {
  revokeSession,
  revokeAllSessions,
  listUserSessions,
} from "./modules/auth/auth.service.js";

export async function buildApp() {
  const fastify = Fastify({
    trustProxy: 1,
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  const redis = getRedisClient();
  await fastify.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    redis: redis ?? undefined,
    skipOnError: true,
    allowList: (req) => {
      return req.url === "/api/v1/health";
    },
    errorResponseBuilder: (_req, context) => ({
      error: {
        message: "Too many requests. Please slow down and try again shortly.",
        statusCode: 429,
        retryAfter: context.after,
      },
    }),
  });

  await fastify.register(cookie, {
    secret: env.COOKIE_SECRET,
  });

  await fastify.register(cors, {
    origin:      env.WEB_ORIGIN,
    credentials: true,
    methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await fastify.register(authenticatePlugin);

  fastify.setErrorHandler(errorHandler);

  fastify.get("/api/v1/health", async (_req, reply) => {
    return reply.send({
      status:  "ok",
      service: "microgig-api",
      time:    new Date().toISOString(),
    });
  });

  // Auth routes (/api/v1/auth/*)
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });

  // Session routes (/api/v1/me/sessions)
  await fastify.register(
    async (instance) => {
      instance.get("/sessions", async (req, reply) => {
        const user = requireAuth(req);
        const sessions = await listUserSessions(user.id, user.sessionId);
        return reply.send({ sessions });
      });

      instance.delete<{ Params: { id: string } }>("/sessions/:id", async (req, reply) => {
        const user = requireAuth(req);
        const revoked = await revokeSession(req.params.id, user.id);
        if (!revoked) throw notFound("Session not found");
        if (req.params.id === user.sessionId) clearSessionCookie(reply);
        return reply.status(204).send();
      });

      instance.delete("/sessions", async (req, reply) => {
        const user = requireAuth(req);
        await revokeAllSessions(user.id);
        clearSessionCookie(reply);
        return reply.status(204).send();
      });
    },
    { prefix: "/api/v1/me" },
  );

  // Domain module routes (/api/v1/*)
  await fastify.register(sellerRoutes, { prefix: "/api/v1" });
  await fastify.register(catalogRoutes, { prefix: "/api/v1" });
  await fastify.register(ordersRoutes, { prefix: "/api/v1" });
  await fastify.register(walletRoutes, { prefix: "/api/v1" });
  await fastify.register(inboxRoutes, { prefix: "/api/v1" });
  await fastify.register(notificationsRoutes, { prefix: "/api/v1" });
  await fastify.register(adminRoutes, { prefix: "/api/v1" });
  await fastify.register(storageRoutes, { prefix: "/api/v1" });

  fastify.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { message: "Route not found" } });
  });

  return fastify;
}
