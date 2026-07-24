import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

  // 4. DJ Console pages - DJ layout handles auth via auth-guard component
  if (pathname === '/dj' || pathname.startsWith('/dj/')) {
    return NextResponse.next();
  }

  // 5. Admin API routes (not session, handled above) - require Basic Auth
  if (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/settings') ||
    pathname.startsWith('/api/social-posts')
  ) {
    const djPass = process.env.DJ_CONSOLE_PASSWORD;
    if (djPass && djPass.length > 0) {
      const djUser = process.env.DJ_CONSOLE_USERNAME || 'dj';
      const auth = req.headers.get('authorization');
      if (!auth || !auth.startsWith('Basic ')) {
        return new NextResponse('Authentication required', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="DJ Console"',
            'Cache-Control': 'no-store',
          },
        });
      }
      try {
        const decoded = atob(auth.slice(6));
        const colonIndex = decoded.indexOf(':');
        if (colonIndex === -1 || decoded.slice(0, colonIndex) !== djUser || decoded.slice(colonIndex + 1) !== djPass) {
          return new NextResponse('Unauthorized', { status: 401 });
        }
      } catch {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }
    return NextResponse.next();
  }

  // 6. Everything else (landing, TV display, user pages) - allow through
  // Session validation for user pages is handled client-side via useRequireValidSession
  // The session token is stored in localStorage after QR scan, not in the URL
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
};
