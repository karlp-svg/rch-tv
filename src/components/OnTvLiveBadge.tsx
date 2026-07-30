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
    <div className="px-2.5 py-1 bg-white/10 rounded-full text-[10px] flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
      {getDisplayText()}
    </div>
  );
}
