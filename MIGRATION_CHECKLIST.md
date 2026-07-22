# Cloudflare Migration Checklist

## ✅ Completed Setup

- [x] `wrangler.toml` created with caching rules
- [x] `.dev.vars.example` template created
- [x] Wrangler CLI installed
- [x] Caching headers added to API routes
- [x] TV API optimized with 2-second cache
- [x] Session API marked as no-cache
- [x] Deployment scripts added to package.json
- [x] Migration guides created

##  Migration Steps (Do These in Cloudflare Dashboard)

### Step 1: Create Cloudflare Account
- [ ] Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
- [ ] Verify email address

### Step 2: Connect Repository
- [ ] Go to Workers & Pages → Create Application → Pages
- [ ] Click "Connect to Git"
- [ ] Select your `rch-tv` GitHub repository
- [ ] Branch: `main`

### Step 3: Configure Build Settings
- [ ] Framework preset: **Next.js**
- [ ] Build command: `npm run build`
- [ ] Build output directory: `.next`
- [ ] Root directory: `/` (leave default)

### Step 4: Set Environment Variables
Go to Settings → Environment Variables → Production:

- [ ] `DATABASE_URL` = Your Supabase connection string
- [ ] `DJ_CONSOLE_USERNAME` = `dj`
- [ ] `DJ_CONSOLE_PASSWORD` = [Choose secure password]
- [ ] `NEXT_PUBLIC_PUBLIC_APP_URL` = `https://rch-tv.pages.dev` (or your custom domain)

### Step 5: Deploy
- [ ] Click "Save and Deploy"
- [ ] Wait for build to complete (~2-3 minutes)
- [ ] Note your Cloudflare Pages URL

### Step 6: Database Migration
- [ ] Run `npm run db:push` to sync schema to Supabase
- [ ] Verify database connection works

### Step 7: Test Deployment
- [ ] Visit your Cloudflare Pages URL
- [ ] Test DJ Console login
- [ ] Test TV display QR code
- [ ] Test public app submission flow

### Step 8: Custom Domain (Optional)
- [ ] Go to Custom Domains in Cloudflare
- [ ] Add your domain (e.g., `rch-tv.com`)
- [ ] Update DNS records as instructed
- [ ] Wait for DNS propagation (5-10 minutes)
- [ ] Update `NEXT_PUBLIC_PUBLIC_APP_URL` to custom domain

### Step 9: Clean Up Vercel
- [ ] Remove Vercel deployments to stop bandwidth usage
- [ ] Export any needed environment variables from Vercel
- [ ] Cancel Vercel Pro trial if active

## 📊 Post-Migration Monitoring

### Week 1
- [ ] Check Cloudflare Analytics daily
- [ ] Monitor bandwidth usage
- [ ] Check build count (limit: 500/month)
- [ ] Verify no errors in deployment logs

### Ongoing
- [ ] Review analytics weekly
- [ ] Adjust cache TTLs if needed
- [ ] Monitor Supabase connection pool

## 🔧 Troubleshooting

### Build Fails
- Check environment variables are correctly set
- Verify `wrangler.toml` is in project root
- Check build logs in Cloudflare dashboard
- Try local build: `npm run build`

### API Returns Errors
- Verify DATABASE_URL format is correct
- Check Supabase firewall allows all IPs
- Ensure all environment variables are set
- Test locally with `.dev.vars`

### QR Code Not Showing
- Check `NEXT_PUBLIC_PUBLIC_APP_URL` is set
- Verify `/api/admin/session` endpoint works
- Check browser console for errors
- Clear Cloudflare cache if needed

### Database Connection Issues
- Verify Supabase is on free tier (unlimited connections)
- Check connection string includes `?pgbouncer=true`
- Test connection from local machine first
- Check Supabase dashboard for connection errors

## 📈 Expected Results After Migration

### Bandwidth
- **Before (Vercel)**: ~7.5GB used of 10GB limit
- **After (Cloudflare)**: Unlimited ✓

### Performance
- **Global CDN**: Faster worldwide
- **Edge caching**: 2-second cache on TV API
- **Static assets**: 1-year cache at edge

### Cost
- **Vercel**: Would need Pro plan ($20/month) to avoid overage
- **Cloudflare**: Free tier covers unlimited bandwidth ✓

##  Success Criteria

Migration is complete when:
- [ ] App loads on Cloudflare Pages
- [ ] DJ Console works with authentication
- [ ] TV display shows QR code
- [ ] Public app accepts submissions
- [ ] Database reads/writes work
- [ ] No errors in Cloudflare logs
- [ ] Vercel deployments removed

## 📞 Support Resources

- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- Next.js on Cloudflare: https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/
- Supabase Connection: https://supabase.com/docs/guides/database/connecting-to-postgres

---

**Estimated Migration Time**: 15-20 minutes
**Difficulty**: Easy (following this checklist)
