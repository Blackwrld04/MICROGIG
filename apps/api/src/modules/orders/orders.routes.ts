import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  placeOrder,
  listUserOrders,
  getOrderWorkspace,
  submitRequirements,
  submitDelivery,
  acceptDelivery,
  requestRevision,
  cancelOrder,
  openDispute,
  submitReview,
  toggleOrderStar,
  listOrderMessages,
  sendOrderMessage,
} from "./orders.service.js";
import { requireAuth, requireRole } from "../../plugins/authenticate.js";
import { unprocessable } from "../../errors.js";
import { withIdempotency } from "../../lib/idempotency.js";

const placeOrderBody = z.object({
  gigId: z.string().min(1),
});

const requirementsBody = z.object({
  answers: z.array(z.string().trim().min(1)).min(1),
});

const deliveryBody = z.object({
  fileName:   z.string().min(1, "File name is required"),
  fileSize:   z.number().int().min(1, "File size must be greater than 0"),
  sha256:     z.string().regex(/^[a-fA-F0-9]{64}$/, "sha256 must be a 64-character hex digest"),
  storageKey: z.string().min(1).optional(),
  fileKey:    z.string().min(1).optional(),
  kind:       z.enum(["image", "archive", "document"]).optional(),
  fileTree:   z.array(z.string()).nullish(), // ignored: the server reads the ZIP itself
  notes:      z.string().default(""),
});

const revisionBody = z.object({
  feedback: z.string().trim().min(20, "At least 20 characters of feedback required"),
});

const disputeBody = z.object({
  reason: z.string().trim().min(50, "At least 50 characters of reason required"),
});

const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  body:   z.string().trim().max(500).optional(),
});

const messageBody = z.object({
  body:           z.string().trim().min(1).max(5000),
  attachmentName: z.string().max(255).optional(),
});

// PRD 13.2: 30 messages per user per minute.
const messageRateLimit = {
  rateLimit: {
    max: 30,
    timeWindow: "1 minute",
    hook: "preHandler" as const,
    keyGenerator: (req: FastifyRequest) => `messages:${req.user?.id ?? req.ip}`,
  },
};

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.post("/orders", async (req, reply) => {
    const user = requireRole(req, "CLIENT");
    const parsed = placeOrderBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Gig ID is required");
    // A retried checkout with the same Idempotency-Key returns the first order, never a second one.
    return withIdempotency(req, reply, user.id, 201, async () => {
      const result = await placeOrder(user.id, parsed.data.gigId);
      return { ...result, orderId: result.order.id, id: result.order.id };
    });
  });

  fastify.get("/orders/user/me", async (req, reply) => {
    const user = requireAuth(req);
    const q = req.query as { tab?: string; q?: string };
    const result = await listUserOrders(user, q.tab ?? "active", q.q);
    return reply.send(result);
  });

  fastify.get("/orders/:id", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const result = await getOrderWorkspace(user, id);
    return reply.send(result);
  });

  fastify.post("/orders/:id/requirements", async (req, reply) => {
    const user = requireRole(req, "CLIENT");
    const { id } = req.params as { id: string };
    const parsed = requirementsBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Answers are required");
    const result = await submitRequirements(user, id, parsed.data.answers);
    return reply.send(result);
  });

  fastify.post("/orders/:id/deliveries", async (req, reply) => {
    const user = requireRole(req, "FREELANCER");
    const { id } = req.params as { id: string };
    const parsed = deliveryBody.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Invalid"]),
      );
      throw unprocessable("Invalid delivery payload", fieldErrors);
    }
    const result = await submitDelivery(user, id, parsed.data);
    return reply.status(201).send(result);
  });

  fastify.post("/orders/:id/complete", async (req, reply) => {
    const user = requireRole(req, "CLIENT");
    const { id } = req.params as { id: string };
    return withIdempotency(req, reply, user.id, 200, () => acceptDelivery(user, id));
  });

  fastify.post("/orders/:id/revision", async (req, reply) => {
    const user = requireRole(req, "CLIENT");
    const { id } = req.params as { id: string };
    const parsed = revisionBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable(parsed.error.errors[0]?.message ?? "Invalid feedback");
    const result = await requestRevision(user, id, parsed.data.feedback);
    return reply.send(result);
  });

  fastify.post("/orders/:id/cancel", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const result = await cancelOrder(user, id);
    return reply.send(result);
  });

  fastify.post("/orders/:id/dispute", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const parsed = disputeBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable(parsed.error.errors[0]?.message ?? "Invalid dispute reason");
    return withIdempotency(req, reply, user.id, 200, () => openDispute(user, id, parsed.data.reason));
  });

  fastify.post("/orders/:id/review", async (req, reply) => {
    const user = requireRole(req, "CLIENT");
    const { id } = req.params as { id: string };
    const parsed = reviewBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Rating (1-5) is required");
    const result = await submitReview(user, id, parsed.data.rating, parsed.data.body);
    return reply.send(result);
  });

  fastify.post("/orders/:id/star", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const result = await toggleOrderStar(user.id, id);
    return reply.send(result);
  });

  fastify.get("/orders/:id/messages", async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const msgs = await listOrderMessages(user.id, id);
    return reply.send(msgs);
  });

  fastify.post("/orders/:id/messages", { config: messageRateLimit }, async (req, reply) => {
    const user = requireAuth(req);
    const { id } = req.params as { id: string };
    const parsed = messageBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Message body is required");
    const result = await sendOrderMessage(user, id, parsed.data.body, parsed.data.attachmentName);
    return reply.send(result);
  });
}
