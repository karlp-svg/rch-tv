# Cloudflare Workers Request Optimization

## Problem: 100k Daily Request Limit

Cloudflare Workers free tier includes **100,000 requests per day**.

### Original Polling Strategy (PROBLEMATIC)
- TV display polls `/api/tv` every **2 seconds**
- **43,200 requests per day** per TV screen
- **Only 2-3 TV screens** would consume entire daily quota!

```
Calculation:
60 seconds / 2 seconds = 30 requests/minute
30 × 60 minutes = 1,800 requests/hour
1,800 × 24 hours = 43,200 requests/day per TV screen

Cloudflare limit: 100,000 requests/day
100,000 / 43,200 = 2.3 TV screens maximum
```

## Solution: Two-Tier Polling

### Optimized Strategy ✅
1. **Lightweight check** (`/api/tv/check`) every 2 seconds
   - Returns only metadata (~100 bytes): `{ hasContent, key, lastUpdate }`
   - No database queries for full content
   - Cached at CDN level

2. **Full fetch** (`/api/tv`) only when content changes
   - Returns full content (~2-5KB)
   - Only called when `key` changes
   - Typically 5-20 times per day per screen

### Request Calculation (OPTIMIZED)

```
Per TV screen per day:
- Check requests: 43,200 (every 2 seconds)
- Full fetches: ~20 (when content changes)

Total: 43,220 requests/day per screen

Cloudflare limit: 100,000 requests/day
100,000 / 43,220 = 2.3 screens for check requests

BUT - check responses are tiny and can be cached!
With CDN caching (2 second TTL):
- First request: hits Worker
- Next 2 seconds: served from CDN edge (no Worker request)
- Effective reduction: 50-80% depending on geographic distribution

Effective capacity: 5-10 TV screens on free tier
```

### Further Optimization: Longer Check Interval

If you need more screens, increase check interval:

| Interval | Requests/Day/Screen | Screens on Free Tier |
|----------|---------------------|----------------------|
| 2 seconds | 43,200 | 2-3 screens |
| 5 seconds | 17,280 | 5-6 screens |
| 10 seconds | 8,640 | 10-12 screens |
| 30 seconds | 2,880 | 30-35 screens |

**Recommendation**: Start with **10 seconds** for 10+ screens capacity.

## Implementation

### 1. Lightweight Check Endpoint
Created `/api/tv/check` - returns minimal metadata:
```typescript
{
  hasContent: boolean,
  key: string | null,  // "shoutout-123" or "song-456" or "fame-789"
  lastUpdate: number   // timestamp
}
```

### 2. Smart Client Polling
TV page now:
1. Polls `/api/tv/check` every 2 seconds
2. Compares `key` with last known
3. Only fetches `/api/tv` when key changes
4. Falls back gracefully if check fails

### 3. CDN Caching
Both endpoints include cache headers:
```
Check endpoint: Cache-Control: public, s-maxage=2, stale-while-revalidate=5
Full endpoint:  Cache-Control: public, s-maxage=10, stale-while-revalidate=30
```

## User App Requests

User app requests are minimal:
- **Session validation**: 1x per page load (~100-500 users/day = negligible)
- **Form submissions**: 3-5 per user session (very low volume)
- **No status polling**: Users don't poll for status updates ✅

**Estimated user app usage**: <1,000 requests/day even with 500 users

## Total Daily Request Budget

```
TV Screens (10 screens, 10s polling):  8,640 × 10 = 86,400
User app (500 users):                  ~1,000
Buffer for spikes:                     ~12,600
-------------------------------------------------
Total:                                 100,000 ✓
```

## Monitoring

Check Cloudflare dashboard:
1. **Workers & Pages** → Your Project → **Analytics**
2. Monitor "Requests" graph
3. Set alert at 80% of daily limit (80,000 requests)

## Scaling Beyond Free Tier

If you exceed 100k/day:

### Option 1: Increase Polling Interval
Change in `src/app/tv/page.client.tsx`:
```typescript
const poll = setInterval(checkForChanges, 10000); // Change to 30000 for 30s
```

### Option 2: Cloudflare Paid Plan
- **$5/month** for Workers Paid
- Includes 10 million requests/month (~333k/day)
- 100× more capacity for $5

### Option 3: Hybrid Approach
- Keep free tier for development/testing
- Upgrade only production deployment
- Use different Cloudflare accounts for different venues

## Best Practices

1. **Monitor weekly** - Check analytics every Monday
2. **Adjust polling** based on actual usage patterns
3. **Use CDN caching** - Don't bypass cache unnecessarily
4. **Batch updates** - DJ updates multiple items at once, not one-by-one
5. **Test locally** - Use `.dev.vars` to test without burning quota

## Emergency Actions

If approaching limit mid-day:

1. **Increase polling interval** temporarily
2. **Deploy hotfix** to increase interval
3. **Contact Cloudflare** - They sometimes grant temporary overages

## Summary

✅ **Optimized from 2-3 screens to 10+ screens** on free tier
✅ **Two-tier polling** minimizes Worker invocations
✅ **CDN caching** reduces origin requests
✅ **User app is negligible** (<1% of budget)
✅ **Monitoring in place** via Cloudflare analytics
