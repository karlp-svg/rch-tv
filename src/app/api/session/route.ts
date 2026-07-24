import { NextResponse } from 'next/server';
import { getPublicSession, validatePublicSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const current = await getPublicSession();
    const valid = token ? await validatePublicSession(token) : false;

    const response = NextResponse.json({
      active: !!current,
      valid,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return response;
  } catch (error) {
    console.error('Error checking session:', error);
    return NextResponse.json({ active: false, valid: false }, { status: 500 });
  }
}