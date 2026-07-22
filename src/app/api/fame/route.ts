import { db, ensureDatabaseCompatibility } from '@/db';
import { fameSubmissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { hasProfanity } from '@/lib/profanity';
import { validatePublicSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
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
    await ensureDatabaseCompatibility();
    const { imageBase64, polaroidBase64, caption, instagramHandle, showHandleOnTV, sessionToken } = await request.json();
    if (!(await validatePublicSession(sessionToken))) {
      return NextResponse.json({ error: 'Session expired. Please scan the latest QR code.' }, { status: 403 });
    }
    
    if (!imageBase64) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const autoRejected = hasProfanity(caption, instagramHandle);

    // Prefer Supabase Storage (keeps DB tiny). Fall back to base64 in DB.
    let imageUrl: string | null = null;
    let polaroidUrl: string | null = null;
    let imageB64Fallback: string | null = imageBase64;
    let polaroidB64Fallback: string | null = polaroidBase64 || null;

    if (isStorageConfigured()) {
      imageUrl = await uploadImage(imageBase64, 'raw');
      if (polaroidBase64) {
        polaroidUrl = await uploadImage(polaroidBase64, 'polaroid');
      }
      // If upload succeeded, don't keep the huge base64 in the DB
      if (imageUrl) imageB64Fallback = null;
      if (polaroidUrl) polaroidB64Fallback = null;
    }

    const inserted = await db.insert(fameSubmissions).values({
      imageBase64: imageB64Fallback,
      polaroidBase64: polaroidB64Fallback,
      imageUrl,
      polaroidUrl,
      caption: caption || null,
      name: null,
      instagramHandle: instagramHandle ? instagramHandle.replace(/^@+/, '').trim().slice(0, 100) : null,
      showHandleOnTv: !!showHandleOnTV,
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
