import { db } from '@/db';
import { instagramFollowers } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const handleRaw = searchParams.get('handle') || '';
    const cleanHandle = handleRaw.toLowerCase().replace(/^@+/, '').trim();

    if (!cleanHandle) {
      return NextResponse.json({ found: false });
    }

    const [row] = await db
      .select({ handle: instagramFollowers.handle })
      .from(instagramFollowers)
      .where(eq(instagramFollowers.handle, cleanHandle))
      .limit(1);

    return NextResponse.json({ found: !!row });
  } catch (error) {
    console.error('Error verifying follower:', error);
    return NextResponse.json({ found: false }, { status: 500 });
  }
}
