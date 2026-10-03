import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { db } from "../db/connection.js";
import { sessions, users } from "../db/schema/index.js";
import { eq, and, isNull } from "drizzle-orm";
import { unauthorized, forbidden } from "../errors.js";
import type { AuthUser } from "../types/auth.js";

const COOKIE_NAME = "sid";

const authenticatePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("preHandler", async (req: FastifyRequest) => {
    const sid = req.cookies?.[COOKIE_NAME] || req.cookies?.["__Host-sid"];
    if (!sid) return;

    const now = new Date();

    const row = await db
      .select({
        sessionId:   sessions.id,
        expiresAt:   sessions.expiresAt,
        revokedAt:   sessions.revokedAt,
        userId:      users.id,
        email:       users.email,
        fullName:    users.fullName,
        accountType: users.accountType,
        isAdmin:     users.isAdmin,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, sid), isNull(sessions.revokedAt)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!row) return;
    if (row.expiresAt < now) return;

    req.user = {
      id:          row.userId,
      email:       row.email,
      fullName:    row.fullName,
      accountType: row.accountType,
      isAdmin:     row.isAdmin,
      isSeller:    row.accountType === "FREELANCER",
      sessionId:   row.sessionId,
    };
  });
};

export default fp(authenticatePlugin, { name: "authenticate" });

export function requireAuth(req: FastifyRequest): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(
  req: FastifyRequest,
  accountType: "CLIENT" | "FREELANCER",
): AuthUser {
  const user = requireAuth(req);
  if (user.accountType !== accountType) {
    throw forbidden(`Only ${accountType.toLowerCase()} accounts can do this.`);
  }
  return user;
}

export function requireAdmin(req: FastifyRequest): AuthUser {
  const user = requireAuth(req);
  if (!user.isAdmin) throw forbidden("Admin access required.");
  return user;
}

export function setSessionCookie(reply: FastifyReply, sessionId: string, isProd: boolean) {
  reply.setCookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    secure:   isProd,
    maxAge:   60 * 60 * 24 * 30, // 30 days
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}
