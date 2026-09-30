import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star } from "lucide-react";
import { RichText } from "@/components/common/rich-text";
import { Stars } from "@/components/common/stars";
import { FavoriteButton } from "@/components/gig/favorite-button";
import { GigCard } from "@/components/gig/gig-card";
import { GigGallery } from "@/components/gig/gig-gallery";
import { OrderPanel } from "@/components/gig/order-panel";
import { SellerCardPanel } from "@/components/gig/seller-card-panel";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { findCategory } from "@/lib/constants/categories";
import { formatDate } from "@/lib/time";
import { getCurrentUser } from "@/modules/auth/session";
import { getGigBySlug, getMoreFromSeller } from "@/modules/catalog/queries";
import { getAvailableBalance } from "@/modules/ledger/queries";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const gig = await getGigBySlug(params.slug);
  return { title: gig?.title ?? "Gig not found" };
}

/** Gig details & order entry — PRD §16.3, GIG-07 / GIG-10 / GIG-11. */
export default async function GigDetailPage({ params }: { params: { slug: string } }) {
  const gig = await getGigBySlug(params.slug);
  if (!gig) notFound();

  const now = Date.now();
  const [more, user] = await Promise.all([getMoreFromSeller(gig.id), getCurrentUser()]);
  const balance = user ? await getAvailableBalance(user.accountType, now) : 0;
  const category = findCategory(gig.category);
  const subcategory = category?.subcategories.find((s) => s.slug === gig.subcategory);
  const viewer = !user
    ? "guest"
    : user.isAdmin
      ? "admin"
      : user.accountType === "CLIENT"
        ? "client"
        : user.fullName === gig.sellerCard.displayName
          ? "own"
          : "freelancer";

  return (
    <div className="container py-8">
      <Link
        href={category ? `/categories/${category.slug}` : "/gigs"}
        className="inline-flex items-center gap-1 text-sm font-semibold text-heading hover:underline"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to {category?.name ?? "all gigs"}
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          <header className="space-y-3">
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">{gig.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              {gig.rating !== null ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-heading text-heading" aria-hidden />
                  <span className="font-semibold text-heading">{gig.rating.toFixed(1)}</span>
                  <a href="#reviews" className="text-muted-foreground underline">
                    ({gig.reviewCount} reviews)
                  </a>
                </span>
              ) : (
                <span className="text-muted-foreground">No reviews yet</span>
              )}
              <span aria-hidden className="text-muted-foreground">
                •
              </span>
              <nav aria-label="Breadcrumb" className="text-muted-foreground">
                <Link href={`/gigs?category=${gig.category}`} className="hover:underline">
                  {category?.name}
                </Link>{" "}
                &gt;{" "}
                <Link href={`/gigs?category=${gig.category}&subcategory=${gig.subcategory}`} className="hover:underline">
                  {subcategory?.name}
                </Link>
              </nav>
              <span aria-hidden className="text-muted-foreground">
                •
              </span>
              <span className="text-muted-foreground">
                by{" "}
                <Link href={`/sellers/${gig.sellerCard.id}`} className="font-semibold text-heading hover:underline">
                  {gig.sellerCard.displayName}
                </Link>
              </span>
              <span className="ml-auto">
                <FavoriteButton initialCount={gig.favoriteCount} />
              </span>
            </div>
          </header>

          <GigGallery images={gig.images} title={gig.title} />

          <div className="lg:hidden">
            <OrderPanel
              priceCents={gig.priceCents}
              turnaroundHours={gig.turnaroundHours}
              revisionsIncluded={gig.revisionsIncluded}
              requirementsPrompt={gig.requirementsPrompt}
              walletAvailableCents={balance}
              viewer={viewer}
            gigPath={`/gigs/${gig.slug}`}
            />
          </div>

          <section aria-labelledby="about-gig">
            <h2 id="about-gig" className="mb-3 text-lg font-semibold">
              About this gig
            </h2>
            <RichText text={gig.description} />
            {gig.tags.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
                {gig.tags.map((t) => (
                  <li key={t}>
                    <Link
                      href={`/gigs?search=${encodeURIComponent(t)}`}
                      className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-heading hover:underline"
                    >
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {gig.faqs.length > 0 ? (
            <section aria-labelledby="faq">
              <h2 id="faq" className="mb-1 text-lg font-semibold">
                Frequently asked questions
              </h2>
              <Accordion type="multiple" defaultValue={["faq-0"]}>
                {gig.faqs.map((f, i) => (
                  <AccordionItem key={f.question} value={`faq-${i}`}>
                    <AccordionTrigger>{f.question}</AccordionTrigger>
                    <AccordionContent>{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ) : null}

          <section aria-labelledby="about-seller">
            <h2 id="about-seller" className="mb-3 text-lg font-semibold">
              About the seller
            </h2>
            <SellerCardPanel seller={gig.sellerCard} nowMs={now} />
          </section>

          <section aria-labelledby="reviews-heading" id="reviews" className="scroll-mt-40">
            <h2 id="reviews-heading" className="mb-3 text-lg font-semibold">
              Reviews
            </h2>
            {gig.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet. Be the first to order.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {gig.reviews.map((r) => (
                  <li key={r.id} className="space-y-1.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-heading">{r.buyerName}</p>
                      <time dateTime={r.createdAt} className="text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </time>
                    </div>
                    <Stars rating={r.rating} />
                    {r.body ? <p className="text-sm">{r.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="hidden lg:block">
          <OrderPanel
            priceCents={gig.priceCents}
            turnaroundHours={gig.turnaroundHours}
            revisionsIncluded={gig.revisionsIncluded}
            requirementsPrompt={gig.requirementsPrompt}
            walletAvailableCents={balance}
            viewer={viewer}
            gigPath={`/gigs/${gig.slug}`}
          />
        </aside>
      </div>

      {more.length > 0 ? (
        <section aria-labelledby="more-from-seller" className="mt-14">
          <h2 id="more-from-seller" className="mb-4 text-lg font-semibold">
            More from {gig.sellerCard.displayName}
          </h2>
          <ul className="flex snap-x gap-6 overflow-x-auto pb-2">
            {more.map((g) => (
              <li key={g.id} className="w-72 shrink-0 snap-start">
                <GigCard gig={g} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
