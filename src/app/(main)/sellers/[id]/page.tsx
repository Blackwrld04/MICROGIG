import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { Stars } from "@/components/common/stars";
import { GigGrid } from "@/components/gig/gig-grid";
import { SellerCardPanel } from "@/components/gig/seller-card-panel";
import { formatDate } from "@/lib/time";
import { getSellerPublicPage } from "@/modules/catalog/queries";
import { SKILL_LEVEL_LABELS } from "@/modules/seller/contracts";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const page = await getSellerPublicPage(params.id);
  return { title: page?.seller.displayName ?? "Seller not found" };
}

/** Public seller page — SEL-03 (seller card, bio, skills, gigs, reviews). */
export default async function SellerPage({ params }: { params: { id: string } }) {
  const page = await getSellerPublicPage(params.id);
  if (!page) notFound();
  const { seller, gigs, rating, totalReviews, reviews } = page;
  const now = Date.now();

  return (
    <div className="container space-y-10 py-8">
      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <SellerCardPanel seller={seller} nowMs={now} showProfileLink={false} />
          <p className="flex items-center gap-1 text-sm">
            {rating !== null ? (
              <>
                <Star className="h-4 w-4 fill-heading text-heading" aria-hidden />
                <span className="font-semibold text-heading">{rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({totalReviews} reviews across all gigs)</span>
              </>
            ) : (
              <span className="text-muted-foreground">No reviews yet</span>
            )}
          </p>
        </div>

        <div className="space-y-8">
          <section aria-labelledby="about-heading">
            <h1 id="about-heading" className="text-2xl font-bold">
              About {seller.displayName}
            </h1>
            <p className="mt-3 text-sm leading-relaxed">{seller.about}</p>
          </section>

          <section aria-labelledby="skills-heading">
            <h2 id="skills-heading" className="text-lg font-semibold">
              Skills
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {seller.skills.map((s) => (
                <li key={s.skillName} className="rounded-full bg-surface px-3 py-1 text-sm text-heading">
                  <span className="font-semibold">{s.skillName}</span>
                  <span className="text-muted-foreground"> · {SKILL_LEVEL_LABELS[s.level]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section aria-labelledby="gigs-heading" className="space-y-4">
        <h2 id="gigs-heading" className="text-lg font-semibold">
          {seller.displayName}&apos;s gigs ({gigs.length})
        </h2>
        <GigGrid gigs={gigs} />
      </section>

      <section aria-labelledby="seller-reviews-heading" className="space-y-4">
        <h2 id="seller-reviews-heading" className="text-lg font-semibold">
          Recent reviews
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className="space-y-1.5 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-heading">{r.buyerName}</p>
                  <time dateTime={r.createdAt} className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </time>
                </div>
                <Stars rating={r.rating} />
                {r.body ? <p className="text-sm">{r.body}</p> : null}
                <Link href={`/gigs/${r.gigSlug}`} className="block text-xs text-muted-foreground underline">
                  {r.gigTitle}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
