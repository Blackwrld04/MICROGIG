import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listPendingVerifications, resolveVerification, listDisputedOrders, resolveDispute } from "./admin.service.js";
import { requireAdmin } from "../../plugins/authenticate.js";
import { unprocessable } from "../../errors.js";

const verificationPatchBody = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });
const disputeResolveBody = z
  .object({
    ruling:          z.enum(["BUYER", "SELLER", "SPLIT"]).optional(),
    outcome:         z.enum(["REFUND", "RELEASE", "SPLIT"]).optional(),
    buyerRefundBps:  z.number().int().min(0).max(10000).optional(),
    resolutionNotes: z.string().optional(),
    notes:           z.string().optional(),
  })
  .refine((data) => !!(data.ruling || data.outcome), {
    message: "Either ruling or outcome is required",
  });

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/verifications", async (req, reply) => {
    requireAdmin(req);
    return reply.send(await listPendingVerifications());
  });

  fastify.patch("/admin/verifications/:id", async (req, reply) => {
    requireAdmin(req);
    const { id } = req.params as { id: string };
    const parsed = verificationPatchBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Status must be APPROVED or REJECTED");
    return reply.send(await resolveVerification(id, parsed.data.status));
  });

  fastify.get("/admin/disputes", async (req, reply) => {
    const admin = requireAdmin(req);
    return reply.send(await listDisputedOrders(admin));
  });

  fastify.post("/admin/disputes/:id/resolve", async (req, reply) => {
    requireAdmin(req);
    const { id } = req.params as { id: string };
    const parsed = disputeResolveBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable("Invalid resolution payload");
    return reply.send(await resolveDispute(id, parsed.data));
  });
}
