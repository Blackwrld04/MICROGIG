import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Laptop,
  Lock,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  Wallet,
  X,
} from "lucide-react";
import { GigCard } from "@/components/gig/gig-card";
import { EarningsCalculator } from "@/components/landing/earnings-calculator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES } from "@/lib/constants/categories";
import { PLATFORM_FEE_BPS, formatCents, platformFeeCents, sellerNetCents } from "@/lib/money";
import { serverData } from "@/lib/api/server-data";

export const metadata: Metadata = {
  title: { absolute: "microgig — Small jobs, fixed prices, done in 24 hours" },
  description:
    "Hire verified freelancers for fixed-price micro-gigs under $50, delivered in 24–48 hours. Your payment stays in escrow until you approve the work.",
};

const CATEGORY_IMAGES: Record<string, string> = {
  "graphics-design": "/images/gigs/logo-1.jpg",
  "programming-tech": "/images/gigs/css-2.jpg",
  "writing-translation": "/images/gigs/resume-1.jpg",
  "video-animation": "/images/gigs/video-1.jpg",
  "digital-marketing": "/images/gigs/seo-1.jpg",
  "operations-admin": "/images/gigs/csv-1.jpg",
};

const POPULAR = ["CSS bug", "App icon", "Proofreading", "SEO audit", "Logo"];

const EXAMPLE_PRICE = 3500;
const EXAMPLE_FEE = platformFeeCents(EXAMPLE_PRICE, PLATFORM_FEE_BPS);
const EXAMPLE_NET = sellerNetCents(EXAMPLE_PRICE, PLATFORM_FEE_BPS);

const FAQS = [
  {
    q: "What is microgig?",
    a: "A marketplace for small, clearly scoped digital jobs. Every gig has one fixed price between $5 and $50 and is delivered in 24 or 48 hours. There are no proposals, bids or price negotiations.",
  },
  {
    q: "How does escrow protect me?",
    a: "When you order, the price moves from your wallet into escrow. The freelancer is paid only after you accept the delivery, or automatically 72 hours after delivery if you take no action. If the order is cancelled, you get a full refund.",
  },
  {
    q: "What does it cost?",
    a: "Clients pay exactly the gig price, with no service fee. Freelancers pay a flat 20% platform fee on each completed order.",
  },
  {
    q: "What if the work is late or not what I asked for?",
    a: "Each gig includes a set number of revisions. If an order is more than 24 hours past its deadline, you can cancel for a full refund. If something else goes wrong, you can open a dispute and an administrator will decide on a refund, a release or a split.",
  },
  {
    q: "Can one account both hire and sell?",
    a: "No. When you sign up you choose to be a client or a freelancer, and that can't be changed later. This keeps every account focused and every order's roles clear.",
  },
  {
    q: "How are freelancers verified?",
    a: "Freelancers complete a profile and submit an ID for review. Their gigs only appear in search once an administrator approves them, and verified freelancers show a badge.",
  },
  {
    q: "When do freelancers get paid?",
    a: "Earnings from a completed order wait in a 3-day clearing period, then move to your available balance, ready to withdraw.",
  },
  {
    q: "Are payments real?",
    a: "Not yet. During the prototype phase, payments use virtual test funds, while the escrow and ledger work exactly as they will with real money.",
  },
];

function SectionHeading({ eyebrow, title, intro, id }: { eyebrow: string; title: string; intro?: string; id: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {intro ? <p className="mt-4 text-base text-muted-foreground md:text-lg">{intro}</p> : null}
    </div>
  );
}

function Step({ n, icon: Icon, title, body }: { n: number; icon: typeof Search; title: string; body: string }) {
  return (
    <li className="relative rounded-2xl border border-border bg-background p-6">
      <span className="absolute right-5 top-5 text-4xl font-bold text-border" aria-hidden>
        {n}
      </span>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-heading">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold">
        <span className="sr-only">Step {n}: </span>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed">{body}</p>
    </li>
  );
}

