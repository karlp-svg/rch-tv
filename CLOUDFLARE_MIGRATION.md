# Cloudflare Pages Migration Guide

This guide walks you through migrating from Vercel to Cloudflare Pages for unlimited bandwidth and consolidated deployments.

## Why Cloudflare Pages?

- ✅ **Unlimited bandwidth** (vs Vercel's 10GB/month free tier)
- ✅ **500 builds/month** (plenty for this project)
- ✅ **Free SSL & custom domains**
- ✅ **Global CDN** (faster worldwide)
- ✅ **Single deployment** (no more 3 separate projects)

## Migration Steps

### 1. Create Cloudflare Account
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up (free)
3. Verify email

### 2. Connect GitHub Repository
1. Go to **Workers & Pages** → **Create Application** → **Pages**
2. Click **Connect to Git**
3. Select your `rch-tv` repository
4. Configure build:
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Root directory**: `/` (leave default)

### 3. Set Environment Variables
In Cloudflare dashboard → **Settings** → **Environment Variables** → **Production**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string |
| `DJ_CONSOLE_USERNAME` | `dj` |
| `DJ_CONSOLE_PASSWORD` | Your secure password |
| `NEXT_PUBLIC_PUBLIC_APP_URL` | `https://rch-tv.pages.dev` (or your custom domain) |

### 4. Deploy
1. Click **Save and Deploy**
2. Wait for build (~2-3 minutes)
3. Your app is live at `https://rch-tv.pages.dev`

### 5. Custom Domain (Optional)
1. Go to **Custom Domains**
2. Add your domain (e.g., `rch-tv.com`)
3. Follow DNS setup instructions
4. SSL is automatic

## Local Development with Cloudflare

Create `.dev.vars` file in project root:

```
DATABASE_URL=postgresql://...
DJ_CONSOLE_USERNAME=dj
DJ_CONSOLE_PASSWORD=your_local_password
NEXT_PUBLIC_PUBLIC_APP_URL=http://localhost:3000
```

Run locally:
```bash
npm run dev
```

## Caching Strategy

The app includes optimized caching headers:

- **TV Display API**: 2 second cache, 5 second stale-while-revalidate
- **Session API**: No cache (must be fresh)
- **Static assets**: 1 year cache via Cloudflare CDN

## Bandwidth Optimization

The migration includes these optimizations:

1. **Consolidated deployment** - Single project instead of 3 separate Vercel projects
2. **CDN caching** - Static assets cached at edge
3. **API response caching** - TV API cached for 2 seconds
4. **Image optimization** - Using Cloudflare's image optimization

## Monitoring Usage

Check usage in Cloudflare dashboard:
- **Workers & Pages** → Select project → **Analytics**
- Monitor bandwidth, requests, and builds

## Troubleshooting

### Build fails
- Check environment variables are set correctly
- Ensure `wrangler.toml` is in project root
- Check build logs in Cloudflare dashboard

### API returns errors
- Verify DATABASE_URL is correct
- Check Supabase firewall allows Cloudflare IPs
- Ensure all environment variables are set

### QR code not showing
- Check NEXT_PUBLIC_PUBLIC_APP_URL is set
- Verify session API is working (`/api/admin/session`)

## Cost Comparison

| Feature | Vercel Free | Cloudflare Free |
|---------|-------------|-----------------|
| Bandwidth | 10 GB/month | **Unlimited** ✓ |
| Builds | Unlimited | 500/month |
| Serverless functions | 100GB-hours/month | Included |
| Custom domains | 1 | Unlimited |
| SSL | Yes | Yes |

## Next Steps After Migration

1. Update DNS to point to Cloudflare
2. Remove Vercel deployments to stop counting toward quota
3. Monitor first week's usage in Cloudflare analytics
4. Adjust cache TTLs if needed based on traffic patterns
