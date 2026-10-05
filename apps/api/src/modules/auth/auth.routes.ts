import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  registerUser,
  sendVerificationCode,
  checkEmailAvailability,
  loginUser,
  revokeSession,
  revokeAllSessions,
  listUserSessions,
  getUserById,
} from "./auth.service.js";
import {
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
} from "../../plugins/authenticate.js";
import { env } from "../../env.js";
import { ApiError, notFound } from "../../errors.js";

const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/\d/, "Include at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Include at least 1 symbol");

const registerBody = z.object({
  accountType: z.enum(["CLIENT", "FREELANCER"], {
    errorMap: () => ({ message: "Choose client or freelancer" }),
  }),
  email:    z.string().email("Enter a valid email"),
  password: passwordSchema,
  fullName: z.string().trim().min(1, "Enter your full name").max(120),
  code:     z.string().trim().min(4, "Enter the confirmation code").max(10).optional(),
});

const sendCodeBody = z.object({
  email: z.string().email("Enter a valid email"),
});

const loginBody = z.object({
  email:    z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function authRoutes(fastify: FastifyInstance) {
  const isProd = env.NODE_ENV === "production";

  fastify.all("/check-email", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
  }, async (req, reply) => {
    const queryEmail = (req.query as Record<string, string>)?.email;
    const bodyEmail = (req.body as Record<string, string>)?.email;
    const rawEmail = (queryEmail || bodyEmail || "").trim();
    const parsed = z.string().email().safeParse(rawEmail);
    if (!parsed.success) {
      return reply.send({ exists: false, message: "Invalid email" });
    }
    const result = await checkEmailAvailability(parsed.data);
    return reply.send(result);
  });

  fastify.post("/send-code", {
    config: {
      rateLimit: {
        max: 6,
        timeWindow: "1 minute",
      },
    },
  }, async (req, reply) => {
    const parsed = sendCodeBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError("Please enter a valid email.", 422, {
        email: "Invalid email",
      });
    }

    const res = await sendVerificationCode(parsed.data.email);
    return reply.send(res);
  });

  fastify.post("/register", {
    config: {
      rateLimit: {
        max: 15,
        timeWindow: "1 minute",
      },
    },
  }, async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Invalid"]),
      );
      throw new ApiError("Validation failed", 422, fieldErrors);
    }

    const { sessionId, user } = await registerUser({
      ...parsed.data,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    const userPayload = {
      id:          user.id,
      email:       user.email,
      fullName:    user.fullName,
      accountType: user.accountType,
      isAdmin:     user.isAdmin,
      isSeller:    user.isSeller,
    };

    setSessionCookie(reply, sessionId, isProd);
    return reply.status(201).send({
      ...userPayload,
      user: userPayload,
    });
  });

  fastify.post("/login", {
    config: {
      rateLimit: {
        max: 15,
        timeWindow: "1 minute",
      },
    },
  }, async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError("Invalid request body", 422);
    }

    const { sessionId, user } = await loginUser(parsed.data.email, parsed.data.password, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    setSessionCookie(reply, sessionId, isProd);

    const userPayload = {
      id:          user.id,
      email:       user.email,
      fullName:    user.fullName,
      accountType: user.accountType,
      isAdmin:     user.isAdmin,
      isSeller:    user.isSeller,
    };

    return reply.send({
      ...userPayload,
      user: userPayload,
    });
  });

  fastify.post("/logout", async (req, reply) => {
    const user = requireAuth(req);
    await revokeSession(user.sessionId, user.id);
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  fastify.get("/me", async (req, reply) => {
    const user = requireAuth(req);
    const fresh = await getUserById(user.id);
    return reply.send({
      id:          fresh.id,
      email:       fresh.email,
      fullName:    fresh.fullName,
      accountType: fresh.accountType,
      isAdmin:     fresh.isAdmin,
      isSeller:    fresh.isSeller,
    });
  });

  fastify.get("/sessions", async (req, reply) => {
    const user = requireAuth(req);
    const sessions = await listUserSessions(user.id, user.sessionId);
    return reply.send(sessions);
  });

  fastify.delete("/sessions/:id", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const revoked = await revokeSession(id, user.id);
    if (!revoked) throw notFound("Session not found");
    if (id === user.sessionId) clearSessionCookie(reply);
    return reply.status(204).send();
  });

  fastify.delete("/sessions", async (req, reply) => {
    const user = requireAuth(req);
    await revokeAllSessions(user.id);
    clearSessionCookie(reply);
    return reply.status(204).send();
  });
}
