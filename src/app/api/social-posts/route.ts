import { db, ensureDatabaseCompatibility } from '@/db';
import { socialPosts } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { uploadImage, deleteImage, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
    const posts = await db
      .select()
      .from(socialPosts)
      .orderBy(desc(socialPosts.createdAt))
      .limit(50);

    return NextResponse.json(
      posts.map((p) => ({
        id: p.id,
        postType: p.postType,
        imageSrc: p.imageUrl || p.imageBase64 || null,
        createdAt: p.createdAt,
      }))
    );
  } catch (error) {
    console.error('Error fetching social posts:', error);
    return NextResponse.json({ error: 'Failed to fetch social posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseCompatibility();
    const { postType, imageBase64 } = await request.json();

    if (!postType || !imageBase64) {
      return NextResponse.json({ error: 'postType and imageBase64 are required' }, { status: 400 });
    }

    let imageUrl: string | null = null;
    let b64Fallback: string | null = imageBase64;

    if (isStorageConfigured()) {
      imageUrl = await uploadImage(imageBase64, 'social');
      if (imageUrl) b64Fallback = null;
    }

    const inserted = await db.insert(socialPosts).values({
      postType,
      imageBase64: b64Fallback,
      imageUrl,
    }).returning();

    return NextResponse.json({
      success: true,
      id: inserted[0].id,
      imageSrc: inserted[0].imageUrl || inserted[0].imageBase64,
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving social post:', error);
    return NextResponse.json({ error: 'Failed to save social post' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDatabaseCompatibility();
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const [row] = await db.select({ imageUrl: socialPosts.imageUrl })
      .from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
    if (row?.imageUrl) {
      await deleteImage(row.imageUrl);
    }

    await db.delete(socialPosts).where(eq(socialPosts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting social post:', error);
    return NextResponse.json({ error: 'Failed to delete social post' }, { status: 500 });
  }
}
