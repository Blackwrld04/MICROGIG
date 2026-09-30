/**
 * Money helpers. All amounts are integer cents (PRD §11.5) — never do float math on prices.
 */

export const GIG_MIN_PRICE_CENTS = 500; // $5.00  (GIG-02)
export const GIG_MAX_PRICE_CENTS = 5000; // $50.00 (GIG-02)
export const PLATFORM_FEE_BPS = 2000; // 20.00% (Appendix A PLATFORM_FEE_BPS)

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 2500 -> "$25.00", -1500 -> "-$15.00" */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

/** Signed ledger amount for activity tables: 2000 -> "+$20.00", -1500 -> "-$15.00". */
export function formatSignedCents(cents: number): string {
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

/**
 * Parses a user-typed dollar amount into integer cents without float rounding errors.
 * Accepts "25", "25.5", "25.50", "$25.00". Returns null for anything else.
 */
export function parseDollarsToCents(input: string): number | null {
  const match = /^\$?\s*(\d{1,6})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  return dollars * 100 + cents;
}

/** Platform fee, round half-up — PRD §11.5: ⌊(price × bps + 5000) / 10000⌋. */
export function platformFeeCents(priceCents: number, feeRateBps: number): number {
  return Math.floor((priceCents * feeRateBps + 5000) / 10000);
}

/** Seller share is always price − fee (§11.5). */
export function sellerNetCents(priceCents: number, feeRateBps: number): number {
  return priceCents - platformFeeCents(priceCents, feeRateBps);
}

/**
 * Dispute split preview (T-12): buyer gets `buyerRefundBps` of the price (round half-up);
 * the remainder settles like a normal completion (fee on the remainder). Always sums to price.
 */
export function splitEscrow(priceCents: number, feeRateBps: number, buyerRefundBps: number) {
  const buyer = Math.floor((priceCents * buyerRefundBps + 5000) / 10000);
  const remainder = priceCents - buyer;
  const platform = platformFeeCents(remainder, feeRateBps);
  return { buyer, seller: remainder - platform, platform };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isValidGigPrice(cents: number): boolean {
  return Number.isInteger(cents) && cents >= GIG_MIN_PRICE_CENTS && cents <= GIG_MAX_PRICE_CENTS;
}
