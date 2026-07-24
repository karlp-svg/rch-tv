import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DJ_AUTH_USER = process.env.DJ_CONSOLE_USERNAME || 'dj';
const DJ_AUTH_PASS = process.env.DJ_CONSOLE_PASSWORD;
const DJ_AUTH_ENABLED = DJ_AUTH_PASS && DJ_AUTH_PASS.length > 0;

function unauthorized(realm = 'DJ Console') {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function hasValidBasicAuth(req: NextRequest) {
  if (!DJ_AUTH_ENABLED) return true;
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Basic ')) return false;

  try {
    const decoded = atob(auth.slice(6));
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return false;
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    return username === DJ_AUTH_USER && password === DJ_AUTH_PASS;
  } catch {
    return false;
  }
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
    if (DJ_AUTH_ENABLED && !hasValidBasicAuth(req)) {
      return unauthorized();
    }
    return NextResponse.next();
  }

  // 5. Admin API routes (not session, handled above) - require Basic Auth
  if (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/settings') ||
    pathname.startsWith('/api/social-posts')
  ) {
    if (DJ_AUTH_ENABLED && !hasValidBasicAuth(req)) {
      return unauthorized();
    }
    return NextResponse.next();
  }

  // 6. Everything else (landing, TV display, dashboard, etc.) - allow through
  //    Session validation for user pages happens client-side via useRequireValidSession
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
