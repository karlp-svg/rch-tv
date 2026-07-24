import { db } from '@/db';
import { shoutouts, songRequests, fameSubmissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    
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