/** Public landing page: presents the product and routes visitors to client or freelancer sign-up. */
export default async function LandingPage() {
  const { gigs } = await serverData.searchGigs({ sort: "rating_desc", page: 1 });
  const featured = gigs.slice(0, 4);

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(29,191,115,0.18),transparent),radial-gradient(40rem_20rem_at_0%_110%,rgba(29,191,115,0.10),transparent)]"
        />
        <div className="container grid grid-cols-1 items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr]">
          <div className="min-w-0">
            <h1 id="hero-heading" className="text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
              Small jobs, done in a day. <span className="whitespace-nowrap">No bidding.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Order fixed-price micro-gigs from verified freelancers. Your money waits safely in escrow until you
              approve the work.
            </p>

            <form action="/gigs" method="get" role="search" className="mt-8 max-w-xl">
              <label htmlFor="hero-search" className="sr-only">
                What do you need done?
              </label>
              <div className="flex rounded-xl border border-border bg-background p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring">
                <Search className="ml-2 h-5 w-5 self-center text-muted-foreground" aria-hidden />
                <input
                  id="hero-search"
                  name="search"
                  type="search"
                  placeholder="What do you need done?"
                  className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-heading outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="lg" className="h-11 shrink-0 px-4 sm:px-6">
                  Search
                </Button>
              </div>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Popular:</span>
              {POPULAR.map((p) => (
                <Link
                  key={p}
                  href={`/gigs?search=${encodeURIComponent(p.toLowerCase())}`}
                  className="rounded-full border border-border bg-background px-3 py-1 font-semibold text-heading hover:border-heading"
                >
                  {p}
                </Link>
              ))}
            </div>

            <div className="mt-10 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild size="lg">
                <Link href="/register?role=client">
                  Hire a freelancer <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register?role=freelancer">Start earning as a freelancer</Link>
              </Button>
            </div>
          </div>

          {/* Product collage */}
          <div className="relative mx-auto w-full min-w-0 max-w-lg lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/5">
              <Image
                src="/images/gigs/icon-1.jpg"
                alt="A phone showing an app interface, lying on a bright desk"
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Key facts */}
      <section aria-label="microgig at a glance" className="border-y border-border bg-surface">
        <dl className="container grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          {[
            { k: "$5–$50", v: "One fixed price per gig" },
            { k: "24–48h", v: "Guaranteed delivery window" },
            { k: "$0", v: "Service fee for clients" },
            { k: "72h", v: "Automatic escrow release" },
          ].map((f) => (
            <div key={f.k} className="text-center">
              <dt className="sr-only">{f.v}</dt>
              <dd className="text-3xl font-bold tracking-tight text-heading md:text-4xl">{f.k}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------- How it works */}
      <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 py-16 md:py-24">
        <div className="container">
          <SectionHeading
            id="how-heading"
            eyebrow="How it works"
            title="From idea to done in three steps"
            intro="Every order follows the same simple path, whichever side you're on."
          />
          <Tabs defaultValue="client" className="mt-10">
            <TabsList className="mx-auto w-fit rounded-full border border-border bg-surface p-1" aria-label="Show steps for">
              <TabsTrigger value="client" className="rounded-full border-b-0 px-5 py-2 data-[state=active]:bg-heading data-[state=active]:text-white">
                For clients
              </TabsTrigger>
              <TabsTrigger value="freelancer" className="rounded-full border-b-0 px-5 py-2 data-[state=active]:bg-heading data-[state=active]:text-white">
                For freelancers
              </TabsTrigger>
            </TabsList>
            <TabsContent value="client" className="pt-10">
              <ol className="grid gap-6 md:grid-cols-3">
                <Step n={1} icon={Search} title="Pick a gig" body="Browse fixed-price gigs by category. You see exactly what you get, how long it takes and what it costs." />
                <Step n={2} icon={Lock} title="Order and answer 1–3 questions" body="Your payment moves into escrow and the delivery clock starts as soon as you share your requirements." />
                <Step n={3} icon={CheckCircle2} title="Review and release" body="Check the delivery, ask for a revision if needed, and accept. Only then is the freelancer paid." />
              </ol>
            </TabsContent>
            <TabsContent value="freelancer" className="pt-10">
              <ol className="grid gap-6 md:grid-cols-3">
                <Step n={1} icon={FileText} title="Publish a gig" body="Describe one service, set a price from $5 to $50 and a 24 or 48 hour turnaround. Get verified to appear in search." />
                <Step n={2} icon={Timer} title="Deliver on time" body="Clients answer your questions upfront, so you can start right away. Upload the work before the deadline." />
                <Step n={3} icon={Wallet} title="Get paid" body="When the client accepts, or 72 hours after delivery, your earnings clear in 3 days and are ready to withdraw." />
              </ol>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* --------------------------------------------------------- Categories */}
      <section id="categories" aria-labelledby="categories-heading" className="scroll-mt-20 bg-surface py-16 md:py-24">
        <div className="container">
          <SectionHeading id="categories-heading" eyebrow="Categories" title="Quick wins across six categories" />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={CATEGORY_IMAGES[c.slug]!}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex items-center justify-between p-5">
                    <div>
                      <h3 className="text-lg font-semibold group-hover:underline">{c.name}</h3>
                      <p className="text-sm text-muted-foreground">{c.subcategories.length} services</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-heading transition-transform group-hover:translate-x-1" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------- Featured gigs */}
      <section aria-labelledby="featured-heading" className="py-16 md:py-24">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top rated</p>
              <h2 id="featured-heading" className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Popular gigs right now
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/gigs">
                Browse all gigs <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((g) => (
              <li key={g.id}>
                <GigCard gig={g} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Escrow */}
      <section id="escrow" aria-labelledby="escrow-heading" className="scroll-mt-20 bg-heading py-20 text-white md:py-28">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white/80">Escrow protection</p>
            <h2 id="escrow-heading" className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Nobody gets paid until the work is done.
            </h2>
            <p className="mt-4 text-lg text-white/80">
              Every order runs through a double-entry escrow ledger. Money moves in exact, traceable steps, so it&apos;s
              never lost, doubled or stuck.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { icon: RefreshCw, t: "Revisions included", d: "Each gig states how many revisions you get." },
                { icon: Clock, t: "Late? Get refunded", d: "Cancel for a full refund 24h past the deadline." },
                { icon: Timer, t: "Auto-release in 72h", d: "Freelancers are never left waiting on a silent client." },
                { icon: ShieldCheck, t: "Fair disputes", d: "An admin reviews and decides refund, release or split." },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="font-semibold text-white">{t}</p>
                    <p className="text-sm text-white/80">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <ol className="relative space-y-4" aria-label={`Example: a ${formatCents(EXAMPLE_PRICE)} order`}>
            {[
              { label: "Client pays", value: formatCents(EXAMPLE_PRICE), note: "From wallet into escrow" },
              { label: "Held in escrow", value: formatCents(EXAMPLE_PRICE), note: "While the freelancer works" },
              { label: "Work delivered and accepted", value: "Released", note: "Or 72 hours pass with no action" },
              {
                label: "Freelancer receives",
                value: formatCents(EXAMPLE_NET),
                note: `${formatCents(EXAMPLE_FEE)} platform fee (20%) · clears in 3 days`,
              },
            ].map((s, i, all) => (
              <li key={s.label} className="relative flex items-center gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/15">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{s.label}</p>
                  <p className="text-sm text-white/80">{s.note}</p>
                </div>
                <p className="text-xl font-bold text-white">{s.value}</p>
                {i < all.length - 1 ? <span aria-hidden className="absolute -bottom-4 left-[2.3rem] h-4 w-px bg-white/30" /> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- Comparison */}
      <section aria-labelledby="compare-heading" className="py-16 md:py-24">
        <div className="container">
          <SectionHeading
            id="compare-heading"
            eyebrow="Why microgig"
            title="Built for small jobs, not long projects"
            intro="Typical freelance platforms are made for big, negotiated projects. microgig is made for the quick fix you need today."
          />
          <div className="mx-auto mt-12 max-w-4xl overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">microgig compared with typical freelance platforms</caption>
              <thead className="bg-surface">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold text-muted-foreground">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold text-muted-foreground">
                    Typical platforms
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold text-heading">
                    microgig
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Price", "Hourly rates or 3 pricing tiers", "One fixed price, $5–$50"],
                  ["Getting started", "Post a job, read proposals", "Order instantly, no bidding"],
                  ["Delivery", "Days to weeks", "24 or 48 hours"],
                  ["Scope", "Custom offers and negotiation", "A short questionnaire, fixed scope"],
                  ["Fees for clients", "Often a service fee on top", "None"],
                ].map(([feature, them, us]) => (
                  <tr key={feature}>
                    <th scope="row" className="px-5 py-4 font-semibold text-heading">
                      {feature}
                    </th>
                    <td className="px-5 py-4 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <X className="h-4 w-4 shrink-0" aria-hidden /> {them}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-heading">
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-heading" aria-hidden /> {us}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- For freelancers */}
      <section id="for-freelancers" aria-labelledby="freelancers-heading" className="scroll-mt-20 bg-heading py-20 text-white md:py-28">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white/80">For freelancers</p>
            <h2 id="freelancers-heading" className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Turn your skills into products people buy on the spot.
            </h2>
            <p className="mt-4 text-lg text-white/80">
              Stop writing proposals. Package what you do best as a fixed-price gig, and let clients order it instantly.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "No bidding or pitching, ever",
                "Requirements answered before you start",
                "A clear revision limit on every order",
                "Guaranteed payout 72 hours after delivery",
                "A “Verified” badge once your ID is approved",
              ].map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className="text-white">{b}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-10">
              <Link href="/register?role=freelancer">
                Start earning <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <EarningsCalculator />
        </div>
      </section>

      {/* --------------------------------------------------------------- FAQ */}
      <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 py-16 md:py-24">
        <div className="container max-w-3xl">
          <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered" />
          <Accordion type="single" collapsible className="mt-10">
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* --------------------------------------------------------- Final CTA */}
      <section aria-labelledby="cta-heading" className="pb-16 md:pb-20">
        <div className="container">
          <div className="rounded-3xl bg-surface px-4 py-12 sm:px-6 md:px-14 md:py-14">
            <h2 id="cta-heading" className="text-center text-3xl font-bold tracking-tight md:text-4xl">
              How will you use microgig?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Choose one when you sign up. An account is either a client or a freelancer.
            </p>
            <ul className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
              <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-background p-6 sm:p-8">
                <Briefcase className="h-8 w-8 text-heading" aria-hidden />
                <h3 className="mt-4 text-xl font-semibold">I want to hire</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed">
                  Get small tasks done fast by verified freelancers. Pay a fixed price, with escrow protection.
                </p>
                <Button asChild size="lg" className="mt-6">
                  <Link href="/register?role=client">Sign up as a client</Link>
                </Button>
              </li>
              <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-background p-6 sm:p-8">
                <Laptop className="h-8 w-8 text-heading" aria-hidden />
                <h3 className="mt-4 text-xl font-semibold">I want to work</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed">
                  Sell your skills as fixed-price gigs and get paid every time you deliver.
                </p>
                <Button asChild size="lg" variant="dark" className="mt-6">
                  <Link href="/register?role=freelancer">Sign up as a freelancer</Link>
                </Button>
              </li>
            </ul>
            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LogIn className="h-4 w-4" aria-hidden /> Already have an account?{" "}
              <Link href="/login" className="font-semibold text-heading underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
