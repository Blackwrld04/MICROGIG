# microgig API (`apps/api`)

The backend: Fastify 4 + Drizzle ORM on PostgreSQL. It deploys to **Render** or **Railway**,
separately from the frontend on Vercel.

## Run locally

```bash
npm --prefix apps/api install
npm --prefix apps/api run db:migrate   # applies drizzle/0000…0005
ADMIN_PASSWORD='choose-a-long-one' npm --prefix apps/api run db:seed
npm --prefix apps/api run dev          # http://localhost:4000/api/v1/health
```

Settings come from the **single repo-root `.env`** (template: `/.env.example`, section `[API]`).
Without an email provider, development prints every email (sign-up codes included) to the API log.

## Tests

```bash
npm --prefix apps/api test             # unit tests; the integration suite is skipped
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/microgig_test npm --prefix apps/api test
```

The integration suite (`test/integration`) **drops and recreates the `public` schema** of
`TEST_DATABASE_URL`, runs the migrations and the seed, then drives the real app with `app.inject`
and an in-process fake S3. Use a throwaway database.

## Deploy

| Platform | How |
|---|---|
| Render | New → Blueprint → this repo. Uses `/render.yaml` (`rootDir: apps/api`). Fill the `sync: false` secrets in the dashboard. |
| Railway | New service → this repo → Settings → Root Directory `apps/api`. Uses `apps/api/railway.json`. Add the `[API]` variables from `.env.example`. |

Run `npm run db:migrate` against the production database before starting a new version.
The cron jobs run inside the API process and take a Postgres advisory lock each, so running
several instances is safe.

## How the frontend talks to this API

```
Browser ──► https://<app>.vercel.app/api/v1/*  ──(Vercel rewrite)──►  https://<api>.onrender.com/api/v1/*
```

- The browser never calls this API's domain directly, so the `sid` session cookie is first-party
  on the frontend's domain (HttpOnly, SameSite=Lax, 30 days, no `Domain` attribute).
- Rate limits key on the client IP from `X-Forwarded-For`. Set `TRUST_PROXY_HOPS` to the number
  of proxies in front of the API (2 for Vercel → Render), otherwise every user shares one limit.
- Server Components also call `API_URL` directly and forward the user's `Cookie` header.

## Conventions

- **Prefix:** everything under `/api/v1`.
- **Errors:** `{ "error": { "message": string, "fieldErrors"?: { [field]: string } } }`.
- **Money:** integer cents. Fees use round-half-up (`lib/money.ts`); every ledger transaction sums
  to zero (checked in code and by a deferred trigger); the nightly audit checks the invariants.
- **Accounts are client XOR freelancer**, chosen at sign-up.
- **Idempotency:** `POST /orders`, `/orders/:id/complete`, `/orders/:id/dispute`, `/wallet/topup`
  and `/wallet/withdraw` accept an `Idempotency-Key` header. A retry replays the first response
  (`Idempotent-Replayed: true`); the same key with a different body is a 422.

## Security notes

- **Sign-up codes:** 6 digits from a CSPRNG, stored only as a keyed SHA-256, valid 15 minutes,
  5 guesses, one email per address per minute and 5 per hour. `send-code` answers the same for
  new and existing emails; an existing account gets a "sign in instead" email, never a code.
- **Login:** 10/min per IP + email; 5 failures lock the account for 15 minutes.
- **Deliveries:** the server downloads each upload and checks size, SHA-256, type (magic bytes),
  and reads ZIP file trees itself. Buyers get the storage key (and so the download) only after
  `COMPLETED`; image deliveries get a watermarked WEBP preview at `/deliveries/:id/preview`.
- **Unverified sellers** (SEL-02) are hidden from search, gig and seller pages, and can't be ordered.
- **Emails** are an outbox: rows are written in the same transaction as the change and sent by
  the dispatcher after commit, with retries.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/send-code`, `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/logout-all` | Session cookie `sid` |
| GET | `/auth/me`, `/me/sessions`; DELETE `/me/sessions/:id`, `/me/sessions` | |
| GET | `/gigs?category=&subcategory=&search=&sort=&page=` | `{ gigs, total, page }` |
| GET | `/gigs/:slug`, `/gigs/:id/more-from-seller`, `/sellers/:id` | |
| POST / PUT | `/gigs`, `/gigs/:id` | Freelancer. PUT edits any field, or `status` |
| POST | `/gigs/:id/favorite` | |
| GET / PUT / POST | `/me/seller-profile`, `/me/seller-profile/submit`, `/me/dashboard` | Freelancer |
| POST | `/orders` | Client, `Idempotency-Key` |
| GET | `/orders/user/me?tab=&q=`, `/orders/:id` | Participant or admin |
| POST | `/orders/:id/requirements`, `/deliveries`, `/complete`, `/revision`, `/cancel`, `/dispute`, `/review`, `/star` | |
| GET / POST | `/orders/:id/messages` | 30/min per user |
| POST | `/deliveries/presign-upload`, `/uploads/presign` | Freelancer, 20/h per user |
| GET | `/deliveries/:fileKey/download`, `/deliveries/:id/preview` | |
| GET | `/inbox`, `/notifications`; POST `/notifications/read` | |
| GET / PUT | `/notification-prefs` | |
| GET | `/wallet`, `/wallet/activity?format=csv` | |
| POST | `/wallet/topup` (client), `/wallet/withdraw` (freelancer) | `Idempotency-Key` |
| GET / PATCH / POST | `/admin/verifications`, `/admin/verifications/:id`, `/admin/disputes`, `/admin/disputes/:id/resolve` | Admin |
| GET | `/health` | |
