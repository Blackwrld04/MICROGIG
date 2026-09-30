import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating with an accessible text equivalent. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("h-4 w-4 text-heading", i <= Math.round(rating) ? "fill-heading" : "fill-none")} />
      ))}
    </span>
  );
}
