import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GigGrid } from "@/components/gig/gig-grid";
import { findCategory } from "@/lib/constants/categories";
import { serverData } from "@/lib/api/server-data";

// Rendered per request: the header shows the signed-in account, so this page can't be static HTML.
export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return { title: findCategory(params.slug)?.name ?? "Category" };
}

/** Category landing page — GIG-12: subcategory tree + featured gigs. */
export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const category = findCategory(params.slug);
  if (!category) notFound();

  const { gigs } = await serverData.searchGigs({ category: category.slug, sort: "rating_desc", page: 1 });

  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[240px_1fr]">
      <aside aria-label={`${category.name} subcategories`}>
        <h1 className="text-2xl font-bold lg:text-xl">{category.name}</h1>
        <ul className="mt-4 space-y-2 text-sm">
          {category.subcategories.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/gigs?category=${category.slug}&subcategory=${s.slug}`}
                className="text-heading hover:underline"
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section aria-labelledby="featured-heading" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="featured-heading" className="text-lg font-semibold">
            Featured micro-gigs
          </h2>
          <Link href={`/gigs?category=${category.slug}`} className="text-sm font-semibold text-heading underline">
            See all
          </Link>
        </div>
        <GigGrid gigs={gigs.slice(0, 8)} />
      </section>
    </div>
  );
}
