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
  const [shoutoutRotationState, setShoutoutRotationState] = useState<number>(5);
  const [songRotationState, setSongRotationState] = useState<number>(5);
  const [wobbleSeconds, setWobbleSeconds] = useState<number>(0);
  const [wobbling, setWobbling] = useState(false);
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
              if (s.shoutout_rotation !== undefined) setShoutoutRotationState(parseInt(s.shoutout_rotation, 10));
              if (s.song_rotation !== undefined) setSongRotationState(parseInt(s.song_rotation, 10));
              if (s.tv_card_wobble_seconds !== undefined) setWobbleSeconds(parseInt(s.tv_card_wobble_seconds, 10) || 0);
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

  // Optional timed wobble for the live shoutout bubble / song deck card.
  useEffect(() => {
    if (!currentItem || (currentItem.type !== 'shoutout' && currentItem.type !== 'song') || wobbleSeconds <= 0) {
      setWobbling(false);
      return;
    }
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const runWobble = () => {
      setWobbling(false);
      requestAnimationFrame(() => {
        setWobbling(true);
        resetTimer = setTimeout(() => setWobbling(false), 850);
      });
    };
    const interval = setInterval(runWobble, wobbleSeconds * 1000);
    return () => {
      clearInterval(interval);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [currentItem?.id, currentItem?.type, wobbleSeconds]);

  if (!currentItem) {
    // If hide idle screen is on, show nothing
    if (hideIdleScreen) {
      return <main className="w-screen h-screen bg-transparent"></main>;
    }
    return (
      <main className={`w-screen h-screen ${hideBackground ? 'bg-transparent' : 'bg-black'} flex flex-col items-center justify-center p-8`}>
        {/* RCH TV title on a tight solid grey deck card */}
        <div className="bg-zinc-800 border border-white/10 rounded-2xl px-6 py-3 mb-6 shadow-2xl">
          <div
            className="text-6xl sm:text-7xl font-normal tracking-[0.08em] text-transparent bg-clip-text bg-gradient-to-br from-purple-400 via-pink-400 to-purple-600 whitespace-pre text-center"
            style={{ fontFamily: "'Vortax', 'Orbitron', 'Audiowide', system-ui, sans-serif" }}
          >
            RCH  TV
          </div>
          <div
            className="text-center text-white/70 mt-2 tracking-[0.32em] uppercase"
            style={{ fontFamily: "'Orbitron', 'Audiowide', sans-serif", fontSize: 'clamp(0.65rem, 1vw, 0.95rem)', fontWeight: 300 }}
          >
            WAITING ON REQUESTS · SCAN QR CODE
          </div>
        </div>
        {publicQr ? (
          <div className="bg-zinc-800 border border-white/10 rounded-2xl p-3 shadow-2xl flex items-center justify-center">
            <img src={publicQr} alt="Scan to join" className="w-56 h-56 sm:w-72 sm:h-72 object-contain" />
          </div>
        ) : (
          <div className="bg-zinc-800 border border-white/10 rounded-2xl p-3 shadow-2xl w-56 h-56 sm:w-72 sm:h-72 grid place-items-center text-zinc-500">
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
        {currentItem.type === 'shoutout' && <ShoutoutView item={currentItem} hideBackground={hideBackground} rotationRange={shoutoutRotationState} wobbling={wobbling} />}
        {currentItem.type === 'song' && <SongView item={currentItem} hideBackground={hideBackground} rotationRange={songRotationState} wobbling={wobbling} />}
        {currentItem.type === 'fame' && <FameView item={currentItem} completedFame={completedFame} fameSettings={fameSettings} hideBackground={hideBackground} />}
      </div>
    </main>
  );
}

// Instagram handle sticker — matches the End of Night grayscale sticker.
// Sits at the bottom-right of its parent, half hanging over the bottom edge.
// Base size is already 75% of the original TV sticker size.
const HANDLE_FONT_SIZE = 'clamp(1.3125rem, 1.875vw, 2.4375rem)';

function HandleSticker({
  handle,
  right = '2.5rem',
  keepLevel = false,
  parentRotationDeg = 0,
}: {
  handle: string;
  right?: string | number;
  /** When true, counter-rotates against a rotated parent so the sticker stays upright */
  keepLevel?: boolean;
  parentRotationDeg?: number;
}) {
  const clean = handle.replace(/^@+/, '').trim();
  if (!clean) return null;
  const levelFix = keepLevel ? ` rotate(${-parentRotationDeg}deg)` : '';
  return (
    <div
      className="absolute bottom-0 z-30 flex items-center whitespace-nowrap rounded-full shadow-[0_14px_38px_rgba(0,0,0,0.55)]"
      style={{
        right,
        fontSize: HANDLE_FONT_SIZE,
        gap: '0.22em',
        padding: '0.18em 0.42em',
        border: '2px solid rgba(255,255,255,0.4)',
        background: 'linear-gradient(135deg, #555555 0%, #333333 50%, #1a1a1a 100%)',
        // translateY hangs half over the bottom edge. keepLevel cancels a rotated parent.
        transform: `translateY(50%)${levelFix}`,
      }}
    >
      <InstagramIcon className="text-white shrink-0" style={{ width: '1.05em', height: '1.05em' }} />
      <span
        className="font-bold leading-none text-white"
        style={{ fontFamily: "'Montserrat', sans-serif", textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
      >
        {clean}
      </span>
    </div>
  );
}

function ShoutoutView({ item, hideBackground, rotationRange, wobbling }: { item: Extract<TVItem, { type: 'shoutout' }>; hideBackground?: boolean; rotationRange: number; wobbling: boolean }) {
  // Deterministic but varied angle, distributed inside the DJ-selected ± range.
  const seeded = ((item.id * 97) % 1000) / 999;
  const rotDeg = (seeded * 2 - 1) * Math.max(0, rotationRange);
  const bubbleFill = item.id % 2 === 0 ? '#f3e8ff' : '#e9d5ff';

  return (
    <div
      className={`w-full h-full ${hideBackground ? 'bg-transparent' : ''} flex flex-col items-center justify-center p-8`}
      style={hideBackground ? undefined : { background: 'linear-gradient(135deg, #2a0845 0%, #000000 50%, #1a1a2e 100%)' }}
    >
      {/* RCH TV header on solid grey deck card */}
      <div className="bg-zinc-800 border border-white/10 rounded-2xl px-8 py-3 mb-14 shadow-2xl">
        <div
          className="text-4xl sm:text-5xl uppercase tracking-[0.08em] font-normal whitespace-pre text-center"
          style={{ fontFamily: "'Vortax', system-ui, sans-serif", color: '#c084fc' }}
        >
          RCH  TV
        </div>
        <div
          className="text-center text-purple-200 mt-1"
          style={{ fontFamily: "'Gochi Hand', cursive", fontSize: 'clamp(1rem, 1.6vw, 1.75rem)' }}
        >
          Crowd Shoutout
        </div>
      </div>

      {/* Simple speech bubble – flat purple fill, tail angled out to the LEFT */}
      <div className="relative w-full max-w-[64rem] mx-auto">
        <div
          className={`relative rounded-[2rem] px-14 py-12 shadow-[0_20px_60px_rgba(0,0,0,0.5)] ${wobbling ? 'tv-card-wobble' : ''}`}
          style={{
            background: bubbleFill,
            transform: `rotate(${rotDeg}deg)`,
            ['--tv-rest-rotation' as any]: `${rotDeg}deg`,
          } as React.CSSProperties}
        >
          <div
            className="text-center leading-tight whitespace-pre-line"
            style={{ fontFamily: "'Gochi Hand', 'Permanent Marker', cursive", fontSize: 'clamp(2rem, 5vw, 4.25rem)', color: '#2a0845' }}
          >
            &ldquo;{item.message}&rdquo;
          </div>
          {item.fromName && (
            <div
              className="text-center mt-4"
              style={{ fontFamily: "'Caveat', cursive", fontSize: 'clamp(1.5rem, 3.4vw, 3rem)', color: '#7e22ce' }}
            >
              — {item.fromName}
            </div>
          )}

          {/* Tail — on the left third of the bubble, angled outwards to the left */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: '14%', top: 'calc(100% - 3px)', width: 'clamp(4rem, 7vw, 7rem)', height: 'auto' }}
            viewBox="-10 0 62 38"
            fill="none"
            aria-hidden="true"
          >
            <polygon points="0,0 44,0 -8,36" fill={bubbleFill} />
          </svg>

          {/* Instagram handle sticker — bottom right, half over the bottom edge */}
          {item.showHandleOnTv && item.instagramHandle && (
            <HandleSticker handle={item.instagramHandle} />
          )}
        </div>
      </div>
    </div>
  );
}

// Accent palette used by the End of Night songs post
const SONG_ACCENTS = ['#1DB954', '#FF4A00', '#F7E600', '#A259FF', '#00C8F0', '#FF69B4'];

function SongView({ item, hideBackground, rotationRange, wobbling }: { item: Extract<TVItem, { type: 'song' }>; hideBackground?: boolean; rotationRange: number; wobbling: boolean }) {
  const accent = SONG_ACCENTS[item.id % SONG_ACCENTS.length];
  // Deterministic but varied angle, distributed inside the DJ-selected ± range.
  const seeded = ((item.id * 193) % 1000) / 999;
  const rotDeg = (seeded * 2 - 1) * Math.max(0, rotationRange);
  // Waveform bar heights from the End of Night template
  const waveHeights = [18, 34, 52, 38, 24];

  return (
    <div
      className={`w-full h-full ${hideBackground ? 'bg-transparent' : ''} flex flex-col items-center justify-center p-8`}
      style={
        hideBackground
          ? undefined
          : { background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f23 30%, #16213e 60%, #0a0a0a 100%)' }
      }
    >
      {/* RCH TV header on solid grey deck card — title matches deck highlight accent */}
      <div className="bg-zinc-800 border border-white/10 rounded-2xl px-8 py-3 mb-14 shadow-2xl">
        <div
          className="text-4xl sm:text-5xl uppercase tracking-[0.08em] font-normal whitespace-pre text-center"
          style={{ fontFamily: "'Vortax', system-ui, sans-serif", color: accent }}
        >
          RCH  TV
        </div>
        <div
          className="text-center text-white mt-1"
          style={{ fontFamily: "'Permanent Marker', cursive", fontSize: 'clamp(1rem, 1.6vw, 1.75rem)' }}
        >
          Now Playing
        </div>
      </div>

      {/* Song player card — End of Night template */}
      <div className="relative w-full max-w-[64rem] mx-auto">
        <div
          className={`relative rounded-[2rem] shadow-[0_22px_60px_rgba(0,0,0,0.65)] ${wobbling ? 'tv-card-wobble' : ''}`}
          style={{
            background: `linear-gradient(90deg, #111217 0%, #20212a 72%, ${accent} 100%)`,
            transform: `rotate(${rotDeg}deg)`,
            '--tv-rest-rotation': `${rotDeg}deg`,
            padding: 'clamp(1.75rem, 3vw, 3rem) clamp(1.5rem, 2.5vw, 2.5rem)',
          } as React.CSSProperties}
        >
          {/* Accent rail */}
          <div
            className="absolute rounded-full"
            style={{ background: accent, left: '0.7rem', top: '1.1rem', bottom: '1.1rem', width: '0.85rem' }}
          />
          {/* Inner border */}
          <div
            className="absolute rounded-[1.4rem] pointer-events-none"
            style={{ left: '1.9rem', right: '1.4rem', top: '1.4rem', bottom: '1.4rem', border: '2px solid rgba(255,255,255,0.16)' }}
          />

          <div className="relative flex items-center gap-8 pl-8 pr-4">
            {/* Play circle with outer ring */}
            <div
              className="shrink-0 grid place-items-center rounded-full"
              style={{ width: 'clamp(5rem, 7.4vw, 9.25rem)', height: 'clamp(5rem, 7.4vw, 9.25rem)', background: 'rgba(0,0,0,0.35)' }}
            >
              <div
                className="grid place-items-center rounded-full"
                style={{ width: '84%', height: '84%', background: accent }}
              >
                <svg viewBox="0 0 24 24" style={{ width: '46%', height: '46%' }} aria-hidden="true">
                  <polygon points="7,3 7,21 21,12" fill="#000000" />
                </svg>
              </div>
            </div>

            {/* Artist on top, title below (only when not 'anything'), requester below that */}
            <div className="min-w-0 flex-1">
              <div
                className="text-white font-bold leading-tight truncate"
                style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(2rem, 4.6vw, 4rem)' }}
              >
                {item.artist}
              </div>
              {!item.anyTitle && item.title && (
                <div
                  className="mt-2 truncate text-zinc-200"
                  style={{
                    fontFamily: "'Permanent Marker', cursive",
                    fontSize: 'clamp(1.25rem, 3vw, 2.6rem)',
                  }}
                >
                  {item.title}
                </div>
              )}
              {item.requesterName && (
                <div
                  className="mt-1 truncate"
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: 'clamp(1.1rem, 2.2vw, 2rem)',
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  requested by {item.requesterName}
                </div>
              )}
            </div>

            {/* Decorative waveform bars at the far right */}
            <div className="hidden sm:flex shrink-0 items-center" style={{ gap: 'clamp(0.3rem, 0.5vw, 0.55rem)' }}>
              {waveHeights.map((h, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 'clamp(0.35rem, 0.55vw, 0.6rem)',
                    height: `calc(${h} * clamp(0.09rem, 0.13vw, 0.16rem))`,
                    background: 'rgba(255,255,255,0.45)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Instagram handle sticker — bottom right, half over the bottom edge */}
          {item.showHandleOnTv && item.instagramHandle && (
            <HandleSticker handle={item.instagramHandle} />
          )}
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
          <div className="inline-block bg-zinc-800 border border-white/10 rounded-2xl px-8 py-4 shadow-2xl">
            <div
              className="text-4xl sm:text-5xl uppercase tracking-[0.08em] text-pink-400 font-normal whitespace-pre mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: "'Vortax', system-ui, sans-serif" }}
            >
              RCH  TV
            </div>
            <div
              className="text-5xl sm:text-6xl uppercase tracking-[0.02em] text-white font-bold drop-shadow-[0_6px_16px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: "'Westmeath', 'Montserrat', sans-serif" }}
            >
              Wall of Fame
            </div>
          </div>
        </div>

        <div className="absolute inset-0 z-20 flex items-center justify-center">
          {/* Rotating wrapper so the polaroid tilts, while the handle can stay level */}
          <div
            className="relative inline-block"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <img
              src={imgSrc}
              alt="Make me famous"
              className="object-contain shadow-[0_25px_60px_rgba(0,0,0,0.95)] rounded-md filter drop-shadow-[0_20px_35px_rgba(0,0,0,0.9)] block"
              style={{
                maxHeight: `${photoSize}vh`,
                maxWidth: `${photoSize}vw`,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `${IMAGE_PROXY_BASE}${item.id}`;
              }}
            />
            {/* Handle sticker intentionally omitted for fame — already drawn on the polaroid itself */}
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramIcon({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
