'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function SandboxSwitcher() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Hide in production — set NEXT_PUBLIC_PRODUCTION_MODE=true in Vercel env vars to remove sandbox nav
  if (process.env.NEXT_PUBLIC_PRODUCTION_MODE === 'true') return null;

  // Also hide on dedicated DJ or TV Vercel deployments
  const target = process.env.NEXT_PUBLIC_DEPLOY_TARGET;
  if (target === 'dj' || target === 'tv') return null;

  return (
    <div className="fixed top-2 right-2 z-[9999] flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md border border-white/20 p-1.5 rounded-full shadow-2xl text-[11px] font-mono text-white">
      <span className="text-zinc-400 pl-2 pr-1 font-semibold text-[9px] uppercase tracking-wider hidden sm:inline">Sandbox:</span>
      
      <Link
        href="/dashboard"
        className={`px-3 py-1 rounded-full transition-colors font-medium ${
          pathname === '/' || pathname === '/dashboard' || pathname === '/shoutout' || pathname === '/song-request' || pathname === '/make-famous'
            ? 'bg-purple-600 text-white font-bold'
            : 'text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
      >
        📱 User App
      </Link>

      <Link
        href="/dj"
        className={`px-3 py-1 rounded-full transition-colors font-medium ${
          pathname.startsWith('/dj')
            ? 'bg-amber-600 text-white font-bold'
            : 'text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
      >
        🎛️ DJ Console
      </Link>

      <Link
        href="/tv"
        target="_blank"
        className={`px-3 py-1 rounded-full transition-colors font-medium ${
          pathname.startsWith('/tv')
            ? 'bg-emerald-600 text-white font-bold'
            : 'text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
      >
        📺 TV Display ↗
      </Link>
    </div>
  );
}
