"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { getBrowserQueryClient } from "@/lib/query/client";

/** App-wide client providers: TanStack Query (server state) + the Zustand-driven toaster. */
export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getBrowserQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
