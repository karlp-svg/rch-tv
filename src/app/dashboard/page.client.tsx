'use client';

import { Music, Tv, Star, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import OnTvLiveBadge from '@/components/OnTvLiveBadge';
import { useRequireValidSession } from '@/lib/useSessionGuard';

export default function DashboardClient() {
  const { checking, valid } = useRequireValidSession();
  if (checking || !valid) {
    return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">Checking session…</main>;
  }
  return (
    <main className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-zinc-950 text-white flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-5 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          
          <OnTvLiveBadge />
        </div>

        {/* Title */}
        <div className="text-center shrink-0 mb-6">
          <div className="text-4xl mb-2">🎧</div>
          <h1 className="text-3xl font-bold tracking-tighter mb-1">Take Over the Screen</h1>
          <p className="text-zinc-400 text-xs">Choose an option</p>
        </div>

        {/* 3 Buttons - fill space */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <ActionCard
            href="/shoutout"
            icon={<Tv className="w-6 h-6" />}
            title="TV Shoutout"
            desc="Send a message to the big screen"
            color="purple"
          />
          <ActionCard
            href="/song-request"
            icon={<Music className="w-6 h-6" />}
            title="Song Request"
            desc="Ask the DJ to play a track"
            color="amber"
          />
          <ActionCard
            href="/make-famous"
            icon={<Star className="w-6 h-6" />}
            title="Make Me Famous"
            desc="Get your photo on the TV"
            color="pink"
          />
        </div>

        <div className="text-center text-[10px] text-zinc-600 pt-3 shrink-0">
          ALL REQUESTS ARE MODERATED
        </div>
      </div>
    </main>
  );
}

function ActionCard({ href, icon, title, desc, color }: {
  href: string; icon: React.ReactNode; title: string; desc: string; color: 'purple' | 'amber' | 'pink';
}) {
  const colors = {
    purple: { border: 'hover:border-purple-500/50', iconBg: 'bg-purple-500/10 text-purple-400', arrow: 'text-purple-400' },
    amber: { border: 'hover:border-amber-500/50', iconBg: 'bg-amber-500/10 text-amber-400', arrow: 'text-amber-400' },
    pink: { border: 'hover:border-pink-500/50', iconBg: 'bg-pink-500/10 text-pink-400', arrow: 'text-pink-400' },
  };
  const c = colors[color];
  
  return (
    <Link href={href} className="group flex-1">
      <div className={`bg-zinc-900 border border-white/10 ${c.border} rounded-3xl p-5 h-full transition-all group-active:scale-[0.98] flex items-center gap-4`}>
        <div className={`h-14 w-14 ${c.iconBg} rounded-2xl flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold leading-tight">{title}</div>
          <div className="text-zinc-400 text-xs mt-0.5">{desc}</div>
        </div>
        <ArrowRight className={`w-5 h-5 ${c.arrow} shrink-0`} />
      </div>
    </Link>
  );
}
