# RCH TV — Vercel Deployment Guide

This guide covers deploying **RCH TV** as a **single Vercel project** with photo storage in **Cloudflare R2** and a **Supabase PostgreSQL** database. All photos are served directly from Cloudflare's CDN, so Vercel egress is limited to tiny API JSON payloads.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Vercel Project Setup](#3-vercel-project-setup)
4. [Cloudflare R2 Photo Storage Setup](#4-cloudflare-r2-photo-storage-setup)
5. [Environment Variables](#5-environment-variables)
6. [Supabase Database Setup](#6-supabase-database-setup)
7. [Deploy to Vercel](#7-deploy-to-vercel)
8. [Post-Deployment Checks](#8-post-deployment-checks)
9. [Local Development](#9-local-development)
10. [Egress & Cost Optimization](#10-egress--cost-optimization)
11. [Monitoring & Troubleshooting](#11-monitoring--troubleshooting)
12. [Custom Domain Setup](#12-custom-domain-setup)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  User's Phone                        │
│  (scans QR code, submits shoutout/song/fame)         │
└──────────────┬──────────────────────────┬───────────┘
               │ HTTPS                    │ HTTPS
               ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────┐
│      Vercel (Next.js)    │   │  Cloudflare R2 CDN    │
│                          │   │                      │
│  • HTML pages            │   │  • Photo delivery     │
│  • API routes (JSON)     │   │  • Zero egress cost   │
│  • Session management    │   │  • Global CDN cache    │
│  • DJ Console            │   │                      │
└──────────┬───────────────┘   └──────────────────────┘
           │
           │ PostgreSQL
           ▼
┌──────────────────────┐
│     Supabase DB      │
│  (PostgreSQL, Drizzle)│
└──────────────────────┘
```

**Key design decisions for zero Vercel egress:**

- Photos are uploaded via the server (API routes) **directly to Cloudflare R2**
- The database stores only the **public R2 URL** — a tiny string
- `/api/fame/image/[id]` returns a **302 redirect** to the R2 CDN URL — no bytes travel through Vercel
- The TV display loads images straight from Cloudflare's CDN
- Only JSON API responses and HTML pages go through Vercel

---

## 2. Prerequisites

- ✅ GitHub repository with the RCH TV code
- ✅ **Supabase** project (free tier) — already set up per your instructions
- ✅ **Cloudflare** account (free at [dash.cloudflare.com](https://dash.cloudflare.com))
- ✅ **Vercel** account (free at [vercel.com](https://vercel.com))
- Node.js 18+ locally (for database migrations)

---

## 3. Vercel Project Setup

### 3.1 Create a Single Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your **`rch-tv`** GitHub repository
3. Vercel auto-detects Next.js — keep all defaults
4. **Framework Preset:** Next.js (auto-detected)
5. **Root Directory:** `./` (default)
6. **Build Command:** `npm run build`
7. **Output Directory:** `.next` (default)

### 3.2 (Optional) Configure for a Monorepo

If your repo has other files at root level, the settings above still work — Next.js ignores non-source files.

---

## 4. Cloudflare R2 Photo Storage Setup

R2 stores all photos and serves them via Cloudflare's CDN with **no egress fees**.

### 4.1 Create the R2 Bucket

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **R2** → **Create bucket**
3. **Bucket name:** `rch-tv-photos` (or your preference)
4. **Location:** Automatic (or pick nearest to your audience)
5. Click **Create bucket**

### 4.2 Create R2 API Token

1. In R2 dashboard, go to **Manage R2 API Tokens** → **Create API Token**
2. **Permissions:** Select **Object Read & Write**
3. **TTL:** Select **Never** (or a long expiry)
4. Click **Create**
5. **IMPORTANT:** Copy these values immediately — they won't be shown again:
   - **Access Key ID** (looks like: `abc123def456...`)
   - **Secret Access Key** (looks like: `xyz789...`)

### 4.3 Get Your Account ID

1. In Cloudflare dashboard, look at the right sidebar
2. Under **API** section, find **Account ID**
3. Copy it — it's a hex string like `abc123def456...`

### 4.4 (Optional) Set Up Public Access

R2 buckets have two access modes:

**Option A — Public bucket URL (simplest):**
- In R2 → Your bucket → **Settings** → **Public access**
- Allow access
- Your public URL will be: `https://pub-<hash>.r2.dev/<bucket-name>/`
- Set this as `R2_PUBLIC_URL`

**Option B — Custom domain (recommended for production):**
- In R2 → Your bucket → **Settings** → **Custom Domains**
- Add your domain (e.g., `media.rch-tv.com`)
- Cloudflare handles DNS + SSL automatically
- Set `R2_PUBLIC_URL` to your custom domain

---

## 5. Environment Variables

Set these in your Vercel project dashboard at **Settings → Environment Variables**.

### Required Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://postgres:...@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true` |
| `DJ_CONSOLE_PASSWORD` | Password for the DJ Console | Choose something secure |
| `R2_ACCOUNT_ID` | Cloudflare Account ID | `abc123def456...` |
| `R2_ACCESS_KEY_ID` | R2 API token access key | From R2 token creation |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | From R2 token creation |
| `NEXT_PUBLIC_PUBLIC_APP_URL` | Your Vercel deployment URL | `https://rch-tv.vercel.app` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DJ_CONSOLE_USERNAME` | DJ Console username | `dj` |
| `R2_BUCKET` | R2 bucket name | `rch-tv-photos` |
| `R2_PUBLIC_URL` | Public R2 access URL | Auto-derived from bucket name |
| `NEXT_PUBLIC_PRODUCTION_MODE` | Set to `true` to hide sandbox nav bar | (unset = visible in dev) |

### How to Add in Vercel

1. In your Vercel project, go to **Settings → Environment Variables**
2. **Environment:** Select **Production** (and Preview if desired)
3. Add each variable key and value
4. Click **Save**

---

## 6. Supabase Database Setup

### 6.1 Push the Schema

Run this locally (or in a GitHub Action) pointing at your Supabase database:

```bash
# Using the PostgreSQL Drizzle config
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres?pgbouncer=true" \
  npx drizzle-kit push --config=drizzle.config.pg.json
```

This creates all the tables:
- `shoutouts` — TV shoutout submissions
- `song_requests` — Song request submissions
- `fame_submissions` — Wall of Fame photo submissions
- `instagram_followers` — Follower database for verification
- `app_settings` — Key-value settings (sessions, etc.)
- `social_posts` — Posted social media content

### 6.2 Verify Tables

You can verify tables were created in Supabase dashboard → **Table Editor**.

### 6.3 Set Up Followers Database

The app checks if a user follows @jakarl_dj on Instagram by looking up their handle in the `instagram_followers` table. You need to populate this table.

**Option A — Manual inserts:**
```sql
INSERT INTO instagram_followers (handle) VALUES ('known_follower_1'), ('known_follower_2');
```

**Option B — Use the DJ Console** after deploying (navigate to `/dj` and use the admin features).

---

## 7. Deploy to Vercel

### 7.1 Initial Deploy

1. Go to your Vercel project dashboard
2. Navigate to the **Deployments** tab
3. Click **Deploy** (or push to your Git branch for auto-deploy)
4. Wait for the build to complete (~2-3 minutes)
5. Once done, Vercel shows your deployment URL, e.g.: `https://rch-tv.vercel.app`

### 7.2 Update Public App URL

1. In Vercel **Settings → Environment Variables**
2. Update `NEXT_PUBLIC_PUBLIC_APP_URL` to your actual Vercel domain
3. Trigger a new deployment for the change to take effect

### 7.3 Set Up the DJ Console Session

1. Visit `https://your-app.vercel.app/dj`
2. Log in with the username/password you set
3. Generate a new public session (this creates the QR code)
4. The TV display (`/tv`) will now show the QR code for users to scan

---

## 8. Post-Deployment Checks

### Checklist

- [ ] Visit `/api/health` — should return `{ "ok": true }`
- [ ] Visit `/dj` — DJ Console loads, login works
- [ ] Generate a session from DJ Console → `/tv` shows QR code
- [ ] Scan QR code on phone → landing page loads
- [ ] Submit a shoutout → appears in DJ Console moderation
- [ ] Submit a song request → appears in DJ Console
- [ ] Submit a "Make Me Famous" photo → photo uploads to R2
- [ ] Approve a submission from DJ Console → appears on TV display

### Test Photo Upload

When testing "Make Me Famous":
1. The photo uploads via the API route to Cloudflare R2
2. The database stores the R2 public URL
3. The TV display loads the image from R2's CDN
4. You can check R2 dashboard to confirm photos are in the bucket

---

## 9. Local Development

### 9.1 Setup

```bash
# Copy env example
cp .env.example .env
# Edit .env with your local Postgres and R2 credentials

# Install dependencies (already done in sandbox)
npm install

# Push database schema to local Postgres
npx drizzle-kit push --config=drizzle.config.pg.json

# Run dev server
npm run dev
```

### 9.2 Environment Variables for Local Dev

```env
# .env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
DJ_CONSOLE_USERNAME=dj
DJ_CONSOLE_PASSWORD=local_test_password
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET=rch-tv-photos
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
NEXT_PUBLIC_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PRODUCTION_MODE=
```

---

## 10. Egress & Cost Optimization

### Why You Won't Hit Vercel's 10GB/Month Limit

| Asset Type | Goes Through Vercel? | Approx Size | Monthly Estimate (10k users) |
|------------|---------------------|-------------|------------------------------|
| HTML pages | ✅ Yes | ~5 KB | 50 MB |
| API JSON responses | ✅ Yes | ~500 bytes | 50 MB |
| CSS/JS bundles | ✅ Yes (cached) | ~200 KB once | 2 GB (first load only) |
| **Photos** | **❌ No — direct from R2 CDN** | 500 KB–2 MB | **0 GB (zero egress)** |
| **TV polling** | ✅ Yes | ~100 bytes | ~10 MB per screen/day |
| **QR codes** | ✅ Yes (generated client-side) | ~4 KB base64 | Negligible |

**Total estimated Vercel egress:** ~2-3 GB/month — well within the 10 GB free tier.

### Built-in Optimizations

1. **Two-tier TV polling** — `/api/tv/check` (lightweight) polls every 2s, full content only on change
2. **Cache headers** — static assets cached for 1 year at edge
3. **302 redirect for images** — `/api/fame/image/[id]` just redirects to R2, no bytes proxied
4. **Client-side QR generation** — QR codes are generated in the browser, not on the server

### Scaling Beyond Free Tier

If you need more:
- Vercel Pro ($20/mo): 1 TB bandwidth, 1000 GB-hours serverless
- Or switch to Cloudflare Pages for truly unlimited bandwidth (see `CLOUDFLARE_MIGRATION.md`)

---

## 11. Monitoring & Troubleshooting

### Vercel Dashboard

- **Deployments:** Vercel Dashboard → Deployments (check build logs on failure)
- **Functions:** Vercel Dashboard → Functions (view API invocation logs)
- **Analytics:** Vercel Dashboard → Analytics (bandwidth, requests, speed)

### Common Issues

**Build fails:**
- Verify all environment variables are set in Vercel (especially `DATABASE_URL`)
- Check the build log in Vercel dashboard for specific errors
- Run `npm run build` locally to reproduce

**API returns 500:**
- Check Vercel Function logs for the error
- Verify `DATABASE_URL` is correct and Supabase allows connections from Vercel IPs
- In Supabase dashboard → Database → Connection pooling — ensure it's enabled

**Photos not loading on TV:**
- Check Cloudflare R2 bucket for the uploaded file
- Verify `R2_PUBLIC_URL` is correctly set in Vercel env vars
- The `/api/fame/image/[id]` route returns a 302 — check browser network tab

**QR code not showing on TV:**
- Visit `/api/admin/session` directly — should return `{ "session": "..." }`
- Verify `NEXT_PUBLIC_PUBLIC_APP_URL` is set
- Generate a new session from DJ Console

**403 Session Expired errors:**
- The DJ needs to create a new session from the DJ Console
- Sessions are stored in the `app_settings` table
- Generate a fresh QR code on the TV display

---

## 12. Custom Domain Setup

1. In Vercel project → **Settings → Domains**
2. Enter your domain (e.g., `rch-tv.com`)
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_PUBLIC_APP_URL` to the custom domain
5. Redeploy for changes to take effect

### CNAME Record

Most domain providers need a CNAME record pointing `rch-tv.com` (or `www`) to `cname.vercel-dns.com`.

### If Using Cloudflare DNS

If your domain DNS is already on Cloudflare:
1. Turn on **Proxy (orange cloud)** for the DNS record
2. This gives you Cloudflare's CDN in front of Vercel
3. Photos from R2 will also benefit from Cloudflare's cache

---

## Appendix: Quick Reference

### NPM Scripts

```bash
npm run dev          # Local development
npm run build        # Production build
npm run start        # Start production server
npm run db:push      # Push schema to local PostgreSQL
npm run db:push:prod # Push schema to Cloudflare D1 (production)
npm run db:studio    # Drizzle Studio UI
```

### Key URLs After Deploy

| URL | Purpose | Auth Required |
|-----|---------|--------------|
| `/` | Public landing page (users scan QR) | No |
| `/dj` | DJ Console (moderation, session) | Yes (Basic Auth) |
| `/tv` | TV Display (fullscreen) | No |
| `/api/health` | Health check | No |
| `/api/admin` | Admin API | Yes (Basic Auth) |

### File Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page (re-exports client)
│   │   ├── page.client.tsx       # Landing page functionality
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Tailwind + Vortax font
│   │   ├── dj/                   # DJ Console (layout + page)
│   │   ├── tv/                   # TV Display
│   │   ├── dashboard/            # User dashboard after login
│   │   ├── make-famous/          # Fame photo submission
│   │   ├── shoutout/             # Shoutout submission
│   │   ├── song-request/         # Song request submission
│   │   └── api/                  # All API routes
│   ├── db/
│   │   ├── index.ts              # PostgreSQL connection + Drizzle client
│   │   ├── schema.ts             # Schema re-export
│   │   ├── schema.pg.ts          # PostgreSQL table definitions
│   │   └── types.ts              # Type helpers
│   ├── lib/
│   │   ├── photoStorage.ts       # Cloudflare R2 upload logic
│   │   ├── session.ts            # Public session management
│   │   ├── profanity.ts          # Profanity filter
│   │   ├── useSessionGuard.ts    # Client-side session hook
│   │   ├── useSmartPolling.ts    # Two-tier polling hook
│   │   └── useRotatingPlaceholder.ts
│   ├── components/
│   │   ├── SandboxSwitcher.tsx    # Dev nav bar (hidden in production)
│   │   ├── OnTvLiveBadge.tsx
│   │   └── EndOfNightModal.tsx
│   └── middleware.ts              # Basic Auth + routing middleware
├── drizzle.config.json           # D1 config (Cloudflare)
├── drizzle.config.pg.json        # PostgreSQL config (local/Supabase)
├── drizzle.config.prod.ts        # Production D1 config
├── next.config.ts                # Next.js config (Vercel-ready)
└── .env.example                  # All required environment variables
```

---

## Support

For issues:
1. Check Vercel deployment logs
2. Review this guide's troubleshooting section
3. Check Supabase database logs
4. Verify R2 credentials in Vercel env vars
