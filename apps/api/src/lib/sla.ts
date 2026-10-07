const HOUR_MS = 60 * 60 * 1000;

export type SlaThreshold = 50 | 90 | 100;

/**
 * NOT-01 (7): which late-delivery warnings are due for an order. The SLA window is the
 * turnaround while IN_PROGRESS and the revision window while IN_REVISION; warnings fire at
 * 50% and 90% elapsed and again once the deadline has passed (100).
 */
export function slaThresholdsReached(
  order: {
    status: string;
    deadline: Date | null;
    revisionDeadline: Date | null;
    turnaroundHours: number;
  },
  revisionWindowHours: number,
  now: number,
): { thresholds: SlaThreshold[]; deadline: Date } | null {
  const deadline = order.status === "IN_REVISION" ? order.revisionDeadline : order.status === "IN_PROGRESS" ? order.deadline : null;
  if (!deadline) return null;

  const windowMs = (order.status === "IN_REVISION" ? revisionWindowHours : order.turnaroundHours) * HOUR_MS;
  const start = deadline.getTime() - windowMs;
  const elapsed = (now - start) / windowMs;

  const thresholds: SlaThreshold[] = [];
  if (elapsed >= 0.5) thresholds.push(50);
  if (elapsed >= 0.9) thresholds.push(90);
  if (elapsed >= 1) thresholds.push(100);
  return { thresholds, deadline };
}

/** Same deadline + same threshold = same key, so a warning is sent once per deadline. */
export function slaDedupeKey(orderId: string, deadline: Date, threshold: SlaThreshold) {
  return `sla:${orderId}:${deadline.toISOString()}:${threshold}`;
}
