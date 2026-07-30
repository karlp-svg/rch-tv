'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function SandboxSwitcher() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  // Hide in production — set NEXT_PUBLIC_PRODUCTION_MODE=true in Vercel env vars to remove sandbox nav
  if (process.env.NEXT_PUBLIC_PRODUCTION_MODE === 'true') return null;

  // Also hide on dedicated DJ or TV Vercel deployments
  const target = process.env.NEXT_PUBLIC_DEPLOY_TARGET;
  if (target === 'dj' || target === 'tv') return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex gap-1 bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 text-[10px] font-mono text-zinc-400 shadow-2xl">
      <span className="text-zinc-600 mr-1">Sandbox:</span>
      <Link href="/" className={`px-2 py-0.5 rounded-full ${pathname === '/' ? 'bg-white/10 text-white' : 'hover:text-white'}`}>📱 User App</Link>
      <Link href="/dj" className={`px-2 py-0.5 rounded-full ${pathname === '/dj' ? 'bg-white/10 text-white' : 'hover:text-white'}`}>🎛️ DJ Console</Link>
      <Link href="/tv" className={`px-2 py-0.5 rounded-full ${pathname === '/tv' ? 'bg-white/10 text-white' : 'hover:text-white'}`}>📺 TV Display</Link>
      <Link href="/qrcode" className={`px-2 py-0.5 rounded-full ${pathname === '/qrcode' ? 'bg-white/10 text-white' : 'hover:text-white'}`}>↗ QR</Link>
    </div>
  );
}
