import { describe, expect, it } from "vitest";
import { detectContactLeakage } from "./leakage";

describe("detectContactLeakage (MSG-03)", () => {
  it.each([
    "email me at dev@example.com",
    "call +1 415-555-0199",
    "ping me on t.me/alex",
    "pay via paypal.me/alex",
    "join zoom.us/j/123",
  ])("flags %j", (text) => {
    expect(detectContactLeakage(text)).toBe(true);
  });

  it("does not flag normal order chat", () => {
    expect(detectContactLeakage("The nav overlaps the hero below 400px.")).toBe(false);
  });

  it("is stable across repeated calls (no /g lastIndex bug)", () => {
    const text = "dev@example.com";
    expect([1, 2, 3, 4].map(() => detectContactLeakage(text))).toEqual([true, true, true, true]);
  });
});
