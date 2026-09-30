import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CATEGORIES } from "@/lib/constants/categories";

const COLUMNS = [
  {
    title: "Categories",
    links: CATEGORIES.map((c) => ({ href: `/categories/${c.slug}`, label: c.name })),
  },
  {
    title: "Buying",
    links: [
      { href: "/gigs", label: "Browse gigs" },
      { href: "/orders", label: "Manage orders" },
      { href: "/inbox", label: "Inbox" },
      { href: "/wallet", label: "Wallet" },
    ],
  },
  {
    title: "Selling",
    links: [
      { href: "/seller/dashboard", label: "Seller dashboard" },
      { href: "/seller/profile", label: "Seller profile" },
      { href: "/gigs/new", label: "Create a gig" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/settings/security", label: "Security" },
      { href: "/settings/notifications", label: "Notifications" },
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Join" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Fixed-price micro-gigs under $50, protected by escrow.</p>
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
    </footer>
  );
}
