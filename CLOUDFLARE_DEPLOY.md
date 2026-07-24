# RCH-TV — Cloudflare R2 + Pages Deployment Guide

> **Your Status:** ✅ Step 1 (bucket created) · ✅ Step 2 (API token) · ✅ Step 3 (env vars in `.env`)
> ✅ `.env` is in `.gitignore` — safe from GitHub
>
> **Next:** Step 4

---

## Why R2?

| Resource | Supabase Free | Cloudflare R2 |
|---|---|---|
| **Egress (photos)** | Counts toward your 5GB limit | **$0 — always free** |
| **Storage** | 1 GB files | 10 GB free |
| **Operations** | — | 1M writes / 10M reads free |

**Supabase stays for:** PostgreSQL (shoutouts, songs, handles, settings) — that data is tiny.
**R2 handles:** All photo uploads. DB stores only the URL string (~50 bytes).

---

## ✅ Step 1 — Create R2 Bucket (DONE)

```bash
npx wrangler r2 bucket create rch-tv-photos
```

---

## ✅ Step 2 — Generate R2 API Credentials (DONE)

1. Cloudflare Dashboard → R2 → **Manage R2 API Tokens**
2. Click **Create API Token**
3. Permission: **Admin Read & Write**
4. Copied: **Access Key ID** + **Secret Access Key**

> ⚠️ **Security note:** The Secret Access Key is shown **once** — save it in your `.env` immediately.
> Never commit `.env` to GitHub (already handled — it's in `.gitignore`).

---

## ✅ Step 3 — Add Env Vars to `.env` (DONE)

Your `.env` should have these (values were filled in locally):

```ini
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=from_step_2
R2_SECRET_ACCESS_KEY=from_step_2
R2_BUCKET=rch-tv-photos
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
DATABASE_URL=postgresql://postgres:...@supabase.co:5432/postgres
```

---

## 🔲 Step 4 — Make Bucket Public + Set Public URL

**This is the most important step** — without it, images won't load on TV.

1. Cloudflare Dashboard → R2 → **rch-tv-photos** bucket
2. Click **Settings** tab
3. Under **Public Access**, click **Allow access**
4. Copy the **Public Bucket URL** that appears (looks like `https://pub-xxxxxxxxxxxxxxxxxxxxx.r2.dev`)
5. Paste it as the value for `R2_PUBLIC_URL` in your `.env`

---

## 🔲 Step 5 — Test Photo Upload Locally

```bash
npm run dev
```

1. Open the app → **Make Me Famous**
2. Take a photo and submit
3. Check Cloudflare R2 dashboard — the photo file should appear
4. Check your Supabase DB — `fame_submissions.image_url` should have the R2 URL

---

## 🔲 Step 6 — Deploy to Cloudflare Pages

```bash
npm run deploy
```

Then add the same 5 R2 env vars in Cloudflare Pages dashboard:
- Project → Settings → Environment Variables → **Add** all 5 R2 vars + `DATABASE_URL` + `DJ_CONSOLE_PASSWORD`

---

## Architecture

```
User's phone (camera) → Next.js API route → Cloudflare R2 (stored)
                                          → PostgreSQL (URL only)

TV Display → loads <img src="https://pub-xxx.r2.dev/fame-xxx.jpg">
           → served from Cloudflare CDN → ZERO EGRESS ON EVERYTHING
```

## Egress After Migration

| What | Before (base64 in DB) | After (R2 URLs) |
|---|---|---|
| Photo upload | 2-5 MB DB write (egress) | **0 MB** — direct to R2 |
| DJ Console load (100 photos) | 200-500 MB | **~5 KB** (just URLs) |
| TV polling (photo data) | 2-10 MB per fetch | **~200 bytes** |
| Image serving | via Supabase proxy | via Cloudflare CDN |
| **Monthly total** | **~14 GB** ❌ | **~200 MB** ✅ |
