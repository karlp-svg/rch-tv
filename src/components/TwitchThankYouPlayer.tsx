'use client';

import { useEffect, useState } from 'react';

/**
 * Twitch requires the hostname embedding its player as a `parent` query value.
 * Resolve it in the browser so previews, Vercel aliases, and custom domains work.
 */
export default function TwitchThankYouPlayer() {
  const [parent, setParent] = useState('localhost');

  useEffect(() => {
    setParent(window.location.hostname);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-purple-500/25 bg-black shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
      <iframe
        title="Jakarl DJ on Twitch"
        src={`https://player.twitch.tv/?channel=jakarl_dj&parent=${encodeURIComponent(parent)}&autoplay=false&muted=true`}
        className="block aspect-video w-full"
        allowFullScreen
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
