import type { OrderStatus } from "@/lib/constants/order-status";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

// Dates are formatted in UTC so server and client render identical text (no hydration mismatch).
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const monthYearFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Sep 30, 2026" */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** "Sep 30, 2:05 PM UTC" */
export function formatDateTime(iso: string): string {
  return `${dateTimeFmt.format(new Date(iso))} UTC`;
}

/** "Jan 2024" (seller card "Member since") */
export function formatMonthYear(iso: string): string {
  return monthYearFmt.format(new Date(iso));
}

/**
 * Relative time against an explicit `nowMs` (pass the server's now, not Date.now(),
 * so server and client agree): "In 22 hours", "3 hours ago", "Just now".
 */
export function formatRelative(iso: string, nowMs: number): string {
  const diff = new Date(iso).getTime() - nowMs;
  const abs = Math.abs(diff);
  const future = diff > 0;
  let value: number;
  let unit: string;
  if (abs < 60_000) return "Just now";
  if (abs < HOUR_MS) [value, unit] = [Math.round(abs / 60_000), "minute"];
  else if (abs < DAY_MS) [value, unit] = [Math.round(abs / HOUR_MS), "hour"];
  else [value, unit] = [Math.round(abs / DAY_MS), "day"];
  const text = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return future ? `In ${text}` : `${text} ago`;
}

/**
 * Offset between the server clock and this device. Countdowns must use server time,
 * because user device clocks drift. Pass the `serverNow` the API returned.
 */
export function clockOffsetMs(serverNowIso: string, clientNowMs: number = Date.now()): number {
  return new Date(serverNowIso).getTime() - clientNowMs;
}

interface LateInput {
  status: OrderStatus;
  deadline: string | null;
  revisionDeadline: string | null;
}

/** ORD-11 / PRD §10.3 late formula. Display only — the server is the source of truth. */
export function isLate(order: LateInput, nowMs: number): boolean {
  if (order.status === "IN_PROGRESS" && order.deadline) {
    return nowMs > new Date(order.deadline).getTime();
  }
  if (order.status === "IN_REVISION" && order.revisionDeadline) {
    return nowMs > new Date(order.revisionDeadline).getTime();
  }
  return false;
}

export interface Remaining {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  overdue: boolean;
}

export function remainingUntil(targetIso: string, nowMs: number): Remaining {
  const totalMs = new Date(targetIso).getTime() - nowMs;
  const abs = Math.abs(totalMs);
  return {
    totalMs,
    hours: Math.floor(abs / HOUR_MS),
    minutes: Math.floor((abs % HOUR_MS) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1000),
    overdue: totalMs < 0,
  };
}

/** "71h : 42m" as in the §16.4 workspace wireframe. */
export function formatRemaining(r: Remaining): string {
  const text = `${r.hours}h : ${String(r.minutes).padStart(2, "0")}m`;
  return r.overdue ? `${text} overdue` : `${text} left`;
}
