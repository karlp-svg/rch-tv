import { db, ensureDatabaseCompatibility } from '@/db';
import { shoutouts, songRequests, fameSubmissions, instagramFollowers } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc, eq, sql, inArray, or, asc } from 'drizzle-orm';
import { deleteImage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
    const [shoutoutList, songList, fameList] = await Promise.all([
      db.select().from(shoutouts).orderBy(desc(shoutouts.createdAt)).limit(100),
      db.select().from(songRequests).orderBy(desc(songRequests.createdAt)).limit(100),
      db.select({
        id: fameSubmissions.id,
        imageBase64: fameSubmissions.imageBase64,
        polaroidBase64: fameSubmissions.polaroidBase64,
        imageUrl: fameSubmissions.imageUrl,
        polaroidUrl: fameSubmissions.polaroidUrl,
        caption: fameSubmissions.caption,
        name: fameSubmissions.name,
        instagramHandle: fameSubmissions.instagramHandle,
        showHandleOnTv: fameSubmissions.showHandleOnTv,
        status: fameSubmissions.status,
        createdAt: fameSubmissions.createdAt,
      }).from(fameSubmissions).orderBy(desc(fameSubmissions.createdAt)).limit(100),
    ]);
    
    const allHandlesSet = new Set<string>();
    for (const item of [...shoutoutList, ...songList, ...fameList]) {
      if (item.instagramHandle) {
        const clean = item.instagramHandle.toLowerCase().replace(/^@+/, '').trim();
        if (clean) allHandlesSet.add(clean);
      }
    }
    const allHandles = Array.from(allHandlesSet);

    const verifiedSet = new Set<string>();
    if (allHandles.length > 0) {
      const foundRows = await db
        .select({ handle: instagramFollowers.handle })
        .from(instagramFollowers)
        .where(inArray(instagramFollowers.handle, allHandles));
      for (const row of foundRows) {
        verifiedSet.add(row.handle.toLowerCase());
      }
    }

    const mapItem = (item: any) => {
      const clean = item.instagramHandle ? item.instagramHandle.toLowerCase().replace(/^@+/, '').trim() : null;
      const mapped: any = {
        ...item,
        followerVerified: clean ? verifiedSet.has(clean) : null,
      };
      if ('imageUrl' in item || 'imageBase64' in item) {
        mapped.imageSrc = item.imageUrl || item.imageBase64 || null;
        mapped.polaroidSrc = item.polaroidUrl || item.polaroidBase64 || null;
      }
      return mapped;
    };

    return NextResponse.json({
      shoutouts: shoutoutList.map(mapItem),
      songRequests: songList.map(mapItem),
      fameSubmissions: fameList.map(mapItem),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch admin data' }, { status: 500 });
  }
}

const VALID_STATUSES = ['verifying', 'queued', 'in_progress', 'complete', 'rejected'] as const;
type Status = typeof VALID_STATUSES[number];

async function countInProgress(): Promise<number> {
  const [s, song, fame] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(shoutouts).where(eq(shoutouts.status, 'in_progress')),
    db.select({ c: sql<number>`count(*)::int` }).from(songRequests).where(eq(songRequests.status, 'in_progress')),
    db.select({ c: sql<number>`count(*)::int` }).from(fameSubmissions).where(eq(fameSubmissions.status, 'in_progress')),
  ]);
  return (s[0]?.c || 0) + (song[0]?.c || 0) + (fame[0]?.c || 0);
}

