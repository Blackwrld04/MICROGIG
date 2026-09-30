import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

/** WCAG 2.1 relative luminance / contrast ratio (SC 1.4.3 and 1.4.11). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const c = config.theme!.extend!.colors as any;

const TEXT_AA = 4.5; // SC 1.4.3 normal text
const NON_TEXT_AA = 3; // SC 1.4.11 focus indicators, UI boundaries

describe("design tokens meet WCAG 2.1 AA", () => {
  it.each([
    ["body text on background", c.foreground, c.background],
    ["heading on background", c.heading, c.background],
    ["muted text on background", c.muted.foreground, c.background],
    ["muted text on surface", c.muted.foreground, c.surface],
    ["body text on surface", c.foreground, c.surface],
    ["primary button text", c.primary.foreground, c.primary.DEFAULT],
    ["primary button text (hover)", c.primary.foreground, c.primary.hover],
    ["destructive button text", c.destructive.foreground, c.destructive.DEFAULT],
  ])("%s ≥ 4.5:1", (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT_AA);
  });

  it("focus ring ≥ 3:1 against the page", () => {
    expect(contrast(c.ring, c.background)).toBeGreaterThanOrEqual(NON_TEXT_AA);
  });

  it("white text on the PRD green fails AA — keep charcoal on primary fills", () => {
    expect(contrast("#FFFFFF", c.primary.DEFAULT)).toBeLessThan(TEXT_AA);
  });
});
