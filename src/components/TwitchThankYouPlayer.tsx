'use client';

import { useEffect, useState } from 'react';

/**
 * Twitch requires the hostname embedding its player as a `parent` query value.
 * Resolve it in the browser so previews, Vercel aliases, and custom domains work.
 * Includes multiple parent fallbacks for www / root and common platform domains
 * to avoid the mobile "refused to connect" case.
 */

const TWITCH_CHANNEL = 'jakarl_dj';

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
          src={`https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&${parentQuery}&autoplay=false&muted=false`}
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          title={`${TWITCH_CHANNEL} on Twitch`}
        ></iframe>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-zinc-300 font-medium">Live from @{TWITCH_CHANNEL}</span>
          <a
            href={`https://twitch.tv/${TWITCH_CHANNEL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Open Twitch ↗
          </a>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://www.twitch.tv/${TWITCH_CHANNEL}/follow`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 text-white transition-colors active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Follow
          </a>
          <a
            href={`https://www.twitch.tv/subs/${TWITCH_CHANNEL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Subscribe
          </a>
        </div>
      </div>
    </div>
  );
}
