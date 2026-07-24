import { db } from '@/db';
import { shoutouts } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { hasProfanity } from '@/lib/profanity';
import { validatePublicSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
        const allShoutouts = await db.select().from(shoutouts).orderBy(desc(shoutouts.createdAt)).limit(20);
    return NextResponse.json(allShoutouts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch shoutouts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
        const { message, fromName, instagramHandle, showHandleOnTV, sessionToken } = await request.json();
    if (!(await validatePublicSession(sessionToken))) {
      return NextResponse.json({ error: 'Session expired. Please scan the latest QR code.' }, { status: 403 });
    }

    if (!message || message.length > 160) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    const autoRejected = hasProfanity(message, fromName, instagramHandle);

    const inserted = await db.insert(shoutouts).values({
      message,
      fromName: fromName || null,
      instagramHandle: instagramHandle ? instagramHandle.replace(/^@+/, '').trim().slice(0, 100) : null,
      showHandleOnTv: !!showHandleOnTV ? 1 : 0,
      status: autoRejected ? 'rejected' : 'verifying',
    }).returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create shoutout' }, { status: 500 });
  }
}