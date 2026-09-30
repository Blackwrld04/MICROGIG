import type { GigSearchQuery } from "@/modules/catalog/contracts";

/** Builds a /gigs URL from the current query plus overrides. Filters live in the URL so results are shareable. */
export function catalogHref(current: Partial<GigSearchQuery>, overrides: Partial<GigSearchQuery>): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["search", "category", "subcategory", "sort"] as const) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `/gigs?${qs}` : "/gigs";
}
