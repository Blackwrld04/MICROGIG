import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CATEGORIES } from "@/lib/constants/categories";

const COLUMNS = [
  {
    title: "Categories",
    links: CATEGORIES.map((c) => ({ href: `/categories/${c.slug}`, label: c.name })),
  },
  {
    title: "For clients",
    links: [
      { href: "/gigs", label: "Browse gigs" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/register?role=client", label: "Sign up as a client" },
    ],
  },
  {
    title: "For freelancers",
    links: [
      { href: "/#for-freelancers", label: "Why sell on microgig" },
      { href: "/register?role=freelancer", label: "Sign up as a freelancer" },
      { href: "/seller/dashboard", label: "Seller dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#escrow", label: "Escrow protection" },
      { href: "/#faq", label: "FAQ" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Fixed-price micro-gigs under $50, delivered in 24–48 hours, protected by escrow.</p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-heading hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="container py-4 text-xs text-muted-foreground">© 2026 microgig. Payments are simulated during the prototype phase.</p>
      </div>
    </footer>
  );
}
