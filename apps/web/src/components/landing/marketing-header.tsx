import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { homeFor } from "@/modules/auth/contracts";
import { getCurrentUser } from "@/modules/auth/session";

const SECTIONS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#categories", label: "Categories" },
  { href: "#escrow", label: "Escrow" },
  { href: "#for-freelancers", label: "For freelancers" },
  { href: "#faq", label: "FAQ" },
];

export async function MarketingHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="container flex h-16 items-center gap-6">
        <Link href="/" aria-label="microgig home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Page sections" className="hidden lg:block">
          <ul className="flex items-center gap-6 text-sm font-semibold">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a href={s.href} className="text-muted-foreground hover:text-heading">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <details className="relative lg:hidden">
            <summary className="flex h-8 cursor-pointer list-none items-center rounded-md px-3 text-sm font-semibold text-heading hover:bg-surface [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <ul className="absolute right-0 top-10 z-50 w-52 space-y-1 rounded-md border border-border bg-background p-2 text-sm font-semibold shadow-lg">
              {SECTIONS.map((s) => (
                <li key={s.href}>
                  <a href={s.href} className="block rounded px-2 py-1.5 text-heading hover:bg-surface">
                    {s.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/gigs" className="block rounded px-2 py-1.5 text-heading hover:bg-surface">
                  Browse gigs
                </Link>
              </li>
              {user ? null : (
                <li className="sm:hidden">
                  <Link href="/login" className="block rounded px-2 py-1.5 text-heading hover:bg-surface">
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </details>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/gigs">Browse gigs</Link>
          </Button>
          {user ? (
            <Button asChild size="sm">
              <Link href={homeFor(user)}>Go to your dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
