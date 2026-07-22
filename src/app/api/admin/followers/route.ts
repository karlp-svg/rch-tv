import { db } from '@/db';
import { instagramFollowers } from '@/db/schema';
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [res] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(instagramFollowers);

    return NextResponse.json({ count: res?.count || 0 });
  } catch (error) {
    console.error('Error fetching followers count:', error);
    return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 });
  }
}

// Recursively extract strings from JSON objects/arrays that look like usernames
function extractHandlesFromData(data: any, handles: Set<string>) {
  if (typeof data === 'string') {
    // If it's multiline or comma separated, split
    const items = data.split(/[\r\n,;\t]+/);
    for (let item of items) {
      const clean = item.toLowerCase().replace(/^@+/, '').trim();
      // Check if valid IG handle syntax (letters, numbers, dot, underscore, 1-30 chars)
      // Ignore common non-handle structural strings
      if (/^[a-z0-9._]{1,30}$/.test(clean)) {
        if (!['value', 'href', 'title', 'timestamp', 'string_list_data', 'media_map_data', 'username', 'relationships_followers'].includes(clean)) {
          handles.add(clean);
        }
      }
    }
  } else if (Array.isArray(data)) {
    for (const item of data) {
      extractHandlesFromData(item, handles);
    }
  } else if (data && typeof data === 'object') {
    // Specific check for Instagram export structure: { string_list_data: [ { value: "username" } ] }
    if (data.string_list_data && Array.isArray(data.string_list_data)) {
      for (const item of data.string_list_data) {
        if (item && typeof item.value === 'string') {
          const clean = item.value.toLowerCase().replace(/^@+/, '').trim();
          if (/^[a-z0-9._]{1,30}$/.test(clean)) {
            handles.add(clean);
          }
        }
      }
    } else if (data.value && typeof data.value === 'string') {
      const clean = data.value.toLowerCase().replace(/^@+/, '').trim();
      if (/^[a-z0-9._]{1,30}$/.test(clean)) {
        handles.add(clean);
      }
    } else {
      for (const key of Object.keys(data)) {
        // If the key itself looks like a handle in a key-value map, extract value
        extractHandlesFromData(data[key], handles);
      }
    }
  }
}

export async function POST(request: Request) {
  try {
    const { dump, rawText, replaceAll } = await request.json();

    const handlesSet = new Set<string>();

    if (rawText && typeof rawText === 'string') {
      extractHandlesFromData(rawText, handlesSet);
    }
    if (dump !== undefined && dump !== null) {
      extractHandlesFromData(dump, handlesSet);
    }

    const handles = Array.from(handlesSet);

    if (handles.length === 0) {
      return NextResponse.json({ error: 'No valid Instagram handles found in the uploaded data.' }, { status: 400 });
    }

    if (replaceAll) {
      await db.delete(instagramFollowers);
    }

    // Insert in batches of 500
    let insertedCount = 0;
    const batchSize = 500;
    for (let i = 0; i < handles.length; i += batchSize) {
      const batch = handles.slice(i, i + batchSize).map(handle => ({
        handle,
      }));
      if (batch.length > 0) {
        await db.insert(instagramFollowers)
          .values(batch)
          .onConflictDoNothing()
          .execute();
        insertedCount += batch.length;
      }
    }

    const [finalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(instagramFollowers);

    return NextResponse.json({
      success: true,
      processed: handles.length,
      totalLoaded: finalRes?.count || 0,
    });
  } catch (error) {
    console.error('Error processing followers dump:', error);
    return NextResponse.json({ error: 'Failed to process followers data' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.delete(instagramFollowers);
    return NextResponse.json({ success: true, count: 0 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear followers' }, { status: 500 });
  }
}
