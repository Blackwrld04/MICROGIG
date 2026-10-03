import { ApiError } from "../errors.js";

export const GIG_MIN_PRICE_CENTS = 500;   // $5.00
export const GIG_MAX_PRICE_CENTS = 5000;  // $50.00

export function platformFeeCents(priceCents: number, feeRateBps: number): number {
  return Math.floor((priceCents * feeRateBps + 5000) / 10000);
}

export function sellerNetCents(priceCents: number, feeRateBps: number): number {
  return priceCents - platformFeeCents(priceCents, feeRateBps);
}

export function splitEscrow(
  priceCents: number,
  feeRateBps: number,
  buyerRefundBps: number,
) {
  const buyer = Math.floor((priceCents * buyerRefundBps + 5000) / 10000);
  const remainder = priceCents - buyer;
  const platform = platformFeeCents(remainder, feeRateBps);
  return { buyer, seller: remainder - platform, platform };
}

export function assertZeroSum(legs: { amountCents: number }[]): void {
  const sum = legs.reduce((acc, l) => acc + l.amountCents, 0);
  if (sum !== 0) {
    throw new Error(`Ledger invariant violated: legs sum to ${sum} (expected 0)`);
  }
}

export function assertSufficientBalance(
  balanceCents: number,
  requiredCents: number,
): void {
  if (balanceCents < requiredCents) {
    throw new ApiError(
      `Insufficient balance. Need $${(requiredCents / 100).toFixed(2)}, have $${(balanceCents / 100).toFixed(2)}.`,
      402,
    );
  }
}

export function isValidGigPrice(cents: number): boolean {
  return Number.isInteger(cents) && cents >= GIG_MIN_PRICE_CENTS && cents <= GIG_MAX_PRICE_CENTS;
}
