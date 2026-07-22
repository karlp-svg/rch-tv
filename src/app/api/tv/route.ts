import { db, ensureDatabaseCompatibility } from '@/db';
import { shoutouts, songRequests, fameSubmissions, appSettings } from '@/db/schema';
import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
    const DEFAULT_DURATION = '60';

    // Only the single in_progress item is "on air". Queued items wait.
    const [activeShoutouts, activeSongs, activeFame, completedFame, settingsRows] = await Promise.all([
      db.select({
        id: shoutouts.id,
        message: shoutouts.message,
        fromName: shoutouts.fromName,
        instagramHandle: shoutouts.instagramHandle,
        showHandleOnTv: shoutouts.showHandleOnTv,
        createdAt: shoutouts.createdAt,
      })
        .from(shoutouts)
        .where(eq(shoutouts.status, 'in_progress'))
        .orderBy(asc(shoutouts.createdAt))
        .limit(5),

      db.select({
        id: songRequests.id,
        artist: songRequests.artist,
        title: songRequests.title,
        anyTitle: songRequests.anyTitle,
        requesterName: songRequests.requesterName,
        instagramHandle: songRequests.instagramHandle,
        showHandleOnTv: songRequests.showHandleOnTv,
        createdAt: songRequests.createdAt,
      })
        .from(songRequests)
        .where(eq(songRequests.status, 'in_progress'))
        .orderBy(asc(songRequests.createdAt))
        .limit(5),

      db.select({
        id: fameSubmissions.id,
        polaroidBase64: fameSubmissions.polaroidBase64,
        imageBase64: fameSubmissions.imageBase64,
        polaroidUrl: fameSubmissions.polaroidUrl,
        imageUrl: fameSubmissions.imageUrl,
        caption: fameSubmissions.caption,
        instagramHandle: fameSubmissions.instagramHandle,
        showHandleOnTv: fameSubmissions.showHandleOnTv,
        createdAt: fameSubmissions.createdAt,
      })
        .from(fameSubmissions)
        .where(eq(fameSubmissions.status, 'in_progress'))
        .orderBy(asc(fameSubmissions.createdAt))
        .limit(5),

      db.select({
        id: fameSubmissions.id,
        polaroidBase64: fameSubmissions.polaroidBase64,
        imageBase64: fameSubmissions.imageBase64,
        polaroidUrl: fameSubmissions.polaroidUrl,
        imageUrl: fameSubmissions.imageUrl,
        createdAt: fameSubmissions.createdAt,
      })
        .from(fameSubmissions)
        .where(eq(fameSubmissions.status, 'complete'))
        .orderBy(sql`${fameSubmissions.createdAt} DESC`)
        .limit(20),

      db.select().from(appSettings),
    ]);

    const settings: Record<string, string> = { display_duration: DEFAULT_DURATION };
    for (const row of settingsRows) {
      settings[row.key] = row.value;
    }

    const displayDuration = parseInt(settings.display_duration, 10) || 60;

    // Should only be 0 or 1 in_progress item, but sort just in case
    const live = [
      ...activeShoutouts.map((item) => ({ ...item, type: 'shoutout' as const })),
      ...activeSongs.map((item) => ({ ...item, type: 'song' as const })),
      ...activeFame.map((item) => ({
        id: item.id,
        polaroidSrc: item.polaroidUrl || item.imageBase64 || null,
        imageSrc: item.imageUrl || item.polaroidBase64 || null,
        caption: item.caption,
        instagramHandle: item.instagramHandle,
        showHandleOnTv: item.showHandleOnTv,
        createdAt: item.createdAt,
        type: 'fame' as const,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const lastUpdate = live.length > 0 ? new Date(live[0].createdAt).getTime() : 0;
    
    const response = NextResponse.json({
      current: live[0] || null,
      queue: live,
      completedFame,
      fameSettings: {
        photoSize: parseInt(settings.fame_photo_size || '42', 10),
        completedScale: parseInt(settings.fame_completed_scale || '70', 10),
        rotation: parseInt(settings.fame_rotation || '15', 10),
        spread: parseInt(settings.fame_spread || '600', 10),
        spreadY: parseInt(settings.fame_spread_y || '200', 10),
        titleOffset: parseInt(settings.fame_title_offset || '22', 10),
        displayOffset: parseInt(settings.fame_display_offset || '0', 10),
        completedFade: parseInt(settings.fame_completed_fade || '70', 10),
      },
      hideBackground: settings.tv_hide_background === 'true',
      lastUpdate,
    });

    // Optimized cache headers for Cloudflare CDN
    // 10 second cache matches client polling interval
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    response.headers.set('CDN-Cache-Control', 'public, max-age=10');
    response.headers.set('Vary', 'Accept-Encoding');

    return response;
  } catch (error) {
    console.error('Error fetching TV data:', error);
    return NextResponse.json({ current: null, queue: [], completedFame: [] }, { status: 500 });
  }
}
