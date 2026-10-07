import { describe, expect, it } from "vitest";
import { slaThresholdsReached, slaDedupeKey } from "../../src/lib/sla.js";
import { platformFeeCents, sellerNetCents, splitEscrow } from "../../src/lib/money.js";

const HOUR = 60 * 60 * 1000;

describe("slaThresholdsReached", () => {
  const deadline = new Date("2026-01-02T00:00:00Z"); // 24h order placed 2026-01-01T00:00Z
  const order = { status: "IN_PROGRESS", deadline, revisionDeadline: null, turnaroundHours: 24 };

  it("fires 50% and 90% warnings, then overdue", () => {
    expect(slaThresholdsReached(order, 24, deadline.getTime() - 13 * HOUR)?.thresholds).toEqual([]);
    expect(slaThresholdsReached(order, 24, deadline.getTime() - 12 * HOUR)?.thresholds).toEqual([50]);
    expect(slaThresholdsReached(order, 24, deadline.getTime() - 2 * HOUR)?.thresholds).toEqual([50, 90]);
    expect(slaThresholdsReached(order, 24, deadline.getTime() + 1)?.thresholds).toEqual([50, 90, 100]);
  });

  it("uses the revision deadline and window while IN_REVISION", () => {
    const rev = { ...order, status: "IN_REVISION", revisionDeadline: new Date(deadline.getTime() + 48 * HOUR) };
    const r = slaThresholdsReached(rev, 24, deadline.getTime() + 36 * HOUR);
    expect(r?.deadline).toEqual(rev.revisionDeadline);
    expect(r?.thresholds).toEqual([50]);
  });

  it("ignores orders without an active deadline", () => {
    expect(slaThresholdsReached({ ...order, status: "DELIVERED" }, 24, Date.now())).toBeNull();
  });

  it("keys warnings per deadline so a new revision round warns again", () => {
    expect(slaDedupeKey("o1", deadline, 50)).not.toBe(slaDedupeKey("o1", new Date(deadline.getTime() + HOUR), 50));
  });
});

describe("money (PRD 11.5)", () => {
  it("rounds the fee half-up and gives the seller the remainder", () => {
    expect(platformFeeCents(3500, 2000)).toBe(700);
    expect(platformFeeCents(999, 2000)).toBe(200); // 199.8 -> 200
    expect(sellerNetCents(999, 2000)).toBe(799);
  });

  it("splits escrow without losing a cent", () => {
    for (const bps of [0, 2500, 5000, 7333, 10000]) {
      const { buyer, seller, platform } = splitEscrow(4999, 2000, bps);
      expect(buyer + seller + platform).toBe(4999);
    }
  });
});
