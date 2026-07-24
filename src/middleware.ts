import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function unauthorized(realm = 'RCH TV') {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function hasValidBasicAuth(req: NextRequest) {
  // Read env vars directly - required for Vercel Edge runtime compatibility
  const djPass = process.env.DJ_CONSOLE_PASSWORD;
  if (!djPass || djPass.length === 0) return true; // no password set = no auth

  const djUser = process.env.DJ_CONSOLE_USERNAME || 'dj';
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Basic ')) return false;

  try {
    const decoded = atob(auth.slice(6));
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return false;
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    return username === djUser && password === djPass;
  } catch {
    return false;
  }
}

function isSandbox(): boolean {
  return process.env.NEXT_PUBLIC_PRODUCTION_MODE !== 'true';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Static assets - always allow
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Public API routes (have their own session validation) - always allow
  if (
    pathname.startsWith('/api/session') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/followers/check') ||
    pathname.startsWith('/api/fame') ||
    pathname.startsWith('/api/shoutouts') ||
    pathname.startsWith('/api/song-requests') ||
    pathname.startsWith('/api/tv')
  ) {
    return NextResponse.next();
  }

  // 3. Public session endpoint (needed for TV QR code) - allow through
  if (pathname === '/api/admin/session') {
    return NextResponse.next();
  }

  // 4. DJ Console pages - require Basic Auth
  //    Only /dj and /dj/* paths trigger the browser's built-in auth dialog
  if (pathname === '/dj' || pathname.startsWith('/dj/')) {
    if (!hasValidBasicAuth(req)) {
      return unauthorized('DJ Console');
    }
    return NextResponse.next();
  }

  // 5. Admin API routes (not session, handled above) - require Basic Auth
  if (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/settings') ||
    pathname.startsWith('/api/social-posts')
  ) {
    if (!hasValidBasicAuth(req)) {
      return unauthorized('DJ Console');
    }
    return NextResponse.next();
  }

  // 6. User app pages - in production, validate session param
  if (!isSandbox()) {
    const userPages = ['/dashboard', '/shoutout', '/song-request', '/make-famous'];
    if (userPages.includes(pathname)) {
      // Require session param in URL for production access
      const sessionToken = req.nextUrl.searchParams.get('session');
      if (!sessionToken) {
        // No session token - let client-side redirect handle it
        // The useRequireValidSession hook will redirect to /
        return NextResponse.next();
      }
    }
  }

  // 7. Everything else (landing, TV display) - allow through
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
};
