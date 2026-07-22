import { db } from '@/db';
import { instagramFollowers, shoutouts, songRequests, fameSubmissions } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { handle } = body;

    if (!handle || typeof handle !== 'string') {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }

    // Clean the handle (remove leading @ and trim and lowercase)
    const cleanHandle = handle.trim().replace(/^@+/, '').toLowerCase();

    if (!cleanHandle) {
      return NextResponse.json({ error: 'Valid handle is required' }, { status: 400 });
    }

    // Insert handle into followers table (do nothing if already present)
    await db
      .insert(instagramFollowers)
      .values({ handle: cleanHandle })
      .onConflictDoNothing();

    // Count matching requests across all three tables using case-insensitive matching
    const [sCountRes, songCountRes, fameCountRes] = await Promise.all([
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(shoutouts)
        .where(sql`lower(${shoutouts.instagramHandle}) = ${cleanHandle}`),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(songRequests)
        .where(sql`lower(${songRequests.instagramHandle}) = ${cleanHandle}`),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(fameSubmissions)
        .where(sql`lower(${fameSubmissions.instagramHandle}) = ${cleanHandle}`),
    ]);

    const totalMatchingRequests =
      (sCountRes[0]?.c || 0) +
      (songCountRes[0]?.c || 0) +
      (fameCountRes[0]?.c || 0);

    return NextResponse.json({
      success: true,
      handle: cleanHandle,
      verifiedCount: totalMatchingRequests,
    });
  } catch (error) {
    console.error('Error adding handle manually:', error);
    return NextResponse.json({ error: 'Failed to add handle' }, { status: 500 });
  }
}
