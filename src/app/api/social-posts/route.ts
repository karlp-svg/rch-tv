import { db } from '@/db';
import { socialPosts } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { saveBase64AsFile } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
        const rows = await db.select({
      id: socialPosts.id,
      postType: socialPosts.postType,
      imageUrl: socialPosts.imageUrl,
      createdAt: socialPosts.createdAt,
    })
      .from(socialPosts)
      .orderBy(desc(socialPosts.createdAt))
      .limit(50);

    return NextResponse.json(
      rows.map((p: any) => ({
        id: p.id,
        postType: p.postType,
        imageSrc: p.imageUrl || null,
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
        const { postType, imageBase64 } = await request.json();

    if (!postType || !imageBase64) {
      return NextResponse.json({ error: 'postType and imageBase64 are required' }, { status: 400 });
    }

    const imageUrl = await saveBase64AsFile(imageBase64, `social-${postType}`);

    const inserted = await db.insert(socialPosts).values({
      postType,
      imageUrl,
    }).returning();

    return NextResponse.json({
      success: true,
      id: inserted[0].id,
      imageSrc: inserted[0].imageUrl,
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving social post:', error);
    return NextResponse.json({ error: 'Failed to save social post' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
        const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    await db.delete(socialPosts).where(eq(socialPosts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting social post:', error);
    return NextResponse.json({ error: 'Failed to delete social post' }, { status: 500 });
  }
}