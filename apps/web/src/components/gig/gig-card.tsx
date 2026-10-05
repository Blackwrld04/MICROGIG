import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Clock, Heart, ImageIcon, Star } from "lucide-react";
import { Avatar } from "@/components/common/avatar";
import { formatCents } from "@/lib/money";
import type { GigCard as GigCardData } from "@/modules/catalog/contracts";

/** Catalog card — GIG-05, laid out per the §16.1 wireframe. */
export function GigCard({ gig }: { gig: GigCardData }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background transition-[box-shadow,transform] duration-200 hover:shadow-lg focus-within:shadow-lg motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {gig.thumbnailUrl ? (
          <Image
            src={gig.thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" aria-hidden />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/95 px-2 py-0.5 text-xs font-semibold text-heading">
          <Clock className="h-3 w-3" aria-hidden />
          {gig.turnaroundHours}h delivery
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-sm">
          <Avatar name={gig.seller.displayName} src={gig.seller.avatarUrl} size={24} />
          <Link href={`/sellers/${gig.seller.id}`} className="relative z-10 font-semibold text-heading hover:underline">
            {gig.seller.displayName}
          </Link>
          {gig.seller.idVerified ? (
            <BadgeCheck className="h-4 w-4 text-heading" aria-label="Verified seller" />
          ) : null}
        </div>

        <h3 className="line-clamp-2 text-[15px] font-normal leading-snug text-heading">
          <Link href={`/gigs/${gig.slug}`} className="after:absolute after:inset-0 group-hover:underline">
            {gig.title}
          </Link>
        </h3>

        <p className="flex items-center gap-1 text-sm">
          {gig.rating !== null ? (
            <>
              <Star className="h-4 w-4 fill-heading text-heading" aria-hidden />
              <span className="font-semibold text-heading">{gig.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">({gig.reviewCount})</span>
            </>
          ) : (
            <span className="text-muted-foreground">New seller</span>
          )}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Heart className="h-4 w-4" aria-hidden />
            <span className="sr-only">Favorited</span>
            {gig.favoriteCount}
          </span>
          <span className="text-base font-bold text-heading">{formatCents(gig.priceCents)}</span>
        </div>
      </div>
    </article>
  );
}
