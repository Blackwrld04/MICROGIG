import Link from "next/link";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { serverData } from "@/lib/api/server-data";
import { queries } from "@/lib/query/queries";
import { getQueryClient } from "@/lib/query/server";
import { getCurrentUser } from "@/modules/auth/session";
import { CategoryNav } from "./category-nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

function SearchForm({ className }: { className?: string }) {
  return (
    <form action="/gigs" method="get" role="search" className={className}>
      <label htmlFor="site-search" className="sr-only">
        Search gigs
      </label>
      <div className="relative">
        <input
          id="site-search"
          name="search"
          type="search"
          placeholder="Search gigs (e.g. CSS bug, logo, resume)..."
          className="h-10 w-full rounded-md border border-input bg-background pl-3 pr-11 text-sm text-heading placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-r-md bg-heading text-white"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="sr-only">Search</span>
        </button>
      </div>
    </form>
  );
}

const NAV_LINK = "hidden px-2 text-sm font-semibold text-heading hover:underline lg:block";

/** Global header — PRD §16.1. Links depend on the account type (client XOR freelancer). */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const queryClient = getQueryClient();
  if (user) await queryClient.prefetchQuery({ ...queries.notifications(), queryFn: () => serverData.notifications() });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" aria-label="microgig home" className="shrink-0">
          <Logo />
        </Link>
        <SearchForm className="hidden flex-1 md:block md:max-w-xl" />
        <nav aria-label="Account" className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {user.accountType === "FREELANCER" ? (
                <Link href="/seller/dashboard" className={NAV_LINK}>
                  Dashboard
                </Link>
              ) : null}
              <Link href="/orders" className={NAV_LINK}>
                Orders
              </Link>
              <Link href="/inbox" className={NAV_LINK}>
                Inbox
              </Link>
              <Link href="/wallet" className={NAV_LINK}>
                {user.accountType === "FREELANCER" ? "Earnings" : "Wallet"}
              </Link>
              <HydrationBoundary state={dehydrate(queryClient)}>
                <NotificationBell serverNow={Date.now()} />
              </HydrationBoundary>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
      <div className="container pb-3 md:hidden">
        <SearchForm />
      </div>
      <CategoryNav />
    </header>
  );
}
