"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { queries } from "@/lib/query/queries";
import { GIG_PAGE_SIZE, type GigSearchQuery } from "@/modules/catalog/contracts";
import { catalogHref } from "./catalog-href";
import { GigGrid } from "./gig-grid";
import { SortSelect } from "./sort-select";

/** Catalog results — GIG-05/06. Server state via TanStack Query (prefetched by the page). */
export function CatalogResults({ query }: { query: GigSearchQuery }) {
  const { data, isPending, isError } = useQuery(queries.gigs(query));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <SortSelect value={query.sort ?? "rating_desc"} />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {data ? `${data.total} ${data.total === 1 ? "result" : "results"}` : "\u00a0"}
        </p>
      </div>

      {isError ? (
        <Alert variant="danger">We couldn&apos;t load gigs. Please refresh the page.</Alert>
      ) : isPending ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : (
        <>
          <GigGrid gigs={data.gigs} />
          <Pagination query={query} page={data.page} total={data.total} />
        </>
      )}
    </>
  );
}

function Pagination({ query, page, total }: { query: GigSearchQuery; page: number; total: number }) {
  const lastPage = Math.max(1, Math.ceil(total / GIG_PAGE_SIZE));
  if (lastPage <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link className="font-semibold text-heading underline" href={catalogHref(query, { page: page - 1 })}>
          Previous
        </Link>
      ) : null}
      <span className="text-muted-foreground">
        Page {page} of {lastPage}
      </span>
      {page < lastPage ? (
        <Link className="font-semibold text-heading underline" href={catalogHref(query, { page: page + 1 })}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}
