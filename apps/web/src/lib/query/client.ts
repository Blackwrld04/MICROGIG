import { QueryClient, defaultShouldDehydrateQuery, isServer } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

/** TanStack Query client with defaults shared by server prefetching and the browser. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data prefetched on the server shouldn't refetch the instant it hydrates.
        staleTime: 30_000,
        // Don't retry auth / permission / not-found errors; retry flaky network once.
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        // Include queries still pending so streaming works with prefetches that aren't awaited.
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** Browser: one client for the app's lifetime. Server: a fresh client (see lib/query/server.ts). */
export function getBrowserQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
