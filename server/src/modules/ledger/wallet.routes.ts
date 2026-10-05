import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getWalletData, topUpWallet, withdrawWallet } from "./wallet.service.js";
import { requireAuth, requireRole } from "../../plugins/authenticate.js";
import { unprocessable } from "../../errors.js";

const topUpBody    = z.object({ amountCents: z.number().int().min(500, "Minimum $5.00 top-up").max(100000) });
const withdrawBody = z.object({ amountCents: z.number().int().min(500, "Minimum $5.00 withdrawal") });

export async function walletRoutes(fastify: FastifyInstance) {
  fastify.get("/wallet", async (req, reply) => {
    const user = requireAuth(req);
    return reply.send(await getWalletData(user));
  });

  const handleTopUp = async (req: any, reply: any) => {
    const user   = requireRole(req, "CLIENT");
    const parsed = topUpBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable(parsed.error.errors[0]?.message ?? "Invalid amount");
    return reply.send(await topUpWallet(user.id, parsed.data.amountCents));
  };

  fastify.post("/wallet/topup", handleTopUp);
  fastify.post("/wallet/top-up", handleTopUp);

  fastify.post("/wallet/withdraw", async (req, reply) => {
    const user   = requireRole(req, "FREELANCER");
    const parsed = withdrawBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable(parsed.error.errors[0]?.message ?? "Invalid amount");
    return reply.send(await withdrawWallet(user.id, parsed.data.amountCents));
  });
}
