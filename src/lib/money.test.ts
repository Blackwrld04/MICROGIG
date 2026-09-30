import { describe, expect, it } from "vitest";
import {
  formatCents,
  formatSignedCents,
  isValidGigPrice,
  parseDollarsToCents,
  platformFeeCents,
  splitEscrow,
} from "./money";

describe("formatCents", () => {
  it("formats integer cents as USD", () => {
    expect(formatCents(2500)).toBe("$25.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(-1500)).toBe("-$15.00");
  });

  it("signs ledger amounts", () => {
    expect(formatSignedCents(2000)).toBe("+$20.00");
    expect(formatSignedCents(-1500)).toBe("-$15.00");
  });
});

describe("parseDollarsToCents", () => {
  it.each([
    ["25", 2500],
    ["25.5", 2550],
    ["25.50", 2550],
    ["$25.00", 2500],
    ["0.29", 29], // 0.29 * 100 is 28.999… in floats
  ])("%s -> %i", (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "25.505", "-5", "1,000"])("rejects %j", (input) => {
    expect(parseDollarsToCents(input)).toBeNull();
  });
});

describe("platform fee and dispute split (§11.5, T-12)", () => {
  it("computes the fee with round half-up", () => {
    expect(platformFeeCents(3500, 2000)).toBe(700);
    expect(platformFeeCents(2525, 2000)).toBe(505);
    expect(platformFeeCents(2503, 2000)).toBe(501); // 500.6 -> 501
  });

  it.each([0, 2500, 5000, 3333, 10000])("split with buyer %i bps always sums to the price", (bps) => {
    const s = splitEscrow(5000, 2000, bps);
    expect(s.buyer + s.seller + s.platform).toBe(5000);
  });

  it("full refund and full release match T-11 / T-10", () => {
    expect(splitEscrow(3500, 2000, 10000)).toEqual({ buyer: 3500, seller: 0, platform: 0 });
    expect(splitEscrow(3500, 2000, 0)).toEqual({ buyer: 0, seller: 2800, platform: 700 });
  });
});

describe("isValidGigPrice (GIG-02: $5–$50)", () => {
  it("accepts the inclusive bounds", () => {
    expect(isValidGigPrice(500)).toBe(true);
    expect(isValidGigPrice(5000)).toBe(true);
  });

  it("rejects out-of-range and non-integer cents", () => {
    expect(isValidGigPrice(499)).toBe(false);
    expect(isValidGigPrice(5001)).toBe(false);
    expect(isValidGigPrice(2500.5)).toBe(false);
  });
});
