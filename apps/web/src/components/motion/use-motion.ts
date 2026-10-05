"use client";

import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A counter that goes up each time `value` changes after the first render. Use it as a React
 * `key` to replay a CSS animation (e.g. a status badge pop) only on real changes, never on load.
 */
export function useChangeKey(value: unknown): number {
  const [key, setKey] = useState(0);
  const previous = useRef(value);
  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setKey((k) => k + 1);
  }, [value]);
  return key;
}

/**
 * Ids that appeared after the first render (e.g. a message just sent, a new ledger row), so
 * only those get an entrance animation. Items present on load stay still.
 */
export function useNewIds(ids: string[]): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const signature = ids.join("|");

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !seen.current!.has(id));
    for (const id of ids) seen.current.add(id);
    if (added.length > 0) setFresh(new Set(added));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` captures `ids`
  }, [signature]);

  return fresh;
}
