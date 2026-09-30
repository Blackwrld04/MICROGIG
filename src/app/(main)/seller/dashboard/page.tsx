import type { Metadata } from "next";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { GigStatusList } from "@/components/seller/gig-status-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { getSellerDashboard } from "@/modules/seller/queries";

export const metadata: Metadata = { title: "Seller dashboard" };
export const dynamic = "force-dynamic";

/** Seller dashboard & onboarding — PRD §16.6, SEL-02. */
export default async function SellerDashboardPage() {
  await requireUser({ next: "/seller/dashboard", accountType: "FREELANCER" });
  const { checklist, stats, gigs, activeOrders } = await getSellerDashboard(Date.now());

  const steps = [
    {
      label: "Complete profile bio, languages & skills",
      done: checklist.profileComplete,
      href: "/seller/profile",
      cta: "Edit profile",
    },
    {
      label:
        checklist.verification === "APPROVED"
          ? "Submit ID verification (Approved — “Verified” badge active)"
          : checklist.verification === "PENDING_VERIFICATION"
            ? "Submit ID verification (Pending admin review)"
            : "Submit ID verification",
      done: checklist.verification === "APPROVED",
      href: "/seller/profile#verification",
      cta: "Verify ID",
    },
    { label: "Create your first micro-gig", done: checklist.hasGig, href: "/gigs/new", cta: "Create gig" },
    { label: "Publish a gig to the marketplace", done: checklist.hasPublishedGig, href: "#your-gigs", cta: "Publish now" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const strength = Math.round((doneCount / steps.length) * 100);
  const visible = checklist.profileComplete && checklist.verification === "APPROVED";

  const statCards = [
    { label: "Net earnings", value: formatCents(stats.netEarningsCents) },
    { label: "Avg selling price", value: formatCents(stats.avgSellingPriceCents) },
    { label: "On-time delivery", value: `${stats.onTimeDeliveryRate}%` },
    { label: "Completion rate", value: `${stats.completionRate}%` },
  ];

  return (
    <div className="container space-y-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Seller dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-surface px-3 py-1 text-sm font-semibold text-heading">Level 0</span>
          <Button asChild>
            <Link href="/gigs/new">
              <Plus aria-hidden /> Create a gig
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Onboarding checklist</h2>
          <p className="text-sm text-muted-foreground">Profile strength: {strength}%</p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-label="Profile strength"
          aria-valuenow={strength}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary" style={{ width: `${strength}%` }} />
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map((s) => (
            <li key={s.label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full",
                    s.done ? "bg-heading text-white" : "border-2 border-border",
                  )}
                >
                  {s.done ? <Check className="h-3 w-3" aria-hidden /> : null}
                </span>
                <span className={cn(s.done ? "text-heading" : "font-semibold text-heading")}>{s.label}</span>
                <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
              </span>
              {!s.done ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={s.href}>{s.cta}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
        {!visible ? (
          <Alert variant="warning" className="mt-4">
            Your gigs stay hidden from search until your profile is complete and your ID is approved.
          </Alert>
        ) : null}
      </Card>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="mb-3 text-lg font-semibold">
          Headline performance stats
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <li key={s.label}>
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-heading">{s.value}</p>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/orders?role=seller&tab=active" className="font-semibold text-heading underline">
            {activeOrders} active {activeOrders === 1 ? "order" : "orders"}
          </Link>{" "}
          ·{" "}
          <Link href="/wallet" className="font-semibold text-heading underline">
            View wallet
          </Link>
        </p>
      </section>

      <section aria-labelledby="your-gigs-heading" id="your-gigs" className="scroll-mt-40">
        <h2 id="your-gigs-heading" className="mb-3 text-lg font-semibold">
          Your gigs
        </h2>
        <GigStatusList initial={gigs} />
      </section>
    </div>
  );
}
