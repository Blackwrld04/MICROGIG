"use client";

import { useEffect, useState } from "react";
import { clockOffsetMs, formatRemaining, remainingUntil } from "@/lib/time";
import { cn } from "@/lib/utils";

const DUE_SOON_MS = 6 * 60 * 60 * 1000;

/**
 * Order countdown (ORD-03, §16.4). Uses the server clock via `serverNow`, and renders
 * only after mount so server and client HTML match (no hydration mismatch).
 * Not an aria-live region: announcing every tick would be noisy for screen readers.
 */
export function Countdown({ target, serverNow, className }: { target: string; serverNow: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const offset = clockOffsetMs(serverNow);
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  if (now === null) {
    return <span className={cn("tabular-nums text-muted-foreground", className)}>--h : --m</span>;
  }

  const remaining = remainingUntil(target, now);
  // Under 6 hours left: a small pulsing dot draws the eye (decorative; the time itself says it).
  const dueSoon = !remaining.overdue && remaining.totalMs < DUE_SOON_MS;
  return (
    <span className="inline-flex items-center gap-1.5">
      {dueSoon || remaining.overdue ? (
        <span aria-hidden className="relative inline-flex h-2 w-2">
          <span className={cn("anim-ping absolute inline-flex h-full w-full rounded-full", remaining.overdue ? "bg-red-500" : "bg-amber-500")} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", remaining.overdue ? "bg-red-600" : "bg-amber-500")} />
        </span>
      ) : null}
      <time
        dateTime={target}
        className={cn("tabular-nums font-semibold", remaining.overdue ? "text-red-700" : "text-heading", className)}
      >
        {formatRemaining(remaining)}
      </time>
    </span>
  );
}
