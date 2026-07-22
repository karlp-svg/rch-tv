import { db, ensureDatabaseCompatibility } from '@/db';
import { shoutouts, songRequests, fameSubmissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint to check if TV content has changed.
 * Returns only metadata (no full content) to minimize bandwidth.
 * TV display polls this every 2 seconds, full /api/tv only when changed.
 */
export async function GET() {
  try {
    await ensureDatabaseCompatibility();

    // Get only the most recent in_progress item's metadata
    const [latest] = await db
      .select({
        id: shoutouts.id,
        type: sql<string>`'shoutout'`,
        createdAt: shoutouts.createdAt,
      })
      .from(shoutouts)
      .where(eq(shoutouts.status, 'in_progress'))
      .orderBy(asc(shoutouts.createdAt))
      .limit(1);

    if (!latest) {
      // Check songs
      const [song] = await db
        .select({
          id: songRequests.id,
          type: sql<string>`'song'`,
          createdAt: songRequests.createdAt,
        })
        .from(songRequests)
        .where(eq(songRequests.status, 'in_progress'))
        .orderBy(asc(songRequests.createdAt))
        .limit(1);

      if (song) {
        const response = NextResponse.json({
          hasContent: true,
          key: `song-${song.id}`,
          lastUpdate: new Date(song.createdAt).getTime(),
        });
        response.headers.set('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=5');
        return response;
      }

      // Check fame
      const [fame] = await db
        .select({
          id: fameSubmissions.id,
          type: sql<string>`'fame'`,
          createdAt: fameSubmissions.createdAt,
        })
        .from(fameSubmissions)
        .where(eq(fameSubmissions.status, 'in_progress'))
        .orderBy(asc(fameSubmissions.createdAt))
        .limit(1);

      if (fame) {
        const response = NextResponse.json({
          hasContent: true,
          key: `fame-${fame.id}`,
          lastUpdate: new Date(fame.createdAt).getTime(),
        });
        response.headers.set('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=5');
        return response;
      }

      // No content
      const response = NextResponse.json({
        hasContent: false,
        key: null,
        lastUpdate: 0,
      });
      response.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10');
      return response;
    }

    const response = NextResponse.json({
      hasContent: true,
      key: `shoutout-${latest.id}`,
      lastUpdate: new Date(latest.createdAt).getTime(),
    });
    response.headers.set('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=5');
    return response;
  } catch (error) {
    console.error('Error checking TV status:', error);
    return NextResponse.json({ hasContent: false, key: null, lastUpdate: 0 }, { status: 500 });
  }
}
