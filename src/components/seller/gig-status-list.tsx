"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

interface SellerGigRow {
  id: string;
  thumbnailUrl: string | null;
  slug: string;
  title: string;
  priceCents: number;
  turnaroundHours: number;
  status: "DRAFT" | "PUBLISHED" | "PAUSED";
}

/** Seller gig list with PUBLISHED ⇄ PAUSED toggle — GIG-08. TODO: PUT /api/v1/gigs/:id { status }. */
export function GigStatusList({ initial }: { initial: SellerGigRow[] }) {
  const [gigs, setGigs] = useState(initial);

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
              onClick={() =>
                setGigs((all) =>
                  all.map((x) => (x.id === g.id ? { ...x, status: x.status === "PUBLISHED" ? "PAUSED" : "PUBLISHED" } : x)),
                )
              }
            >
              {g.status === "PUBLISHED" ? "Pause" : "Publish"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
