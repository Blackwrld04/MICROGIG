import { z } from "zod";

/** GET /api/v1/wallet — PRD §11.6 / §12.6. All values integer cents. */
export const walletSummarySchema = z.object({
  available: z.number().int(),
  pending: z.number().int(),
  inActiveOrders: z.number().int(),
  lifetimeEarnings: z.number().int(),
});
export type WalletSummary = z.infer<typeof walletSummarySchema>;

/** Appendix B `LedgerEntryType`. */
export const LEDGER_ENTRY_TYPES = [
  "TOP_UP",
  "ORDER_PLACED",
  "ORDER_COMPLETED",
  "CLEARING",
  "ORDER_REFUNDED",
  "WITHDRAWAL",
  "DISPUTE_ADJUSTMENT",
] as const;
