import { db } from '@/db';
import { shoutouts, songRequests, fameSubmissions, instagramFollowers } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc, eq, sql, inArray, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
        const [shoutoutList, songList, fameList] = await Promise.all([
      db.select().from(shoutouts).orderBy(desc(shoutouts.createdAt)).limit(100),
      db.select().from(songRequests).orderBy(desc(songRequests.createdAt)).limit(100),
      db.select({
        id: fameSubmissions.id,
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
      if ('imageUrl' in item) {
        mapped.imageSrc = item.imageUrl || null;
        mapped.polaroidSrc = item.polaroidUrl || null;
      }
      return mapped;
    };

    return NextResponse.json({
      shoutouts: shoutoutList.map((r: any) => mapItem(r)),
      songRequests: songList.map((r: any) => mapItem(r)),
      fameSubmissions: fameList.map((r: any) => mapItem(r)),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch admin data' }, { status: 500 });
  }
}

const VALID_STATUSES = ['verifying', 'queued', 'in_progress', 'complete', 'rejected'];

async function countInProgress(): Promise<number> {
    const [s, song, fame] = await Promise.all([
    db.select({ c: sql<number>`count(*) as c` }).from(shoutouts).where(eq(shoutouts.status, 'in_progress')),
    db.select({ c: sql<number>`count(*) as c` }).from(songRequests).where(eq(songRequests.status, 'in_progress')),
    db.select({ c: sql<number>`count(*) as c` }).from(fameSubmissions).where(eq(fameSubmissions.status, 'in_progress')),
  ]);
  return (s[0]?.c || 0) + (song[0]?.c || 0) + (fame[0]?.c || 0);
}

async function promoteNextQueued(): Promise<{ type: string; id: number } | null> {
    const [queuedShoutouts, queuedSongs, queuedFame] = await Promise.all([
    db.select({ id: shoutouts.id, createdAt: shoutouts.createdAt })
      .from(shoutouts).where(eq(shoutouts.status, 'queued')).orderBy(asc(shoutouts.createdAt)).limit(1),
    db.select({ id: songRequests.id, createdAt: songRequests.createdAt })
      .from(songRequests).where(eq(songRequests.status, 'queued')).orderBy(asc(songRequests.createdAt)).limit(1),
    db.select({ id: fameSubmissions.id, createdAt: fameSubmissions.createdAt })
      .from(fameSubmissions).where(eq(fameSubmissions.status, 'queued')).orderBy(asc(fameSubmissions.createdAt)).limit(1),
  ]);

  const candidates: { type: 'shoutout' | 'song' | 'fame'; id: number; createdAt: string }[] = [
    ...queuedShoutouts.map((r: any) => ({ type: 'shoutout' as const, id: r.id, createdAt: r.createdAt })),
    ...queuedSongs.map((r: any) => ({ type: 'song' as const, id: r.id, createdAt: r.createdAt })),
    ...queuedFame.map((r: any) => ({ type: 'fame' as const, id: r.id, createdAt: r.createdAt })),
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
        const body = await request.json();
    const { type, id, status, action } = body;

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

    if (status === 'in_progress') {
      await Promise.all([
        db.update(shoutouts).set({ status: 'complete' }).where(eq(shoutouts.status, 'in_progress')),
        db.update(songRequests).set({ status: 'complete' }).where(eq(songRequests.status, 'in_progress')),
        db.update(fameSubmissions).set({ status: 'complete' }).where(eq(fameSubmissions.status, 'in_progress')),
      ]);
    }

    switch (type) {
      case 'shoutout':
        await db.update(shoutouts).set({ status }).where(eq(shoutouts.id, id));
        break;
      case 'song':
        await db.update(songRequests).set({ status }).where(eq(songRequests.id, id));
        break;
      case 'fame':
        await db.update(fameSubmissions).set({ status }).where(eq(fameSubmissions.id, id));
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (status === 'complete') {
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
      case 'fame':
        await db.delete(fameSubmissions).where(eq(fameSubmissions.id, id));
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}