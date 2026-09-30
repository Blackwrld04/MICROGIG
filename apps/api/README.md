# microgig API (`apps/api`)

The backend: deploys to **Render** or **Railway**, separately from the frontend on Vercel.

> **Status: placeholder.** `src/server.mjs` only answers `GET /api/v1/health` and returns `501` for
> everything else. The backend owner picks the framework and replaces it. Keep the health route and `PORT`.

## Run locally

```bash
npm --prefix apps/api run dev     # http://localhost:4000/api/v1/health
```

Credentials come from the **single repo-root `.env`** (template: `/.env.example`, section `[API]`).

## Deploy

| Platform | How |
|---|---|
| Render | New → Blueprint → this repo. Uses `/render.yaml` (`rootDir: apps/api`). Fill the `sync: false` secrets in the dashboard. |
| Railway | New service → this repo → Settings → Root Directory `apps/api`. Uses `apps/api/railway.json`. Add the `[API]` variables from `.env.example`. |

## How the frontend talks to this API

```
Browser ──► https://<app>.vercel.app/api/v1/*  ──(Vercel rewrite)──►  https://<api>.onrender.com/api/v1/*
```

- The browser **never calls this API's domain directly**. The frontend proxies `/api/v1/*` here
  (`apps/web/next.config.mjs`, active when `NEXT_PUBLIC_USE_MOCKS="false"` and `API_URL` is set).
- So cookies this API sets land on the **frontend's** domain and are first-party. No CORS or
  `SameSite=None` needed. Set cookies **without a `Domain` attribute**; the PRD's
  `__Host-access_token` / `__Host-refresh_token` names (HttpOnly, Secure, Path=/) work as-is.
- Trust the proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`) for rate-limit keys and session IPs.
- Server Components also call `API_URL` directly and forward the user's `Cookie` header.
- CORS: only needed as a fallback. Allow exactly `WEB_ORIGIN` with credentials if you enable it.

## What the frontend expects (contract)

Shapes are defined as Zod schemas in `apps/web/src/modules/*/contracts.ts`. Match them, or tell the
frontend owner what changed.

- **Prefix:** everything under `/api/v1` (PRD §12).
- **Errors:** `{ "error": { "message": string, "fieldErrors"?: { [field]: string } } }` with status
  401 / 402 / 403 / 404 / 409 / 422 / 429 as in PRD §12 and Appendix D.
- **Accounts are client XOR freelancer** (deliberate change from PRD §3.1):
  - `users.account_type` = `CLIENT` | `FREELANCER`, set at registration, never changes.
  - `POST /api/v1/auth/register` body: `{ accountType, email, password, fullName }`.
  - `GET /api/v1/auth/me` → `{ id, email, fullName, accountType, isAdmin, isSeller }`
    (`isSeller` = `accountType === "FREELANCER"`).
  - Only clients may place orders; only freelancers may create gigs or deliver.
- **Endpoints the frontend already calls** (demo versions live in `apps/web/src/app/api/v1`):

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Set / clear session cookies |
| GET | `/auth/me` | Current user or 401 |
| GET | `/gigs?category=&subcategory=&search=&sort=&page=` | `{ gigs, total, page }` |
| GET | `/gigs/:slug` | Gig detail |
| GET | `/gigs/:id/more-from-seller` | Up to 5 gigs |
| GET | `/sellers/:id` | Public seller page (not in PRD §12, added) |
| GET | `/orders/user/me?tab=&q=` | `{ counts, orders }` for the caller's side |
| GET | `/orders/:id` | Order workspace, participant or admin only (403/404 otherwise) |
| GET | `/inbox` | Message threads for the caller (not in PRD §12, added) |
| GET | `/notifications` | `{ unreadCount, notifications }` |
| GET | `/wallet` | Client or freelancer wallet summary + activity |
| GET | `/me/dashboard`, `/me/seller-profile`, `/me/sessions` | Freelancer / account pages |
| GET | `/notification-prefs` | NOT-02 matrix |
| GET | `/admin/verifications`, `/admin/disputes` | Admin only (not in PRD §12, added) |

Order actions, wallet top-up/withdraw, favorites, messages and admin decisions are simulated in the
browser in demo mode; each call site is marked `TODO` with the PRD endpoint it should hit.
