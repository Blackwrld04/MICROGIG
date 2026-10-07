# 🚀 MicroGig Deployment Guide (Render & Vercel)

This guide walks you through deploying **MicroGig** to production using **Render** for the backend API & PostgreSQL database, and **Vercel** for the Next.js frontend.

---

## 🏛️ Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │              User Browser              │
                      └──────────────────┬─────────────────────┘
                                         │
                   1. Visits Web Pages & │ 2. Same-origin requests
                      Server-rendered UI │    to /api/v1/*
                                         ▼
                     ┌───────────────────────────────────────┐
                     │          Vercel (apps/web)            │
                     │         Next.js 14 App Router         │
                     └───────────────────┬───────────────────┘
                                         │
                                         │ Next.js Rewrites Proxy
                                         │ /api/v1/* ──► Render Backend
                                         ▼
                     ┌───────────────────────────────────────┐
                     │          Render (apps/api)            │
                     │         Fastify REST API & Cron       │
                     └───────────────────┬───────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │          Render PostgreSQL            │
                     │          Ledger & DB Storage          │
                     └───────────────────────────────────────┘
```

> **Why this setup?**
> Next.js on Vercel proxies all `/api/v1/*` requests server-to-server to Render. Because the browser communicates with `https://your-domain.vercel.app/api/v1/*`, authentication session cookies are **first-party**, completely bypassing third-party cookie restrictions and cross-origin CORS issues.

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:
1. A **[GitHub](https://github.com)** account with access to your `MICROGIG` repository.
2. A **[Render](https://render.com)** account.
3. A **[Vercel](https://vercel.com)** account.

---

## 1️⃣ Step 1: Deploy Backend & Database on Render

### Option A: Automatic Blueprint (Recommended — 1 Click)

The repository includes a ready-to-use [`render.yaml`](./render.yaml) blueprint that automatically provisions the PostgreSQL database and the API service together.

1. Go to your **[Render Dashboard](https://dashboard.render.com/)**.
2. Click **New +** ➔ **Blueprint**.
3. Connect your GitHub account and select the **MICROGIG** repository.
4. Render will detect `render.yaml` and display:
   - **Service**: `microgig-api` (Web Service)
   - **Database**: `microgig-postgres` (PostgreSQL Database)
5. Fill in the prompted variables:
   - `WEB_ORIGIN`: Your temporary or expected Vercel domain (e.g., `https://microgig.vercel.app`). You can update this after deploying Vercel.
6. Click **Apply**.
7. Render will automatically:
   - Provision the PostgreSQL database.
   - Install dependencies and build the TypeScript backend.
   - Run Drizzle migrations (`npm run db:migrate`) to create all tables and triggers.
   - Launch the API service.

---

### Option B: Manual Setup on Render

If you prefer configuring services manually on Render:

#### 1. Create PostgreSQL Database
1. In Render, click **New +** ➔ **PostgreSQL**.
2. Name: `microgig-postgres`
3. Database: `microgig`
4. User: `microgig`
5. Plan: `Free` (or higher)
6. Click **Create Database**.
7. Once created, copy the **Internal Database URL** (or External Database URL).

#### 2. Create Backend Web Service
1. In Render, click **New +** ➔ **Web Service**.
2. Connect your **MICROGIG** repository.
3. Configure settings:
   - **Name**: `microgig-api`
   - **Region**: Same region as your database
   - **Branch**: `main`
   - **Root Directory**: `apps/api`
   - **Runtime**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build && npm run db:migrate`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/v1/health`
4. Add the following **Environment Variables**:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Required |
| `DATABASE_URL` | `postgresql://...` | Paste your Render PostgreSQL URL |
| `WEB_ORIGIN` | `https://your-microgig.vercel.app` | Your Vercel frontend URL (without trailing slash) |
| `COOKIE_SECRET` | *(Click "Generate")* | Must be at least 32 characters |
| `JWT_ACCESS_SECRET` | *(Click "Generate")* | Secure random string |
| `JWT_REFRESH_SECRET` | *(Click "Generate")* | Secure random string |
| `EMAIL_FROM` | `MicroGig <notifications@microgig.dev>` | Email sender identity |
| `PLATFORM_FEE_BPS` | `2000` | 20% platform fee |
| `AUTO_COMPLETE_DELAY_HOURS` | `72` | 72h review window |

5. Click **Create Web Service**.
6. Once deployed, copy your Render Web Service URL (e.g., `https://microgig-api.onrender.com`).
7. Verify it is running by visiting:
   ```bash
   https://microgig-api.onrender.com/api/v1/health
   # Expected response: {"status":"ok","service":"microgig-api","time":"..."}
   ```

---

## 2️⃣ Step 2: Deploy Frontend on Vercel

1. Go to your **[Vercel Dashboard](https://vercel.com/)**.
2. Click **Add New…** ➔ **Project**.
3. Import your **MICROGIG** repository.
4. In the project configuration screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click "Edit" and choose `apps/web` (or leave default if using root `vercel.json`).
5. Expand **Environment Variables** and add:

| Variable | Value | Notes |
|---|---|---|
| `API_URL` | `https://microgig-api.onrender.com` | Your Render Web Service URL (NO trailing slash) |
| `NEXT_PUBLIC_USE_MOCKS` | `false` | Disables mock data and activates real backend mode |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your live Vercel URL |

6. Click **Deploy**.
7. Vercel will build and deploy the Next.js app in ~1-2 minutes.

---

## 3️⃣ Step 3: Link & Finalize Domain Settings

1. Copy your live Vercel domain (e.g., `https://microgig.vercel.app`).
2. Go back to your **Render Dashboard** ➔ `microgig-api` ➔ **Environment**.
3. Ensure `WEB_ORIGIN` matches your live Vercel URL exactly:
   ```
   WEB_ORIGIN=https://microgig.vercel.app
   ```
4. Save changes. Render will automatically trigger a zero-downtime redeploy with the updated origin.

---

## 4️⃣ Step 4: Optional Production Integrations

### A. Transactional Emails (Registration Verification Codes & Order Alerts)

To send real verification emails and order notifications, add either **Gmail SMTP** or **Resend** to your Render environment variables:

#### Option 1: Gmail SMTP (No Custom Domain Required)
1. Go to your Google Account ➔ **Security** ➔ **2-Step Verification** ➔ **App Passwords**.
2. Generate an App Password for "Mail".
3. Add to Render:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx
   SMTP_SECURE=true
   EMAIL_FROM=MicroGig <your-email@gmail.com>
   ```

#### Option 2: Resend
1. Sign up at [resend.com](https://resend.com) and obtain an API key.
2. Add to Render:
   ```env
   RESEND_API_KEY=re_123456789
   EMAIL_FROM=MicroGig <onboarding@resend.dev>
   ```

---

### B. Cloud File Storage (S3 / Cloudflare R2)

For gig gallery showcase images and order deliverables:
Add to Render:
```env
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com # or AWS endpoint
S3_ACCESS_KEY_ID=your-key-id
S3_SECRET_ACCESS_KEY=your-secret-key
S3_PUBLIC_BUCKET_NAME=microgig-showcase-public
S3_PRIVATE_BUCKET_NAME=microgig-deliverables-private
STORAGE_PUBLIC_URL=https://pub-<id>.r2.dev # optional public CDN domain
```

---

## 5️⃣ Verification & Health Checks

Once deployed, run these verification steps:

1. **Backend Health**:
   ```bash
   curl -I https://microgig-api.onrender.com/api/v1/health
   # Must return: HTTP/1.1 200 OK
   ```

2. **Frontend Loading**:
   Visit `https://your-project.vercel.app`. The landing page should render with all marketing hero cards and catalog links.

3. **User Registration & Database Integration**:
   - Navigate to `/register`.
   - Sign up with a new email address.
   - Confirm password and submit.
   - Verify confirmation code is received and user session cookie is set.

4. **Escrow & Order Flow**:
   - Sign in as a freelancer, complete onboarding profile, and post a gig.
   - Sign in as a client and fund a fixed-price order into escrow.
   - Verify balance updates accurately in `/wallet`.

---

## 🛠️ Common Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| **CORS error on login or fetch** | `WEB_ORIGIN` does not match your Vercel URL. | Update `WEB_ORIGIN` on Render to match your exact Vercel protocol and domain (e.g. `https://my-app.vercel.app`, no trailing slash). |
| **API returns 404 on all routes** | Vercel rewrite not reaching Render. | Verify `API_URL` is set in Vercel project environment variables without a trailing slash, and `NEXT_PUBLIC_USE_MOCKS="false"`. |
| **Database connection error** | Missing SSL or invalid database URL. | Render PostgreSQL requires SSL in production. Our connection pool automatically enables `{ rejectUnauthorized: false }`. |
| **Render build fails: `tsc: command not found`** | `devDependencies` were skipped during npm install. | Ensure Build Command includes `--include=dev`: `npm install --include=dev && npm run build && npm run db:migrate`. |
