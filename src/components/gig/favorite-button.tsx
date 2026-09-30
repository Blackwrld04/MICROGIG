"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/** Favorite toggle — GIG-10. TODO: POST /api/v1/gigs/:id/favorite. */
export function FavoriteButton({ initialCount, initialFavorited = false }: { initialCount: number; initialFavorited?: boolean }) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);

  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
      onClick={() => {
        setFavorited(!favorited);
        setCount((c) => c + (favorited ? -1 : 1));
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-heading hover:bg-surface"
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-red-600 text-red-600")} aria-hidden />
      {count}
    </button>
  );
}
