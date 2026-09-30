import { describe, expect, it } from "vitest";
import { clockOffsetMs, formatRemaining, isLate, remainingUntil } from "./time";

const NOW = new Date("2026-09-30T12:00:00Z").getTime();
const PAST = "2026-09-30T11:00:00Z";
const FUTURE = "2026-09-30T13:00:00Z";

describe("isLate (PRD §10.3)", () => {
  it("uses deadline while IN_PROGRESS", () => {
    expect(isLate({ status: "IN_PROGRESS", deadline: PAST, revisionDeadline: null }, NOW)).toBe(true);
    expect(isLate({ status: "IN_PROGRESS", deadline: FUTURE, revisionDeadline: null }, NOW)).toBe(false);
  });

  it("uses revision_deadline while IN_REVISION, ignoring the original deadline", () => {
    expect(isLate({ status: "IN_REVISION", deadline: PAST, revisionDeadline: FUTURE }, NOW)).toBe(false);
    expect(isLate({ status: "IN_REVISION", deadline: FUTURE, revisionDeadline: PAST }, NOW)).toBe(true);
  });

  it("is never late once delivered (clock paused)", () => {
    expect(isLate({ status: "DELIVERED", deadline: PAST, revisionDeadline: null }, NOW)).toBe(false);
  });
});

describe("countdown helpers", () => {
  it("computes the server clock offset", () => {
    expect(clockOffsetMs("2026-09-30T12:00:05Z", NOW)).toBe(5000);
  });

  it("formats remaining and overdue time", () => {
    const later = remainingUntil("2026-10-03T11:42:00Z", NOW);
    expect(formatRemaining(later)).toBe("71h : 42m left");
    expect(formatRemaining(remainingUntil(PAST, NOW))).toBe("1h : 00m overdue");
  });
});
