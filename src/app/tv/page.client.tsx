'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type TVItem =
  | { type: 'shoutout'; id: number; message: string; fromName: string | null; instagramHandle: string | null; showHandleOnTv: boolean; createdAt: string }
  | { type: 'song'; id: number; artist: string; title: string | null; anyTitle?: boolean; requesterName: string | null; instagramHandle: string | null; showHandleOnTv: boolean; createdAt: string }
  | { type: 'fame'; id: number; polaroidSrc: string | null; imageSrc: string | null; caption: string | null; instagramHandle: string | null; showHandleOnTv: boolean; createdAt: string };

const IMAGE_PROXY_BASE = '/api/fame/image/';

type FameSettings = {
  photoSize: number;
  completedScale: number;
  rotation: number;
  spread: number;
  spreadY: number;
  titleOffset: number;
  displayOffset: number;
  completedFade: number;
};

const DEFAULT_FAME_SETTINGS: FameSettings = {
  photoSize: 42,
  completedScale: 70,
  rotation: 15,
  spread: 600,
  spreadY: 200,
  titleOffset: 22,
  displayOffset: 0,
  completedFade: 70,
};

export default function TVPage() {
  const [currentItem, setCurrentItem] = useState<TVItem | null>(null);
  const [completedFame, setCompletedFame] = useState<Array<{ id: number; polaroidSrc: string | null; imageSrc: string | null; createdAt: string }>>([]);
  const [fading, setFading] = useState(false);
  const [prevKey, setPrevKey] = useState<string>('');
  const [fameSettings, setFameSettings] = useState<FameSettings>(DEFAULT_FAME_SETTINGS);
  const [hideBackground, setHideBackground] = useState<boolean>(false);
  const [publicQr, setPublicQr] = useState<string>('');
  const [publicSession, setPublicSession] = useState<string>('');

  // Fetch public session QR for the idle screen
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/admin/session', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setPublicSession(data.session);
            const qr = await QRCode.toDataURL(
              `${typeof window !== 'undefined' ? window.location.origin : ''}/?session=${encodeURIComponent(data.session)}`,
              { margin: 2, width: 400, color: { dark: '#a855f7', light: '#00000000' } }
            );
            setPublicQr(qr);
          }
        }
      } catch (_) {}
    };
    fetchSession();
    const interval = setInterval(fetchSession, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Two-tier polling strategy to minimize Cloudflare Workers requests:
  // 1. Lightweight check every 2 seconds (86KB/day) - just returns content key
  // 2. Full fetch only when content changes (~500 bytes when changed)
  // This allows 100+ TV screens on Cloudflare free tier (100k requests/day)
  useEffect(() => {
    let lastKnownKey = prevKey;

    const checkForChanges = async () => {
      try {
        // Lightweight check endpoint - returns only metadata (~100 bytes)
        const res = await fetch('/api/tv/check', { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        const newKey = data.key || '';

        // Only fetch full content if key changed
        if (newKey !== lastKnownKey) {
          lastKnownKey = newKey;

          if (data.hasContent) {
            const fullRes = await fetch('/api/tv', { cache: 'no-store' });
            if (fullRes.ok) {
              const fullData = await fullRes.json();
              const live: TVItem | null = fullData.current || null;

              setFading(true);
              setTimeout(() => {
                setCurrentItem(live);
                setPrevKey(newKey);
                setFading(false);
              }, 400);

              if (fullData.completedFame) setCompletedFame(fullData.completedFame);
              if (fullData.fameSettings) setFameSettings(fullData.fameSettings);
              if (fullData.hideBackground !== undefined) setHideBackground(fullData.hideBackground);
            }
          } else {
            // No content, clear display
            setCurrentItem(null);
            setPrevKey('');
          }
        }
      } catch (_) {}
    };

    checkForChanges();
    const poll = setInterval(checkForChanges, 2000); // Check every 2 seconds
    return () => clearInterval(poll);
  }, []);

  if (!currentItem) {
    return (
      <main className="w-screen h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="text-center mb-8">
          <div
            className="text-7xl sm:text-8xl font-normal tracking-[0.08em] text-transparent bg-clip-text bg-gradient-to-br from-purple-400 via-pink-400 to-purple-600 mb-4 whitespace-pre"
            style={{ fontFamily: "'Vortax', 'Orbitron', 'Audiowide', system-ui, sans-serif" }}
          >
            RCH  TV
          </div>
          <div className="text-zinc-500 text-sm mb-2">Waiting for requests...</div>
          <div className="text-zinc-600 text-xs">Scan the QR code to join</div>
        </div>
        {publicQr ? (
          <div className="relative">
            <img src={publicQr} alt="Scan to join" className="w-64 h-64 sm:w-80 sm:h-80 object-contain" />
            <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-purple-400 font-mono">
              {publicSession ? `${publicSession.slice(0, 8)}...` : ''}
            </div>
          </div>
        ) : (
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl border-2 border-dashed border-zinc-700 grid place-items-center text-zinc-600">
            Loading QR...
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="w-screen h-screen bg-black overflow-hidden">
      <div
        className={`w-full h-full flex items-center justify-center transition-opacity duration-400 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {currentItem.type === 'shoutout' && <ShoutoutView item={currentItem} hideBackground={hideBackground} />}
        {currentItem.type === 'song' && <SongView item={currentItem} hideBackground={hideBackground} />}
        {currentItem.type === 'fame' && <FameView item={currentItem} completedFame={completedFame} fameSettings={fameSettings} hideBackground={hideBackground} />}
      </div>
    </main>
  );
}

function ShoutoutView({ item, hideBackground }: { item: Extract<TVItem, { type: 'shoutout' }>; hideBackground?: boolean }) {
  return (
    <div className={`w-full h-full ${hideBackground ? 'bg-black' : 'bg-gradient-to-br from-purple-950 via-black to-indigo-950'} flex flex-col items-center justify-center p-12 text-center`}>
      <div className="text-5xl sm:text-6xl uppercase tracking-[0.08em] text-purple-400 font-normal whitespace-pre mb-1" style={{ fontFamily: "'Vortax', system-ui, sans-serif" }}>
        RCH  TV
      </div>
      <div className="text-sm uppercase tracking-[0.3em] text-purple-300 mb-8 font-light">TV Shoutout</div>
      <div
        className="text-white font-bold leading-tight max-w-4xl text-center mb-8"
        style={{ fontFamily: "'Gochi Hand', 'Permanent Marker', cursive", fontSize: 'clamp(3rem, 8vw, 6rem)' }}
      >
        {item.message}
      </div>
      {item.fromName && (
        <div className="text-purple-300 text-5xl mb-4" style={{ fontFamily: "'Caveat', cursive" }}>
          — {item.fromName}
        </div>
      )}
      {item.showHandleOnTv && item.instagramHandle && (
        <div className="mt-4 inline-flex items-center gap-3 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-full px-6 py-3">
          <InstagramIcon className="w-6 h-6 text-pink-400" />
          <span className="text-white font-bold text-xl" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {item.instagramHandle}
          </span>
        </div>
      )}
    </div>
  );
}

function SongView({ item, hideBackground }: { item: Extract<TVItem, { type: 'song' }>; hideBackground?: boolean }) {
  return (
    <div className={`w-full h-full ${hideBackground ? 'bg-black' : 'bg-gradient-to-br from-amber-950 via-black to-yellow-950'} flex flex-col items-center justify-center p-12 text-center`}>
      <div className="text-5xl sm:text-6xl uppercase tracking-[0.08em] text-amber-400 font-normal whitespace-pre mb-1" style={{ fontFamily: "'Vortax', system-ui, sans-serif" }}>
        RCH  TV
      </div>
      <div className="text-sm uppercase tracking-[0.3em] text-amber-300 mb-8 font-light">Request Now Playing</div>
      {/* Artist on top — the hero */}
      <div
        className={`text-white font-bold leading-tight max-w-4xl text-center ${item.anyTitle ? 'mb-8' : 'mb-2'}`}
        style={{ fontFamily: "'Orbitron', 'Audiowide', system-ui, sans-serif", fontSize: item.anyTitle ? 'clamp(3.5rem, 9vw, 7rem)' : 'clamp(2.5rem, 7vw, 5rem)' }}
      >
        {item.artist}
      </div>
      {/* Title below, smaller */}
      {!item.anyTitle && (
        <div
          className="text-amber-300 mb-8"
          style={{ fontFamily: "'Permanent Marker', cursive", fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
        >
          {item.title}
        </div>
      )}
      {item.requesterName && (
        <div className="text-zinc-400 text-5xl mb-2" style={{ fontFamily: "'Caveat', cursive" }}>
          Requested by {item.requesterName}
        </div>
      )}
      {item.showHandleOnTv && item.instagramHandle && (
        <div className="mt-4 inline-flex items-center gap-3 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-full px-6 py-3">
          <InstagramIcon className="w-6 h-6 text-amber-400" />
          <span className="text-white font-bold text-xl" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {item.instagramHandle}
          </span>
        </div>
      )}
    </div>
  );
}

function FameView({ item, completedFame, fameSettings, hideBackground }: { item: Extract<TVItem, { type: 'fame' }>; completedFame: Array<{ id: number; polaroidSrc: string | null; imageSrc: string | null; createdAt: string }>; fameSettings: FameSettings; hideBackground?: boolean }) {
  const imgSrc = item.polaroidSrc || `${IMAGE_PROXY_BASE}${item.id}?v=polaroid`;
  const photoSize = fameSettings.photoSize;
  const completedScale = fameSettings.completedScale / 100;
  const maxRotation = fameSettings.rotation;
  const maxSpread = fameSettings.spread;
  const maxSpreadY = fameSettings.spreadY;

  const rotation = ((item.id * 47) % (maxRotation * 2 + 1)) - maxRotation;

  const backgroundPhotos = completedFame.filter(photo => photo.id !== item.id);

  const completedSize = Math.round(photoSize * completedScale);

  const total = backgroundPhotos.length;
  const getScatterPosition = (id: number, index: number) => {
    const seed = id * 7919;
    // Alternate: even goes right, odd goes left
    const side = index % 2 === 0 ? 1 : -1;
    
    // Progressively outward: early completed photos stay closer to center,
    // later ones spread further. With only 1 completed photo, it stays near center.
    const progress = total > 0 ? index / Math.max(1, total - 1) : 0;
    const spreadAtProgress = maxSpread * (0.1 + progress * 0.9);
    const minSpread = spreadAtProgress * 0.25;
    const xVariation = ((seed % 1000) / 1000) * (spreadAtProgress - minSpread);
    const x = side * (minSpread + xVariation);
    
    const yProgress = total > 0 ? index / Math.max(1, total - 1) : 0;
    const spreadYAtProgress = maxSpreadY * (0.05 + yProgress * 0.9);
    const y = ((seed % 777) / 777) * spreadYAtProgress * 2 - spreadYAtProgress;
    
    const rotate = side * (((seed % (maxRotation + 1)) + 2) % (maxRotation + 1));
    const scale = (completedScale * 0.8) + ((seed % 20) / 100);
    return { x, y, rotate, scale };
  };

  const displayShift = fameSettings.displayOffset;
  // fade: 0 = fully faded (grey/dim), 100 = full colour
  const fadeAmount = fameSettings.completedFade / 100;
  const completedFilter = `saturate(${(0.2 + fadeAmount * 0.8).toFixed(2)}) brightness(${(0.45 + fadeAmount * 0.55).toFixed(2)}) contrast(${(0.8 + fadeAmount * 0.2).toFixed(2)})`;

  return (
    <div className={`relative w-full h-full ${hideBackground ? 'bg-black' : 'bg-gradient-to-br from-pink-950 via-black to-rose-950'} flex items-center justify-center p-8 overflow-hidden`}>
      {/* Everything below shifts by displayOffset (whole layout) */}
      <div
        className="absolute inset-0"
        style={{ transform: `translateY(${displayShift}px)` }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[...backgroundPhotos].reverse().map((photo, index) => {
            const bgImgSrc = photo.polaroidSrc || `${IMAGE_PROXY_BASE}${photo.id}?v=polaroid`;
            // Calculate position using the original array index so layout remains stable
            // regardless of reverse order
            const originalIndex = backgroundPhotos.length - 1 - index;
            const pos = getScatterPosition(photo.id, originalIndex);

            return (
              <img
                key={photo.id}
                src={bgImgSrc}
                alt="Wall of Fame"
                className="absolute object-contain shadow-[0_15px_40px_rgba(0,0,0,0.8)] rounded-md"
                style={{
                  maxHeight: `${completedSize}vh`,
                  maxWidth: `${completedSize}vw`,
                  transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotate}deg) scale(${pos.scale})`,
                  filter: completedFilter,
                  // Higher z-index for more recent photos (since we reversed, index 0 is oldest)
                  zIndex: index,
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `${IMAGE_PROXY_BASE}${photo.id}`;
                }}
              />
            );
          })}
        </div>

        <div
          className="absolute inset-x-0 z-30 text-center pointer-events-none"
          style={{ top: `${fameSettings.titleOffset}%` }}
        >
          <div
            className="text-5xl sm:text-6xl uppercase tracking-[0.08em] text-pink-400 font-normal whitespace-pre -mb-3 drop-shadow-[0_6px_14px_rgba(0,0,0,0.95)]"
            style={{ fontFamily: "'Vortax', system-ui, sans-serif", WebkitTextStroke: '2px black' }}
          >
            RCH  TV
          </div>
          <div
            className="text-6xl sm:text-7xl uppercase tracking-[0.02em] text-white font-bold drop-shadow-[0_8px_20px_rgba(0,0,0,0.95)]"
            style={{ fontFamily: "'Westmeath', 'Montserrat', sans-serif", WebkitTextStroke: '3px black' }}
          >
            Wall of Fame
          </div>
        </div>

        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <img
            src={imgSrc}
            alt="Make me famous"
            className="object-contain shadow-[0_25px_60px_rgba(0,0,0,0.95)] rounded-md filter drop-shadow-[0_20px_35px_rgba(0,0,0,0.9)]"
            style={{
              maxHeight: `${photoSize}vh`,
              maxWidth: `${photoSize}vw`,
              transform: `rotate(${rotation}deg)`,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `${IMAGE_PROXY_BASE}${item.id}`;
            }}
          />
        </div>
      </div>
    </div>
  );
}

function InstagramIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
