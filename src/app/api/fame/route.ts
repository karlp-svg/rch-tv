import { db } from '@/db';
import { fameSubmissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { hasProfanity } from '@/lib/profanity';
import { validatePublicSession } from '@/lib/session';
import { saveBase64AsFile } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
        const submissions = await db.select({
      id: fameSubmissions.id,
      caption: fameSubmissions.caption,
      name: fameSubmissions.name,
      instagramHandle: fameSubmissions.instagramHandle,
      showHandleOnTv: fameSubmissions.showHandleOnTv,
      status: fameSubmissions.status,
      createdAt: fameSubmissions.createdAt,
    }).from(fameSubmissions).orderBy(desc(fameSubmissions.createdAt)).limit(20);

    return NextResponse.json(submissions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch fame submissions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
        const { imageBase64, polaroidBase64, caption, instagramHandle, showHandleOnTV, sessionToken } = await request.json();
    if (!(await validatePublicSession(sessionToken))) {
      return NextResponse.json({ error: 'Session expired. Please scan the latest QR code.' }, { status: 403 });
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const autoRejected = hasProfanity(caption, instagramHandle);

    // Upload both raw photo and polaroid to Cloudflare R2.
    // DB stores only the public URL → image loads from Cloudflare CDN.
    const [imageUrl, polaroidUrl] = await Promise.all([
      saveBase64AsFile(imageBase64, 'fame'),
      polaroidBase64 ? saveBase64AsFile(polaroidBase64, 'polaroid') : Promise.resolve(null),
    ]);

    const inserted = await db.insert(fameSubmissions).values({
      imageUrl,
      polaroidUrl,
      caption: caption || null,
      name: null,
      instagramHandle: instagramHandle ? instagramHandle.replace(/^@+/, '').trim().slice(0, 100) : null,
      showHandleOnTv: !!showHandleOnTV ? 1 : 0,
      status: autoRejected ? 'rejected' : 'verifying',
    }).returning();

    return NextResponse.json({
      success: true,
      id: inserted[0].id,
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 });
  }
}