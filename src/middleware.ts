import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const TARGET = process.env.DEPLOY_TARGET || 'public';
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

  const isStaticAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]{1,10}$/.test(pathname);

  // Protect DJ console + admin APIs when DJ_CONSOLE_PASSWORD is set.
  const needsDjAuth = !!DJ_AUTH_PASS && (
    pathname === '/dj' ||
    pathname.startsWith('/dj/') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/settings') ||
    pathname.startsWith('/api/social-posts') ||
    // On dedicated DJ deployment, root rewrites to /dj, so protect '/'
    (TARGET === 'dj' && pathname === '/')
  );

  if (needsDjAuth && !hasValidBasicAuth(req)) {
    return unauthorized();
  }

  // Always allow other API routes, Next internals, static assets
  if (pathname.startsWith('/api') || isStaticAsset) {
    return NextResponse.next();
  }

  // DJ deployment: root shows DJ console, everything else redirects to it
  if (TARGET === 'dj') {
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/dj', req.url));
    }
    if (!pathname.startsWith('/dj')) {
      return NextResponse.redirect(new URL('/dj', req.url));
    }
    return NextResponse.next();
  }

  // TV deployment: root shows TV display, everything else redirects to it
  if (TARGET === 'tv') {
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/tv', req.url));
    }
    if (!pathname.startsWith('/tv')) {
      return NextResponse.redirect(new URL('/tv', req.url));
    }
    return NextResponse.next();
  }

  // Public deployment (only when explicitly set as 'public' in production)
  // In dev / preview sandbox (where DEPLOY_TARGET is unset or not 'public'), allow viewing /dj and /tv directly.
  if (
    TARGET === 'public' &&
    process.env.NODE_ENV === 'production' &&
    process.env.VERCEL_ENV === 'production' &&
    (pathname === '/dj' || pathname.startsWith('/dj/') ||
     pathname === '/tv' || pathname.startsWith('/tv/'))
  ) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
