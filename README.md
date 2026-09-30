# microgig

Escrow-backed micro-freelance marketplace. The binding spec is **PRD v1.1**.

This is a **monorepo with two standalone apps**. Each has its own `package.json`, lockfile and
`node_modules`, and deploys on its own:

| App | What | Hosted on | Owner |
|---|---|---|---|
| [`apps/web`](apps/web) | Next.js 14 frontend (App Router, TypeScript, Tailwind, TanStack Query, Zustand) | **Vercel** | Frontend |
| [`apps/api`](apps/api) | Backend (placeholder: health check only) | **Render** or **Railway** | Backend |

```
microgig/
├── .env.example        ← every credential for every service (template, committed)
├── .env                ← your real values (git-ignored, you create it)
├── render.yaml         ← Render blueprint for apps/api
├── apps/
│   ├── web/            ← deploy to Vercel (Root Directory: apps/web)
│   └── api/            ← deploy to Render/Railway (root: apps/api)
└── package.json        ← convenience scripts only (no dependencies)
```

## Getting started

```bash
cp .env.example .env    # then fill in values (demo mode needs none)
npm run setup           # installs apps/web and apps/api
npm run dev             # frontend → http://localhost:3000
npm run dev:api         # backend placeholder → http://localhost:4000/api/v1/health
```

| Script (from the repo root) | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Frontend dev server / production build / serve the build |
| `npm run lint` / `typecheck` | ESLint / TypeScript for the frontend |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright + axe WCAG 2.1 AA checks (run `npx playwright install` in `apps/web` once) |

## Credentials: one `.env`

All credentials for all services live in **one file at the repo root**. [`.env.example`](.env.example)
lists every variable, grouped by where it's used:

- **`[WEB]`** (Vercel): `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_USE_MOCKS`, `API_URL`, `NEXT_PUBLIC_ASSETS_URL`
- **`[API]`** (Render/Railway): database, Redis, Upstash, JWT/cookie secrets, S3/R2, email, business constants

Locally, both apps read the root `.env`. In production, copy each section into that platform's
dashboard. **Anything prefixed `NEXT_PUBLIC_` is visible in the browser, so never put secrets there.**
`.env` is git-ignored; only `.env.example` is committed.

## How the frontend and backend work together

```
Browser ──► https://<app>.vercel.app/api/v1/*  ──(Vercel rewrite)──►  https://<api>.onrender.com/api/v1/*
```

- The browser only ever talks to the frontend's own domain. `apps/web/next.config.mjs` proxies
  `/api/v1/*` to `API_URL`, so the backend's session cookies are **first-party** on the Vercel domain.
  No CORS and no third-party-cookie problems.
- Server Components call `API_URL` directly and forward the user's cookies.
- Request/response shapes are Zod schemas in `apps/web/src/modules/*/contracts.ts`. The backend
  contract is documented in [`apps/api/README.md`](apps/api/README.md).

### Demo mode (current default)

With `NEXT_PUBLIC_USE_MOCKS="true"` the frontend runs **fully standalone**: the demo endpoints in
`apps/web/src/app/api/v1` serve sample data, and you sign in with one click at `/login`:

| Account | Email (any password) | Sees |
|---|---|---|
| Client | alice@example.com | Catalog, checkout, my orders, inbox, wallet |
| Freelancer | alex@example.com | Seller dashboard, gig wizard, orders to deliver, inbox, earnings |
| Admin | admin@microgig.dev | ID verifications, disputes, read-only orders |

Accounts are **either** client **or** freelancer, chosen at sign-up and never switchable (a deliberate
change from PRD §3.1). Actions are simulated in the browser and not saved.

**Switch to the real backend:** set `NEXT_PUBLIC_USE_MOCKS="false"` and `API_URL`. The same frontend
code then fetches from the backend through the proxy. The build fails fast if `API_URL` is missing.

## Deploying

### Frontend → Vercel

1. Vercel → **Add New Project** → import this repo.
2. **Root Directory:** `apps/web`. Framework: Next.js (auto-detected; see `apps/web/vercel.json`).
3. **Production Branch** (Settings → Git): `Frontend` (or `main` once merged).
4. **Environment Variables:** add the `[WEB]` section of `.env.example`.
   - Demo: `NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_APP_URL=https://<project>.vercel.app`
   - Real: also `NEXT_PUBLIC_USE_MOCKS=false` and `API_URL=https://<your-api-host>`
5. Deploy. `apps/web` has no dependencies outside its folder.

### Backend → Render or Railway

- **Render:** New → **Blueprint** → this repo (uses `/render.yaml`, `rootDir: apps/api`). Fill in the
  secrets marked `sync: false`.
- **Railway:** New service → this repo → Settings → **Root Directory** `apps/api` (uses
  `apps/api/railway.json`). Add the `[API]` variables.
- Health check: `GET /api/v1/health`. Then set the frontend's `API_URL` to the backend's URL.

## Frontend architecture (`apps/web`)

| Concern | Tool | Where |
|---|---|---|
| Server state (anything from `/api/v1`) | **TanStack Query** | `src/lib/query/` (keys, `queries`), `src/lib/api/server-data.ts` |
| Client-only state | **Zustand** | `src/stores/` (toasts, gig-wizard draft, inbox view) |
| Validation / contracts | Zod | `src/modules/*/contracts.ts` |
| UI | Tailwind 3.4 + shadcn/Radix + Lucide | `src/components/` |

**Data flow:** a Server Component prefetches with `serverData.*` into a per-request QueryClient, then
wraps the page in `<HydrationBoundary>`. Client components read the same keys with
`useQuery(queries.*)`, so pages arrive fully rendered and the first render doesn't refetch.
Writes use `useMutation`: optimistic cache updates in demo mode, and the PRD §12 endpoint plus
refetch in real mode (409 → refetch and explain).

## Conventions

- **Money is integer cents.** Use `formatCents` / `parseDollarsToCents`; never float math.
- **Colours:** PRD §16 tokens only. Text on the `#1DBF73` primary fill is charcoal `#222325`, because
  white fails WCAG AA (`src/lib/contrast.test.ts` enforces it).
- **Never commit `.env`**, and never import across apps: `apps/web` must stay deployable on its own.
