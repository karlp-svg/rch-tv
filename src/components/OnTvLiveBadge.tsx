'use client';

import { useState, useEffect } from 'react';

type LiveItem = {
  type: 'shoutout' | 'song' | 'fame';
  id: number;
  message?: string;
  title?: string;
  artist?: string;
  caption?: string;
};

export default function OnTvLiveBadge() {
  const [liveItem, setLiveItem] = useState<LiveItem | null>(null);

  useEffect(() => {
    const fetchCurrentOnTv = async () => {
      try {
        const res = await fetch('/api/tv', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const current = data.current || (data.queue && data.queue[0]) || null;
          setLiveItem(current);
        }
      } catch (e) {
        console.error('Failed to fetch current TV item:', e);
      }
    };

    fetchCurrentOnTv();
    const interval = setInterval(fetchCurrentOnTv, 3000);
    return () => clearInterval(interval);
  }, []);

  const getDisplayText = () => {
    if (!liveItem) return 'STANDBY';
    if (liveItem.type === 'shoutout' && liveItem.message) {
      return `📺 "${liveItem.message.slice(0, 24)}${liveItem.message.length > 24 ? '…' : ''}"`;
    }
    if (liveItem.type === 'song' && liveItem.title) {
      return `🎵 ${liveItem.title} - ${liveItem.artist || ''}`;
    }
    if (liveItem.type === 'fame') {
      return `📸 ${liveItem.caption ? `"${liveItem.caption.slice(0, 20)}…"` : 'Photo on TV'}`;
    }
    return 'ON TV';
  };

  return (
    <div className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono rounded-full flex items-center gap-2 max-w-[220px] sm:max-w-xs truncate shadow-lg">
      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0"></div>
      <span className="truncate font-semibold tracking-tight">{getDisplayText()}</span>
    </div>
  );
}
