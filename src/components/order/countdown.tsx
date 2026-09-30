"use client";

import { useEffect, useState } from "react";
import { clockOffsetMs, formatRemaining, remainingUntil } from "@/lib/time";
import { cn } from "@/lib/utils";

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
  return (
    <time
      dateTime={target}
      className={cn("tabular-nums font-semibold", remaining.overdue ? "text-red-700" : "text-heading", className)}
    >
      {formatRemaining(remaining)}
    </time>
  );
}
