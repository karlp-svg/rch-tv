import { db } from '@/db';
import { fameSubmissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

/**
 * Image proxy route.
 *
 * R2 photos:  Redirects (302) to the R2 public URL → browser loads from
 *             Cloudflare CDN. Zero egress on Supabase, zero egress on R2.
 *
 * Legacy photos (base64 in DB):  Serves the buffer (temporary fallback).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const variant = searchParams.get('v'); // 'polaroid' or null (raw)

    const [row] = await db.select({
      imageUrl: fameSubmissions.imageUrl,
      polaroidUrl: fameSubmissions.polaroidUrl,
      imageBase64: fameSubmissions.imageBase64,
      polaroidBase64: fameSubmissions.polaroidBase64,
    })
      .from(fameSubmissions)
      .where(eq(fameSubmissions.id, parseInt(id, 10)))
      .limit(1);

    if (!row) {
      return new NextResponse('Not found', { status: 404 });
    }

    // R2 URL → redirect browser directly to Cloudflare CDN (zero egress)
    const url = variant === 'polaroid' && row.polaroidUrl ? row.polaroidUrl : row.imageUrl;
    if (url) {
      return NextResponse.redirect(url, 302);
    }

    // Legacy base64 fallback (for photos uploaded before R2 migration)
    const raw = variant === 'polaroid' && row.polaroidBase64 ? row.polaroidBase64 : row.imageBase64;
    if (!raw) {
      return new NextResponse('No image data', { status: 404 });
    }

    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return new NextResponse('Invalid image data', { status: 500 });
    }

    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse('Failed to load image', { status: 500 });
  }
}
