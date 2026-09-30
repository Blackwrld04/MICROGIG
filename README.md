# microgig

Escrow-backed micro-freelance marketplace. The binding spec is **PRD v1.1**.

Stack (PRD §8.1): Next.js 14.2 App Router · TypeScript 5.4 · Tailwind CSS 3.4 · shadcn/Radix · Lucide · Zod 3.23.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright + axe WCAG 2.1 AA checks (run `npx playwright install` once) |

## Layout

```
src/
  app/(main)/        pages with the site header (catalog, gigs, orders, wallet, seller, admin, settings)
  app/(auth)/        login, register
  components/ui/     shadcn primitives (button, tabs, accordion, dialog, dropdown…)
  components/…       brand, layout, gig, order, common
  lib/               money (integer cents), time (late flag, countdown), api client, constants
  modules/<domain>/  domain modules (PRD §7.2); `contracts.ts` = shared Zod schemas
  mocks/             fixture data until the real APIs land
```

## Demo mode

Until the backend APIs exist, the app runs on fixture data in `src/mocks/` and you are signed in as a
sample user (buyer + seller + admin). Actions (accept, revise, deliver, withdraw…) run locally through
`modules/orders/state-machine.ts` and are not saved. Turn it off with `NEXT_PUBLIC_USE_MOCKS=false`.
Each `modules/*/queries.ts` function has a `TODO` where the real Prisma query goes; keep the signatures.

## Conventions

- **Money is integer cents.** Use `formatCents` / `parseDollarsToCents`; never float math.
- **Server Components call module functions directly** (e.g. `searchGigs`). `lib/api/client.ts` is for browser-side calls to `/api/v1`.
- **Colours:** PRD §16 tokens only. Text on the `#1DBF73` primary fill is charcoal `#222325` — white fails WCAG AA.
- **Placeholder pages** show the PRD refs, owner and sprint for each unbuilt screen.
