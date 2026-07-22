import { NextResponse } from 'next/server';
import { ensureDatabaseCompatibility } from '@/db';
import { generateSessionToken, getOrCreatePublicSession, setPublicSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
    const session = await getOrCreatePublicSession();
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function POST() {
  try {
    await ensureDatabaseCompatibility();
    const token = generateSessionToken();
    await setPublicSession(token);
    return NextResponse.json({ session: token });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
