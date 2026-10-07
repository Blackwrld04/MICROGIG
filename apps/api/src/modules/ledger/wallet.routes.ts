import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getWalletData, topUpWallet, withdrawWallet } from "./wallet.service.js";
import { requireAuth, requireRole } from "../../plugins/authenticate.js";
import { unprocessable } from "../../errors.js";
import { withIdempotency } from "../../lib/idempotency.js";

/** RFC 4180 field; also neutralises spreadsheet formula injection (=, +, -, @). */
function csvField(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

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
    return withIdempotency(req, reply, user.id, 200, () => topUpWallet(user.id, parsed.data.amountCents));
  };

  fastify.post("/wallet/topup", handleTopUp);
  fastify.post("/wallet/top-up", handleTopUp);

  // Wallet activity export: JSON by default, CSV with ?format=csv.
  fastify.get("/wallet/activity", async (req, reply) => {
    const user = requireAuth(req);
    const { activity } = await getWalletData(user);
    if ((req.query as { format?: string }).format !== "csv") return reply.send(activity);

    const header = ["Date", "Description", "Type", "Amount (USD)", "Balance (USD)", "Transaction ID"];
    const lines = activity.map((r) =>
      [r.createdAt, r.description, r.type, (r.amountCents / 100).toFixed(2), (r.balanceCents / 100).toFixed(2), r.txnId].map(csvField).join(","),
    );
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="microgig-wallet-activity.csv"')
      .send([header.join(","), ...lines].join("\r\n") + "\r\n");
  });

  fastify.post("/wallet/withdraw", async (req, reply) => {
    const user   = requireRole(req, "FREELANCER");
    const parsed = withdrawBody.safeParse(req.body);
    if (!parsed.success) throw unprocessable(parsed.error.errors[0]?.message ?? "Invalid amount");
    return withIdempotency(req, reply, user.id, 200, () => withdrawWallet(user.id, parsed.data.amountCents));
  });
}
