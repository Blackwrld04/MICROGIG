import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { catalogHref } from "@/components/gig/catalog-href";
import { CatalogResults } from "@/components/gig/catalog-results";
import { FilterChip } from "@/components/gig/filter-chip";
import { serverData } from "@/lib/api/server-data";
import { CATEGORIES, findCategory } from "@/lib/constants/categories";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { gigSearchQuerySchema } from "@/modules/catalog/contracts";

export const metadata: Metadata = { title: "Browse gigs" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Marketplace catalog — PRD §16.1, GIG-05 / GIG-06. */
export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const parsed = gigSearchQuerySchema.safeParse({
    search: first(searchParams.search) || undefined,
    category: first(searchParams.category) || undefined,
    subcategory: first(searchParams.subcategory) || undefined,
    sort: first(searchParams.sort) || undefined,
    page: first(searchParams.page) ?? 1,
  });
  const query = parsed.success ? parsed.data : gigSearchQuerySchema.parse({});
  const category = findCategory(query.category);

  // Server fetch → TanStack cache → hydrated into <CatalogResults /> (no client refetch on load).
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ ...queries.gigs(query), queryFn: () => serverData.searchGigs(query) });

  return (
    <div className="container space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">
          {query.search ? `Results for “${query.search}”` : category ? category.name : "Browse micro-gigs"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Fixed price under $50 · delivered in 24–48 hours</p>
      </div>

      <nav aria-label="Filter by category" className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip href={catalogHref(query, { category: undefined, subcategory: undefined, page: 1 })} active={!category}>
            All
          </FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip
              key={c.slug}
              href={catalogHref(query, { category: c.slug, subcategory: undefined, page: 1 })}
              active={c.slug === category?.slug}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>
        {category ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip href={catalogHref(query, { subcategory: undefined, page: 1 })} active={!query.subcategory}>
              All {category.name}
            </FilterChip>
            {category.subcategories.map((s) => (
              <FilterChip
                key={s.slug}
                href={catalogHref(query, { subcategory: s.slug, page: 1 })}
                active={s.slug === query.subcategory}
              >
                {s.name}
              </FilterChip>
            ))}
          </div>
        ) : null}
      </nav>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <CatalogResults query={query} />
      </HydrationBoundary>
    </div>
  );
}
