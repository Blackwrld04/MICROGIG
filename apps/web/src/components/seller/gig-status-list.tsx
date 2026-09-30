"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { DashboardResponse } from "@/lib/api/types";
import { formatCents } from "@/lib/money";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";

interface SellerGigRow {
  id: string;
  thumbnailUrl: string | null;
  slug: string;
  title: string;
  priceCents: number;
  turnaroundHours: number;
  status: "DRAFT" | "PUBLISHED" | "PAUSED";
}

/** Seller gig list with PUBLISHED ⇄ PAUSED toggle — GIG-08 (PUT /api/v1/gigs/:id { status }). */
export function GigStatusList({ gigs }: { gigs: SellerGigRow[] }) {
  const queryClient = useQueryClient();

  const setStatus = (id: string, status: SellerGigRow["status"]) =>
    queryClient.setQueryData<DashboardResponse>(queryKeys.dashboard, (prev) =>
      prev ? { ...prev, gigs: prev.gigs.map((g) => (g.id === id ? { ...g, status } : g)) } : prev,
    );

  const toggle = useMutation({
    mutationFn: async (g: SellerGigRow) => {
      const status = g.status === "PUBLISHED" ? "PAUSED" : "PUBLISHED";
      if (!USE_MOCKS) await api(`/gigs/${g.id}`, { method: "PUT", body: { status } });
      return { id: g.id, status } as const;
    },
    onMutate: (g) => setStatus(g.id, g.status === "PUBLISHED" ? "PAUSED" : "PUBLISHED"), // optimistic
    onSuccess: ({ status }) => toast(status === "PUBLISHED" ? "Gig published." : "Gig paused. It's hidden from search."),
    onError: (_err, g) => {
      setStatus(g.id, g.status);
      toast("Couldn't update the gig. Please try again.", "danger");
    },
  });

  if (gigs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center">
        <p className="font-semibold text-heading">Beginnings are so exciting!</p>
        <p className="mt-1 text-sm text-muted-foreground">Create your first gig to start receiving orders.</p>
        <Button asChild className="mt-4">
          <Link href="/gigs/new">Create a gig</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {gigs.map((g) => (
        <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-surface">
              {g.thumbnailUrl ? <Image src={g.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <Link href={`/gigs/${g.slug}`} className="font-semibold text-heading hover:underline">
                {g.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatCents(g.priceCents)} · {g.turnaroundHours}h delivery
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                g.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-800" : "bg-surface text-muted-foreground",
              )}
            >
              {g.status === "PUBLISHED" ? "Published" : g.status === "PAUSED" ? "Paused" : "Draft"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggle.mutate(g)}
            >
              {g.status === "PUBLISHED" ? "Pause" : "Publish"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
