# RCH TV Deployment Guide

## Quick Start: Cloudflare Pages Deployment

### Prerequisites
1. Cloudflare account (free at [dash.cloudflare.com](https://dash.cloudflare.com))
2. GitHub repository connected
3. Supabase database set up

### One-Click Deploy via Cloudflare Dashboard

1. **Go to Cloudflare Pages**
   - Visit [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to **Workers & Pages** → **Create Application** → **Pages**

2. **Connect GitHub**
   - Click **Connect to Git**
   - Select your `rch-tv` repository
   - Branch: `main` (or your default branch)

3. **Configure Build**
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Root directory**: `/`

4. **Add Environment Variables** (Production)
   
   Click **Add Variable** for each:
   
   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Supabase connection string |
   | `DJ_CONSOLE_USERNAME` | `dj` |
   | `DJ_CONSOLE_PASSWORD` | Choose a secure password |
   | `NEXT_PUBLIC_PUBLIC_APP_URL` | Your Cloudflare Pages URL (e.g., `https://rch-tv.pages.dev`) |

5. **Deploy**
   - Click **Save and Deploy**
   - Wait 2-3 minutes for build
   - Your app is live!

### Local Development

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Setup Local Environment**
   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your local values
   ```

3. **Run Locally**
   ```bash
   # Standard Next.js dev
   npm run dev
   
   # Or with Cloudflare emulation
   npm run build
   npm run dev:cf
   ```

### Custom Domain Setup

1. In Cloudflare dashboard → **Workers & Pages** → Select your project
2. Go to **Custom Domains**
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `rch-tv.com`)
5. Follow DNS instructions (usually just add a CNAME record)
6. SSL is automatic

### Database Migration

After deploying to Cloudflare:

```bash
# Push database schema to Supabase
npm run db:push
```

### Monitoring & Analytics

- **Bandwidth**: Workers & Pages → Your Project → Analytics
- **Builds**: Workers & Pages → Your Project → Deployments
- **Errors**: Check deployment logs in Cloudflare dashboard

### Updating After Code Changes

1. Push to GitHub → Cloudflare auto-deploys
2. Or manually: `npm run deploy:cf`

### Troubleshooting

**Build fails:**
- Check environment variables are set
- Verify `wrangler.toml` exists
- Check build logs in Cloudflare dashboard

**API errors:**
- Ensure DATABASE_URL is correct
- Check Supabase allows connections from Cloudflare IPs
- Verify all env vars are set in Cloudflare

**QR code not showing:**
- Check `NEXT_PUBLIC_PUBLIC_APP_URL` is set correctly
- Verify `/api/admin/session` endpoint is working

## Bandwidth Optimization

This deployment includes:

✅ **Single deployment** (vs 3 on Vercel)
✅ **CDN caching** for static assets (1 year)
✅ **API response caching** (TV API: 2 seconds)
✅ **Optimized images** via Cloudflare Images

## Cost Comparison

| Feature | Vercel Free | Cloudflare Free |
|---------|-------------|-----------------|
| Bandwidth | 10 GB/month | **Unlimited** ✓ |
| Builds | Unlimited | 500/month |
| Serverless | 100GB-hrs | Included |
| Custom domains | 1 | Unlimited |
| SSL | Yes | Yes |

## Support

For issues:
1. Check Cloudflare dashboard logs
2. Review `CLOUDFLARE_MIGRATION.md`
3. Verify environment variables
4. Test locally first with `.dev.vars`
