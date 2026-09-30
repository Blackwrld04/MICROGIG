"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { GigSort } from "@/modules/catalog/contracts";

const LABELS: Record<GigSort, string> = {
  rating_desc: "Top rated",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  delivery_time_asc: "Fastest delivery",
};

/** GIG-06 sort control. Updates the URL; the Server Component re-renders with new results. */
export function SortSelect({ value }: { value: GigSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set("sort", next);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 font-semibold text-heading"
      >
        {Object.entries(LABELS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
