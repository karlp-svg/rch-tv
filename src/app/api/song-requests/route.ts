import { db } from '@/db';
import { songRequests } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { hasProfanity } from '@/lib/profanity';
import { validatePublicSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
        const allRequests = await db.select().from(songRequests).orderBy(desc(songRequests.createdAt)).limit(20);
    return NextResponse.json(allRequests);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch song requests' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
        const { artist, title, anyTitle, requesterName, instagramHandle, showHandleOnTV, sessionToken } = await request.json();
    if (!(await validatePublicSession(sessionToken))) {
      return NextResponse.json({ error: 'Session expired. Please scan the latest QR code.' }, { status: 403 });
    }

    if (!artist) {
      return NextResponse.json({ error: 'Artist is required' }, { status: 400 });
    }
    if (!anyTitle && !title) {
      return NextResponse.json({ error: 'Title is required unless "Anything" is selected' }, { status: 400 });
    }

    const autoRejected = hasProfanity(artist, title, requesterName, instagramHandle);

    const inserted = await db.insert(songRequests).values({
      artist,
      title: anyTitle ? null : title,
      anyTitle: !!anyTitle ? 1 : 0,
      requesterName: requesterName || null,
      instagramHandle: instagramHandle ? instagramHandle.replace(/^@+/, '').trim().slice(0, 100) : null,
      showHandleOnTv: !!showHandleOnTV ? 1 : 0,
      status: autoRejected ? 'rejected' : 'verifying',
    }).returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create song request' }, { status: 500 });
  }
}