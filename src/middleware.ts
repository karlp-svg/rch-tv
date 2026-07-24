import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DJ_AUTH_USER = process.env.DJ_CONSOLE_USERNAME || 'dj';
const DJ_AUTH_PASS = process.env.DJ_CONSOLE_PASSWORD;

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="DJ Console"',
      'Cache-Control': 'no-store',
    },
  });
}

function hasValidBasicAuth(req: NextRequest) {
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

  // 2. Public API routes - always allow (session validation happens in the route handler)
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
  if (pathname === '/dj' || pathname.startsWith('/dj/')) {
    if (!!DJ_AUTH_PASS && !hasValidBasicAuth(req)) {
      return unauthorized();
    }
    return NextResponse.next();
  }

  // 5. Admin API routes - require Basic Auth (after /api/admin/session is allowed above)
  if (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/settings') ||
    pathname.startsWith('/api/social-posts')
  ) {
    if (!!DJ_AUTH_PASS && !hasValidBasicAuth(req)) {
      return unauthorized();
    }
    return NextResponse.next();
  }

  // 6. Everything else (public pages, TV display, landing, dashboard, etc.) - allow through
  // Session validation happens client-side
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
