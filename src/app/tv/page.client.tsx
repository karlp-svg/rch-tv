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
  const [hideIdleScreen, setHideIdleScreen] = useState<boolean>(false);
  const [publicQr, setPublicQr] = useState<string>('');
  const [publicSession, setPublicSession] = useState<string>('');

  // Fetch public session QR for the idle screen
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/admin/session?_=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setPublicSession(data.session);
            const qr = await QRCode.toDataURL(
              `${typeof window !== 'undefined' ? window.location.origin : ''}/?session=${encodeURIComponent(data.session)}`,
              { margin: 2, width: 400, color: { dark: '#ffffff', light: '#00000000' } }
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
        // Also refresh settings (e.g. hideBackground, hideIdleScreen toggles from DJ console)
        fetch('/api/settings', { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .then(s => {
            if (s) {
              if (s.tv_hide_background !== undefined) setHideBackground(s.tv_hide_background === 'true');
              if (s.tv_hide_idle_screen !== undefined) setHideIdleScreen(s.tv_hide_idle_screen === 'true');
            }
          })
          .catch(() => {});

        // Lightweight check endpoint - returns only metadata (~100 bytes)
        // Add timestamp to bust OBS browser source cache
        const res = await fetch(`/api/tv/check?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        const newKey = data.key || '';

        // Only fetch full content if key changed
        if (newKey !== lastKnownKey) {
          lastKnownKey = newKey;

          if (data.hasContent) {
            const fullRes = await fetch(`/api/tv?_=${Date.now()}`, { cache: 'no-store' });
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
    const poll = setInterval(checkForChanges, 15000); // Check every 15 seconds
    return () => clearInterval(poll);
  }, []);

  if (!currentItem) {
    // If hide idle screen is on, show nothing
    if (hideIdleScreen) {
      return <main className="w-screen h-screen bg-transparent"></main>;
    }
    return (
      <main className={`w-screen h-screen ${hideBackground ? 'bg-transparent' : 'bg-black'} flex flex-col items-center justify-center p-8`}>
        <div className="text-center mb-8">
          <div
            className="text-7xl sm:text-8xl font-normal tracking-[0.08em] text-transparent bg-clip-text bg-gradient-to-br from-purple-400 via-pink-400 to-purple-600 mb-4 whitespace-pre"
            style={{ fontFamily: "'Vortax', 'Orbitron', 'Audiowide', system-ui, sans-serif" }}
          >
            RCH  TV
          </div>
        </div>
        {publicQr ? (
          <div className="relative">
            <div className="w-64 h-64 sm:w-80 sm:h-80 bg-black/90 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.6)]">
              <img src={publicQr} alt="Scan to join" className="w-56 h-56 sm:w-[18rem] sm:h-[18rem] object-contain" />
            </div>
          </div>
        ) : (
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl border-2 border-dashed border-zinc-700 bg-black/40 grid place-items-center text-zinc-600">
            Loading QR...
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={`w-screen h-screen ${hideBackground ? 'bg-transparent' : 'bg-black'} overflow-hidden`}>
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
  const lineCount = item.message ? Math.min(3, Math.ceil(item.message.length / 28)) : 1;
  const bubbleH = Math.max(200, 120 + lineCount * 56 + (item.fromName ? 44 : 0));

  return (
    <div className={`w-full h-full ${hideBackground ? 'bg-transparent' : 'bg-gradient-to-br from-purple-950 via-black to-indigo-950'} flex flex-col items-center justify-center p-8`}>
      {/* RCH TV header on grey rounded rect */}
      <div className="bg-zinc-800/70 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-3 mb-8 shadow-2xl">
        <div
          className="text-4xl sm:text-5xl uppercase tracking-[0.08em] text-purple-400 font-normal whitespace-pre text-center"
          style={{ fontFamily: "'Vortax', system-ui, sans-serif" }}
        >
          RCH  TV
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-purple-300 text-center font-light mt-1">TV Shoutout</div>
      </div>

      {/* Speech bubble with handle inside at bottom-right */}
      <div className="relative max-w-3xl w-full mx-auto" style={{ perspective: '800px' }}>
        <div
          className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-[2.5rem] px-10 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative"
          style={{ transform: 'rotate(-0.5deg)' }}
        >
          <div
            className="text-purple-950 font-bold leading-tight text-center"
            style={{ fontFamily: "'Gochi Hand', 'Permanent Marker', cursive", fontSize: 'clamp(2rem, 5vw, 4rem)' }}
          >
            {item.message}
          </div>
          {item.fromName && (
            <div className="text-purple-600 text-center mt-4" style={{ fontFamily: "'Caveat', cursive", fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}>
              — {item.fromName}
            </div>
          )}
          {/* Instagram handle at bottom-right of bubble */}
          {item.showHandleOnTv && item.instagramHandle && (
            <div className="absolute bottom-3 right-4 flex items-center gap-1.5 bg-gradient-to-r from-pink-500/30 to-purple-500/30 border border-pink-500/40 rounded-full px-3 py-1">
              <InstagramIcon className="w-4 h-4 text-pink-500" />
              <span className="text-purple-800 font-bold text-xs" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {item.instagramHandle}
              </span>
            </div>
          )}
          {/* Speech bubble tail */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[24px] border-r-[24px] border-t-[24px] border-l-transparent border-r-transparent border-t-purple-50"></div>
        </div>
      </div>
    </div>
  );
}

function SongView({ item, hideBackground }: { item: Extract<TVItem, { type: 'song' }>; hideBackground?: boolean }) {
  return (
    <div className={`w-full h-full ${hideBackground ? 'bg-transparent' : 'bg-gradient-to-br from-amber-950 via-black to-yellow-950'} flex flex-col items-center justify-center p-8`}>
      {/* RCH TV header on grey rounded rect */}
      <div className="bg-zinc-800/70 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-3 mb-8 shadow-2xl">
        <div
          className="text-4xl sm:text-5xl uppercase tracking-[0.08em] text-amber-400 font-normal whitespace-pre text-center"
          style={{ fontFamily: "'Vortax', system-ui, sans-serif" }}
        >
          RCH  TV
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300 text-center font-light mt-1">Now Playing</div>
      </div>

      {/* Song player card - dark with accent rail like End of Night */}
      <div className="relative max-w-3xl w-full mx-auto" style={{ perspective: '800px' }}>
        <div
          className="bg-gradient-to-r from-zinc-800 via-zinc-800 to-amber-700/30 rounded-[2rem] px-10 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative overflow-hidden"
          style={{ transform: 'rotate(0.8deg)' }}
        >
          {/* Accent rail */}
          <div className="absolute left-3 top-4 bottom-4 w-2 rounded-full bg-gradient-to-b from-amber-400 to-amber-600"></div>
          {/* Inner border */}
          <div className="absolute left-7 top-5 right-5 bottom-5 rounded-2xl border border-white/10"></div>

          <div className="relative pl-10 pr-4">
            {/* Artist - hero */}
            <div
              className="text-white font-bold leading-tight"
              style={{ fontFamily: "'Orbitron', 'Audiowide', system-ui, sans-serif", fontSize: 'clamp(2rem, 5.5vw, 4.5rem)' }}
            >
              {item.artist}
            </div>
            {/* Title - only show if not "anything" */}
            {!item.anyTitle && (
              <div
                className="text-amber-300 mt-2"
                style={{ fontFamily: "'Permanent Marker', cursive", fontSize: 'clamp(1.2rem, 3vw, 2.5rem)' }}
              >
                {item.title}
              </div>
            )}
            {/* Requester chip */}
            {item.requesterName && (
              <div
                className="inline-block mt-4 bg-amber-500/20 border border-amber-500/30 rounded-full px-5 py-1.5 text-amber-300"
                style={{ fontFamily: "'Caveat', cursive", fontSize: 'clamp(1rem, 2vw, 1.8rem)' }}
              >
                Requested by {item.requesterName}
              </div>
            )}
            {/* Instagram handle at bottom-right of card */}
            {item.showHandleOnTv && item.instagramHandle && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border border-amber-500/40 rounded-full px-3 py-1">
                <InstagramIcon className="w-4 h-4 text-amber-400" />
                <span className="text-amber-200 font-bold text-xs" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {item.instagramHandle}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FameView({ item, completedFame, fameSettings, hideBackground }: { item: Extract<TVItem, { type: 'fame' }>; completedFame: Array<{ id: number; polaroidSrc: string | null; imageSrc: string | null; createdAt: string }>; fameSettings: FameSettings; hideBackground?: boolean }) {
  const imgSrc = item.polaroidSrc || `${IMAGE_PROXY_BASE}${item.id}?v=polaroid`;
  const photoSize = fameSettings.photoSize;
  const completedScale = fameSettings.completedScale / 100;
  const maxRotation = fameSettings.rotation;
  // Pixel offset per step — each successive photo on the same side
  // is pushed this many pixels further from center than the last
  const stepPx = Math.min(300, Math.max(0, fameSettings.spread));

  const rotation = ((item.id * 47) % (maxRotation * 2 + 1)) - maxRotation;

  const backgroundPhotos = completedFame.filter(photo => photo.id !== item.id);

  const completedSize = Math.round(photoSize * completedScale);

  const total = backgroundPhotos.length;
  
  const getStackPosition = (id: number, index: number) => {
    const seed = id * 7919;
    // Alternate: even goes right, odd goes left
    const side = index % 2 === 0 ? 1 : -1;
    
    // Which number on this side (0 = first right, 1 = first left, 2 = second right...)
    const sideIndex = Math.floor(index / 2);
    
    // Each photo on the same side is offset by stepPx further from center
    // photo 0 (right #0): offset = 1 * stepPx
    // photo 1 (left #0):  offset = -1 * stepPx
    // photo 2 (right #1): offset = 2 * stepPx
    // photo 3 (left #1):  offset = -2 * stepPx
    // photo 4 (right #2): offset = 3 * stepPx
    const step = (sideIndex + 1) * stepPx;
    const x = side * step;
    
    // Y: slight downward drift so they don't overlap horizontally
    const y = index * 2.5;
    
    // Small deterministic rotation based on id (not random)
    const rotate = side * (((seed % (maxRotation + 1)) + 2) % (maxRotation + 1));
    
    // Scale: slight size variation
    const scaleVariation = 0.9 + ((seed % 15) / 100);
    const scale = completedScale * scaleVariation;
    
    return { x, y, rotate, scale };
  };

  const displayShift = fameSettings.displayOffset;
  // fade: 0 = fully faded (grey/dim), 100 = full colour
  const fadeAmount = fameSettings.completedFade / 100;
  const completedFilter = `saturate(${(0.2 + fadeAmount * 0.8).toFixed(2)}) brightness(${(0.45 + fadeAmount * 0.55).toFixed(2)}) contrast(${(0.8 + fadeAmount * 0.2).toFixed(2)})`;

  return (
    <div className={`relative w-full h-full ${hideBackground ? 'bg-transparent' : 'bg-gradient-to-br from-pink-950 via-black to-rose-950'} flex items-center justify-center p-8 overflow-hidden`}>
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
            const pos = getStackPosition(photo.id, originalIndex);

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