/** Promote the oldest queued item (any type) to in_progress. Returns the promoted item or null. */
export async function promoteNextQueued(): Promise<{ type: string; id: number } | null> {
  // Find oldest queued across all types
  const [queuedShoutouts, queuedSongs, queuedFame] = await Promise.all([
    db.select({ id: shoutouts.id, createdAt: shoutouts.createdAt, type: sql<string>`'shoutout'` })
      .from(shoutouts).where(eq(shoutouts.status, 'queued')).orderBy(asc(shoutouts.createdAt)).limit(1),
    db.select({ id: songRequests.id, createdAt: songRequests.createdAt, type: sql<string>`'song'` })
      .from(songRequests).where(eq(songRequests.status, 'queued')).orderBy(asc(songRequests.createdAt)).limit(1),
    db.select({ id: fameSubmissions.id, createdAt: fameSubmissions.createdAt, type: sql<string>`'fame'` })
      .from(fameSubmissions).where(eq(fameSubmissions.status, 'queued')).orderBy(asc(fameSubmissions.createdAt)).limit(1),
  ]);

  const candidates = [
    ...queuedShoutouts.map(r => ({ type: 'shoutout' as const, id: r.id, createdAt: r.createdAt })),
    ...queuedSongs.map(r => ({ type: 'song' as const, id: r.id, createdAt: r.createdAt })),
    ...queuedFame.map(r => ({ type: 'fame' as const, id: r.id, createdAt: r.createdAt })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (candidates.length === 0) return null;

  const next = candidates[0];
  switch (next.type) {
    case 'shoutout':
      await db.update(shoutouts).set({ status: 'in_progress' }).where(eq(shoutouts.id, next.id));
      break;
    case 'song':
      await db.update(songRequests).set({ status: 'in_progress' }).where(eq(songRequests.id, next.id));
      break;
    case 'fame':
      await db.update(fameSubmissions).set({ status: 'in_progress' }).where(eq(fameSubmissions.id, next.id));
      break;
  }
  return { type: next.type, id: next.id };
}

export async function PATCH(request: Request) {
  try {
    await ensureDatabaseCompatibility();
    const body = await request.json();
    const { type, id, status, action } = body;

    // Special action: complete current and promote next
    if (action === 'complete_and_promote') {
      const { type: itemType, id: itemId } = body;
      if (!itemType || !itemId) {
        return NextResponse.json({ error: 'Missing type/id' }, { status: 400 });
      }
      switch (itemType) {
        case 'shoutout':
          await db.update(shoutouts).set({ status: 'complete' }).where(eq(shoutouts.id, itemId));
          break;
        case 'song':
          await db.update(songRequests).set({ status: 'complete' }).where(eq(songRequests.id, itemId));
          break;
        case 'fame':
          await db.update(fameSubmissions).set({ status: 'complete' }).where(eq(fameSubmissions.id, itemId));
          break;
        default:
          return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      const promoted = await promoteNextQueued();
      return NextResponse.json({ success: true, promoted });
    }

    // Special action: approve (smart queue)
    if (action === 'approve') {
      if (!type || !id) {
        return NextResponse.json({ error: 'Missing type/id' }, { status: 400 });
      }
      const liveCount = await countInProgress();
      const targetStatus = liveCount === 0 ? 'in_progress' : 'queued';

      switch (type) {
        case 'shoutout':
          await db.update(shoutouts).set({ status: targetStatus }).where(eq(shoutouts.id, id));
          break;
        case 'song':
          await db.update(songRequests).set({ status: targetStatus }).where(eq(songRequests.id, id));
          break;
        case 'fame':
          await db.update(fameSubmissions).set({ status: targetStatus }).where(eq(fameSubmissions.id, id));
          break;
        default:
          return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      return NextResponse.json({ success: true, status: targetStatus });
    }
    
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    const typedStatus = status as Status;

    // If forcing something to 'in_progress', mark existing in_progress items as complete
    if (typedStatus === 'in_progress') {
      await Promise.all([
        db.update(shoutouts).set({ status: 'complete' }).where(eq(shoutouts.status, 'in_progress')),
        db.update(songRequests).set({ status: 'complete' }).where(eq(songRequests.status, 'in_progress')),
        db.update(fameSubmissions).set({ status: 'complete' }).where(eq(fameSubmissions.status, 'in_progress')),
      ]);
    }
    
    switch (type) {
      case 'shoutout':
        await db.update(shoutouts).set({ status: typedStatus }).where(eq(shoutouts.id, id));
        break;
      case 'song':
        await db.update(songRequests).set({ status: typedStatus }).where(eq(songRequests.id, id));
        break;
      case 'fame':
        await db.update(fameSubmissions).set({ status: typedStatus }).where(eq(fameSubmissions.id, id));
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // If we just completed something, promote next queued
    if (typedStatus === 'complete') {
      await promoteNextQueued();
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDatabaseCompatibility();
    const { type, id, deleteAll } = await request.json();
    
    if (deleteAll) {
      switch (type) {
        case 'shoutout':
          await db.delete(shoutouts);
          break;
        case 'song':
          await db.delete(songRequests);
          break;
        case 'fame':
          await db.delete(fameSubmissions);
          break;
        default:
          return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      return NextResponse.json({ success: true, deleted: 'all' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    
    switch (type) {
      case 'shoutout':
        await db.delete(shoutouts).where(eq(shoutouts.id, id));
        break;
      case 'song':
        await db.delete(songRequests).where(eq(songRequests.id, id));
        break;
      case 'fame': {
        const [row] = await db.select({
          imageUrl: fameSubmissions.imageUrl,
          polaroidUrl: fameSubmissions.polaroidUrl,
        }).from(fameSubmissions).where(eq(fameSubmissions.id, id)).limit(1);
        if (row) {
          await deleteImage(row.imageUrl);
          await deleteImage(row.polaroidUrl);
        }
        await db.delete(fameSubmissions).where(eq(fameSubmissions.id, id));
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
