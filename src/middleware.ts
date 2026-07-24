import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const TARGET = process.env.DEPLOY_TARGET || 'single';
const DJ_AUTH_USER = process.env.DJ_CONSOLE_USERNAME || 'dj';
const DJ_AUTH_PASS = process.env.DJ_CONSOLE_PASSWORD;

/**
 * How this works (single Vercel deployment):
 *
 *   /dj            → DJ Console (Basic Auth if password set) — always open
 *   /tv            → TV Display — always open
 *   /api/*         → API routes — always open
 *   /              → Landing page — only shows features if session is detected
 *   /dashboard
 *   /shoutout       → User pages — validated client-side via localStorage session
 *   /song-request     The middleware lets these through; the client component
 *   /make-famous       calls /api/session to verify and redirects to / if invalid
 *
 * The QR code URL format:
 *   https://your-app.vercel.app/?session=abc123
 *
 * The landing page reads the session from the URL and stores it in localStorage.
 * Internal navigation keeps the session via localStorage (not URL params).
 */
const USER_PAGES = new Set([
  '/',
  '/dashboard',
  '/shoutout',
  '/song-request',
  '/make-famous',
]);

function unauthorized(msg = 'Authentication required') {
  return new NextResponse(msg, {
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

  // Always allow static assets and API routes
  if (pathname.startsWith('/api') || isStaticAsset) {
    return NextResponse.next();
  }

  // --- DJ Console ---
  if (pathname === '/dj' || pathname.startsWith('/dj/')) {
    if (!!DJ_AUTH_PASS && !hasValidBasicAuth(req)) {
      return unauthorized();
    }
    return NextResponse.next();
  }

  // --- TV Display ---
  if (pathname === '/tv' || pathname.startsWith('/tv/')) {
    return NextResponse.next();
  }

  // --- User pages (session-protected via client-side) ---
  // Let them through — the client component handles session validation
  // by calling /api/session?token=xxx and redirects to / if invalid.
  // The landing page (/) shows a "Scan QR code" state if no session present.
  if (USER_PAGES.has(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
