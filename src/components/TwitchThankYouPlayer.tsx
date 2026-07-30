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
    // www non-www fallback
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
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl overflow-hidden w-full max-w-md mx-auto">
      <div className="aspect-video bg-black relative">
        <iframe
          src={`https://player.twitch.tv/?channel=jakarl_dj&${parentQuery}&autoplay=false&muted=false`}
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          title="jakarl_dj on Twitch"
        ></iframe>
      </div>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm text-zinc-300 font-medium">Live from @jakarl_dj</span>
        <a
          href="https://twitch.tv/jakarl_dj"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          Open Twitch ↗
        </a>
      </div>
    </div>
  );
}
