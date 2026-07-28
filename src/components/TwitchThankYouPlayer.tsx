'use client';

import { useEffect, useState } from 'react';

/**
 * Twitch requires the hostname embedding its player as a `parent` query value.
 * Resolve it in the browser so previews, Vercel aliases, and custom domains work.
 * Includes multiple parent fallbacks for www / root and common platform domains
 * to avoid the mobile "refused to connect" case.
 */
export default function TwitchThankYouPlayer() {
  const [parents, setParents] = useState<string[]>(['localhost']);

  useEffect(() => {
    const host = window.location.hostname;
    const list = new Set<string>();
    list.add(host);
    // www <-> non-www fallback
    if (host.startsWith('www.')) list.add(host.slice(4));
    else list.add(`www.${host}`);
    // Common platform parents that might be needed when embedded
    if (host.endsWith('.vercel.app')) {
      list.add('vercel.app');
    }
    list.add('localhost');
    setParents(Array.from(list).filter(Boolean));
  }, []);

  const parentQuery = parents.map(p => `parent=${encodeURIComponent(p)}`).join('&');

  return (
    <div className="overflow-hidden rounded-2xl border border-purple-500/25 bg-black shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
      <div className="relative w-full aspect-video min-h-[200px] bg-black">
        <iframe
          title="Jakarl DJ on Twitch"
          src={`https://player.twitch.tv/?channel=jakarl_dj&${parentQuery}&autoplay=false&muted=true`}
          className="absolute inset-0 h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          loading="eager"
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/80 border-t border-white/10">
        <span className="text-[10px] text-zinc-400 truncate">twitch.tv/jakarl_dj</span>
        <a
          href="https://www.twitch.tv/jakarl_dj"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[10px] font-semibold text-purple-300 hover:text-white underline-offset-2 hover:underline"
        >
          Open Twitch
        </a>
      </div>
    </div>
  );
}
