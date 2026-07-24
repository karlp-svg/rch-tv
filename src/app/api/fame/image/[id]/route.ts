import { db } from '@/db';
import { fameSubmissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const variant = searchParams.get('v');

    const [row] = await db.select({
      imageUrl: fameSubmissions.imageUrl,
      polaroidUrl: fameSubmissions.polaroidUrl,
    })
      .from(fameSubmissions)
      .where(eq(fameSubmissions.id, parseInt(id, 10)))
      .limit(1);

    if (!row) {
      return new NextResponse('Not found', { status: 404 });
    }

    const url = variant === 'polaroid' && row.polaroidUrl ? row.polaroidUrl : row.imageUrl;
    if (url) {
      // Proxy the image through the server to avoid CORS issues with R2
      // This is needed for canvas operations in the End of Night modal
      try {
        const imageRes = await fetch(url, {
          headers: {
            'Accept': 'image/*',
          },
        });
        if (imageRes.ok) {
          const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
          const buffer = await imageRes.arrayBuffer();
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, immutable',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      } catch {
        // If proxying fails, fall through to redirect
      }

      return NextResponse.redirect(url, 302);
    }

    return new NextResponse('No image data', { status: 404 });
  } catch (error) {
    console.error(error);
    return new NextResponse('Failed to load image', { status: 500 });
  }
}
