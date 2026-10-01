"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";

/**
 * Favorite toggle — GIG-10 (POST /api/v1/gigs/:id/favorite → { isFavorited, count }).
 * Optimistic: flips immediately, rolls back if the request fails. Signed-out visitors go to sign-in.
 */
export function FavoriteButton({
  gigId,
  initialCount,
  initialFavorited = false,
  signedIn,
  returnTo,
}: {
  gigId: string;
  initialCount: number;
  initialFavorited?: boolean;
  signedIn: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);

  const toggle = useMutation({
    mutationFn: async () => {
      if (USE_MOCKS) return null;
      return api<{ isFavorited: boolean; count: number }>(`/gigs/${gigId}/favorite`, { method: "POST" });
    },
    onMutate: () => {
      const previous = { favorited, count };
      setFavorited(!favorited);
      setCount((c) => c + (favorited ? -1 : 1));
      return previous;
    },
    onSuccess: (server) => {
      if (server) {
        setFavorited(server.isFavorited);
        setCount(server.count);
      }
    },
    onError: (_err, _vars, previous) => {
      if (previous) {
        setFavorited(previous.favorited);
        setCount(previous.count);
      }
      toast("Couldn't update your favorites. Please try again.", "danger");
    },
  });

  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
      disabled={toggle.isPending}
      onClick={() => (signedIn ? toggle.mutate() : router.push(`/login?next=${encodeURIComponent(returnTo)}`))}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-heading hover:bg-surface"
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-red-600 text-red-600")} aria-hidden />
      {count}
    </button>
  );
}
