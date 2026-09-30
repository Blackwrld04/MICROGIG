import { describe, expect, it } from "vitest";
import { buildMockOrders } from "@/mocks/orders";
import { applyAction, availableActions } from "./state-machine";
import { tabCounts } from "./tabs";
import type { OrderDetail } from "./types";

const NOW = new Date("2026-09-30T12:00:00Z").getTime();
const H = 60 * 60 * 1000;
const orders = buildMockOrders(NOW);
const byId = (id: string) => orders.find((o) => o.id === id)!;

describe("availableActions (PRD §10.1)", () => {
  it("buyer on a pending order can submit requirements or cancel (T-02, T-03)", () => {
    expect(availableActions(byId("84931"), "buyer", NOW)).toEqual(["SUBMIT_REQUIREMENTS", "CANCEL_UNSTARTED"]);
  });

  it("buyer on a delivered order can accept, request revision, or dispute (T-05, T-07, T-09)", () => {
    expect(availableActions(byId("84920"), "buyer", NOW)).toEqual(["ACCEPT", "REQUEST_REVISION", "OPEN_DISPUTE"]);
  });

  it("revision is unavailable once the quota is used (ORD-13)", () => {
    const exhausted: OrderDetail = { ...byId("84920"), revisionsUsed: 2 };
    expect(availableActions(exhausted, "buyer", NOW)).not.toContain("REQUEST_REVISION");
  });

  it("late remedy appears only 24h past the deadline (ORD-15 / T-13)", () => {
    const o = byId("84918"); // deadline 26h ago
    expect(availableActions(o, "buyer", NOW)).toContain("LATE_CANCEL");
    const barelyLate: OrderDetail = { ...o, deadline: new Date(NOW - 2 * H).toISOString() };
    expect(availableActions(barelyLate, "buyer", NOW)).not.toContain("LATE_CANCEL");
  });

  it("seller can deliver while in progress or in revision (T-04, T-08)", () => {
    expect(availableActions(byId("84925"), "seller", NOW)).toContain("DELIVER");
    expect(availableActions(byId("84912"), "seller", NOW)).toEqual(["DELIVER"]);
  });

  it("nothing is actionable on disputed or cancelled orders", () => {
    expect(availableActions(byId("84905"), "seller", NOW)).toEqual([]);
    expect(availableActions(byId("84870"), "seller", NOW)).toEqual([]);
  });

  it("buyer can review within 14 days of completion (REV-01)", () => {
    expect(availableActions(byId("84890"), "buyer", NOW)).toEqual(["LEAVE_REVIEW"]);
    expect(availableActions(byId("84890"), "buyer", NOW + 15 * 24 * H)).toEqual([]);
  });
});

describe("applyAction", () => {
  it("submitting requirements starts the clock (T-02)", () => {
    const next = applyAction(byId("84931"), { type: "SUBMIT_REQUIREMENTS", answers: ["a", "b"] }, "buyer", NOW);
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.deadline).toBe(new Date(NOW + 48 * H).toISOString());
  });

  it("a revision increments the quota and sets a 24h revision deadline (T-07)", () => {
    const next = applyAction(byId("84920"), { type: "REQUEST_REVISION", feedback: "x".repeat(20) }, "buyer", NOW);
    expect(next.status).toBe("IN_REVISION");
    expect(next.revisionsUsed).toBe(2);
    expect(next.revisionDeadline).toBe(new Date(NOW + 24 * H).toISOString());
    expect(next.autoCompleteAt).toBeNull();
  });

  it("delivering schedules auto-complete 72h out (T-04)", () => {
    const next = applyAction(
      byId("84925"),
      { type: "DELIVER", delivery: { fileName: "fix.zip", fileSize: 1000, sha256: "x", kind: "archive", fileTree: null, notes: "done" } },
      "seller",
      NOW,
    );
    expect(next.status).toBe("DELIVERED");
    expect(next.autoCompleteAt).toBe(new Date(NOW + 72 * H).toISOString());
    expect(next.deliveries.at(-1)?.sequenceNo).toBe(1);
  });

  it("mutual cancellation needs the counterparty (T-14)", () => {
    const asked = applyAction(byId("84925"), { type: "REQUEST_MUTUAL_CANCEL" }, "seller", NOW);
    expect(asked.status).toBe("IN_PROGRESS");
    expect(availableActions(asked, "buyer", NOW)).toContain("ACCEPT_MUTUAL_CANCEL");
    const done = applyAction(asked, { type: "ACCEPT_MUTUAL_CANCEL" }, "buyer", NOW);
    expect(done.status).toBe("CANCELLED");
  });

  it("rejects actions the guards don't allow", () => {
    expect(() => applyAction(byId("84920"), { type: "DELIVER", delivery: {} as never }, "buyer", NOW)).toThrow();
  });
});

describe("Manage Orders tab counts (ORD-12)", () => {
  it("counts buyer tabs", () => {
    const buyer = orders.filter((o) => o.viewerRole === "buyer");
    expect(tabCounts(buyer, NOW)).toMatchObject({ priority: 2, late: 1, delivered: 1, completed: 1, starred: 1 });
  });
});
