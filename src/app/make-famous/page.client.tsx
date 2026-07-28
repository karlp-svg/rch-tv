'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Camera, CheckCircle2, Clock, Loader2, XCircle, ChevronDown, AtSign, RefreshCw, SwitchCamera, X } from 'lucide-react';
import Link from 'next/link';
import { getStoredPublicSession, useRequireValidSession } from '@/lib/useSessionGuard';
import TwitchThankYouPlayer from '@/components/TwitchThankYouPlayer';

type FameSubmission = {
  id: number;
  caption: string | null;
  instagramHandle: string | null;
  showHandleOnTv?: boolean;
  status: 'verifying' | 'in_progress' | 'complete' | 'rejected';
  createdAt: string;
};

const statusConfig = {
  verifying: { label: 'Verifying', color: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30', icon: Clock },
  in_progress: { label: 'Processing', color: 'bg-blue-400/10 text-blue-400 border-blue-400/30', icon: Loader2 },
  complete: { label: 'On Screen', color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30', icon: CheckCircle2 },
  rejected: { label: 'Not Approved', color: 'bg-red-400/10 text-red-400 border-red-400/30', icon: XCircle },
};

const CAPTURE_SIZE = 1080;
const POLAROID_FRAME = 48;
const POLAROID_BOTTOM = 400;

function drawInstagramIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.lineCap = 'round';
  // rounded square
  const r = size * 0.22;
  const inset = size * 0.12;
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, r);
  ctx.stroke();
  // lens
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  // flash dot
  ctx.beginPath();
  ctx.arc(x + size * 0.71, y + size * 0.29, size * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

async function ensureFontsLoaded(): Promise<void> {
  try {
    if (typeof document !== 'undefined' && (document as any).fonts) {
      await (document as any).fonts.load('128px "Gochi Hand"');
      await (document as any).fonts.load('700 32px Montserrat');
      await (document as any).fonts.ready;
    }
  } catch {
    /* ignore */
  }
}

function makePolaroid(
  rawBase64: string,
  caption: string,
  handle: string | null,
  showHandle: boolean
): Promise<string> {
  return new Promise((resolve, reject) => {
    const run = () => {
      const img = new Image();
      img.onload = () => {
        const w = img.width + POLAROID_FRAME * 2;
        const h = img.height + POLAROID_FRAME + POLAROID_BOTTOM;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('no ctx');

        // Polaroid paper
        ctx.fillStyle = '#fffffe';
        ctx.fillRect(0, 0, w, h);

        // Photo centered
        ctx.drawImage(img, POLAROID_FRAME, POLAROID_FRAME, img.width, img.height);

        // Caption – Gochi Hand (free, commercial use via OFL)
        if (caption && caption.trim()) {
          const preservedCaption = caption.trim();
          const fontSize = 128;
          ctx.font = `400 ${fontSize}px 'Gochi Hand', 'Permanent Marker', cursive`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#111827';
          ctx.lineJoin = 'round';

          const maxWidth = img.width - 40;
          const words = preservedCaption.split(/\s+/);
          const lines: string[] = [];
          let line = '';
          for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && line) {
              lines.push(line);
              line = word;
            } else {
              line = test;
            }
          }
          if (line) lines.push(line);

          const lineHeight = fontSize * 0.82;
          const totalTextHeight = lines.length * lineHeight;
          // Vertically center caption between bottom of photo and bottom of polaroid
          const stripTop = POLAROID_FRAME + img.height;
          const stripHeight = h - stripTop;
          const baseY = stripTop + (stripHeight - totalTextHeight) / 2;
          lines.forEach((ln, i) => {
            ctx.fillText(ln, w / 2, baseY + i * lineHeight);
          });
        }

      // IG handle sticker – about half photo width, over bottom-right corner
      if (showHandle && handle) {
        const handleText = handle.replace(/^@+/, '').trim();
        const stickerText = handleText;
        const targetStickerW = img.width * 0.8; // 80% of photo width
        const gap = 12;
        const padX = 20;
        const padY = 14;

        // Fit text size so sticker lands at ~half photo width
        let stickerFontSize = 72;
        let iconSize = 64;
        let textW = 0;
        let stickerW = 0;
        let stickerH = 0;

        for (let attempt = 0; attempt < 24; attempt++) {
          iconSize = Math.max(28, Math.round(stickerFontSize * 0.9));
          ctx.font = `700 ${stickerFontSize}px 'Montserrat', sans-serif`;
          textW = ctx.measureText(stickerText).width;
          stickerW = iconSize + gap + textW + padX * 2;
          stickerH = Math.max(iconSize, stickerFontSize) + padY * 2;
          if (stickerW <= targetStickerW || stickerFontSize <= 22) break;
          stickerFontSize -= 3;
        }

        // Position at bottom-RIGHT of the photo, sitting straight (no rotation),
        // straddling the photo's bottom edge so it overlays onto the white frame.
        const photoRight = POLAROID_FRAME + img.width;
        const photoBottom = POLAROID_FRAME + img.height;
        const insetCorner = 18;
        const centerX = photoRight - stickerW / 2 - insetCorner;
        const centerY = photoBottom;

        ctx.save();
        ctx.translate(centerX, centerY);

        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;

        const grad = ctx.createLinearGradient(-stickerW / 2, -stickerH / 2, stickerW / 2, stickerH / 2);
        grad.addColorStop(0, '#feda75');
        grad.addColorStop(0.2, '#fa7e1e');
        grad.addColorStop(0.4, '#d62976');
        grad.addColorStop(0.7, '#962fbf');
        grad.addColorStop(1, '#4f5bd5');
        ctx.fillStyle = grad;

        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(-stickerW / 2, -stickerH / 2, stickerW, stickerH, 22);
        } else {
          ctx.rect(-stickerW / 2, -stickerH / 2, stickerW, stickerH);
        }
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();

        const startX = -stickerW / 2 + padX;
        const iconY = -iconSize / 2;
        drawInstagramIcon(ctx, startX, iconY, iconSize);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${stickerFontSize}px 'Montserrat', sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
        ctx.fillText(stickerText, startX + iconSize + gap, 2);

        ctx.restore();
      }

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = rawBase64;
    };
    // Kick off fonts then render
    ensureFontsLoaded().then(run).catch(() => run());
  });
}

export default function MakeFamousPage() {
  const { checking, valid } = useRequireValidSession();
  const [comment, setComment] = useState('');
  const [showHandleOnTV, setShowHandleOnTV] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [capturedRaw, setCapturedRaw] = useState<string | null>(null);
  const [polaroidPreview, setPolaroidPreview] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<FameSubmission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showThankYouTwitch, setShowThankYouTwitch] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraStarting, setCameraStarting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const polaroidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedHandle = localStorage.getItem('rch_tv_insta_handle') || '';
    setInstagramHandle(savedHandle);
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(settings => setShowThankYouTwitch(settings?.thank_you_twitch_enabled === 'true'))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild polaroid preview when comment, handle or toggle changes, keep same random rotation
  useEffect(() => {
    if (!capturedRaw) { setPolaroidPreview(null); return; }
    if (polaroidTimer.current) clearTimeout(polaroidTimer.current);
    polaroidTimer.current = setTimeout(async () => {
      try {
        const p = await makePolaroid(capturedRaw, comment.trim(), instagramHandle.trim() || null, showHandleOnTV);
        setPolaroidPreview(p);
      } catch { setPolaroidPreview(null); }
    }, 250);
  }, [capturedRaw, comment, instagramHandle, showHandleOnTV]);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('/api/fame');
      if (res.ok) setSubmissions(await res.json());
    } catch (_) {}
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const startCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    setCameraStarting(true);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
        throw new Error('Camera not supported on this device or browser');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(mode);
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      const e = err as Error;
      setCameraError(
        e.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings and try again.'
          : e.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : e.message || 'Could not access camera.'
      );
      setCameraOn(false);
    } finally {
      setCameraStarting(false);
    }
  }, [facingMode]);

  const flipCamera = () => startCamera(facingMode === 'user' ? 'environment' : 'user');

  // Fallback for environments where getUserMedia is blocked (e.g. embedded
  // iframes without camera permission). Uses the native file/camera picker and
  // centre-crops the chosen image to the same square the live capture produces.
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sqSize = Math.min(img.width, img.height);
        const sx = (img.width - sqSize) / 2;
        const sy = (img.height - sqSize) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = CAPTURE_SIZE;
        canvas.height = CAPTURE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, sx, sy, sqSize, sqSize, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
        setCapturedRaw(canvas.toDataURL('image/jpeg', 0.9));
        setCameraError(null);
        stopCamera();
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sqSize = Math.min(vw, vh);
    const sx = (vw - sqSize) / 2;
    const sy = (vh - sqSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') { ctx.translate(CAPTURE_SIZE, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, sx, sy, sqSize, sqSize, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
    setCapturedRaw(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedRaw(null);
    setPolaroidPreview(null);
    setComment('');
    setShowHandleOnTV(false);
    startCamera(facingMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedRaw) { alert('Please take a photo first'); return; }

    // Always use handle from first page (localStorage) as source of truth
    const firstPageHandle = (typeof window !== 'undefined' ? localStorage.getItem('rch_tv_insta_handle') : '')?.trim() || instagramHandle.trim() || '';
    const sessionToken = getStoredPublicSession();

    setIsSubmitting(true);
    const finalPolaroid = await makePolaroid(capturedRaw, comment.trim(), firstPageHandle || null, showHandleOnTV)
      .catch(() => null);

    try {
      const res = await fetch('/api/fame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: capturedRaw,
          polaroidBase64: finalPolaroid || null,
          caption: comment.trim() || undefined,
          instagramHandle: firstPageHandle || undefined,
          showHandleOnTV,
          sessionToken,
        }),
      });

      if (res.ok) {
        if (instagramHandle.trim()) {
          localStorage.setItem('rch_tv_insta_handle', instagramHandle.replace(/^@+/, '').trim());
        }
        setComment('');
        setCapturedRaw(null);
        setPolaroidPreview(null);
        setShowHandleOnTV(false);
        setSubmitted(true);
        fetchSubmissions();
      } else {
        alert('Upload failed. Try again.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking || !valid) {
    return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">Checking session…</main>;
  }

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-white">
      <div className="max-w-md mx-auto px-5 pt-5 pb-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white mb-4 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">📸</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter leading-none">Make Me Famous</h1>
            <p className="text-zinc-400 text-xs mt-1">Snap a pic, get on the TV</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden">
          {/* Polaroid frame */}
          <div className="bg-gradient-to-br from-zinc-100 to-stone-200 p-3 shadow-inner">
            {capturedRaw ? (
              // Show the full polaroid with caption already baked in
              <div className="relative w-full">
                <img
                  src={polaroidPreview || capturedRaw}
                  alt="Polaroid"
                  className="w-full h-auto block rounded-sm shadow-md bg-stone-100"
                />
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-black/90"
                >
                  <RefreshCw className="w-3 h-3" /> RETAKE
                </button>
              </div>
            ) : (
              <div className="relative w-full bg-black rounded-sm overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
                {cameraOn ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                    />
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-4 border-2 border-white/40 rounded-sm"></div>
                      <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-white"></div>
                      <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-white"></div>
                      <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-white"></div>
                      <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-white"></div>
                    </div>
                    <button type="button" onClick={stopCamera}
                      className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/90"
                      title="Close camera"><X className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={flipCamera}
                      className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/90"
                      title="Flip camera"><SwitchCamera className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-white gap-3 p-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-white/80" />
                    </div>
                    <div className="text-sm font-medium">Take your polaroid</div>
                    <button type="button" onClick={() => startCamera('user')} disabled={cameraStarting}
                      className="px-5 py-2 bg-white text-black rounded-full text-xs font-semibold flex items-center gap-2 disabled:opacity-60">
                      {cameraStarting ? <>OPENING <Loader2 className="w-3.5 h-3.5 animate-spin" /></> : <>OPEN CAMERA <Camera className="w-3.5 h-3.5" /></>}
                    </button>
                    {cameraError && <div className="text-[10px] text-red-400 mt-1 max-w-[240px]">{cameraError}</div>}
                    {/* Fallback file picker only visible outside production (sandbox/dev) */}
                    {process.env.NEXT_PUBLIC_PRODUCTION_MODE !== 'true' && (
                      <label className="mt-1 px-4 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full text-[11px] font-semibold cursor-pointer transition">
                        Use photo instead
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleFilePick}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

{/* Empty polaroid chin only when camera is open / not captured */}
          {!capturedRaw && (
            <div className="mt-5 text-center px-2 min-h-[3rem]"></div>
          )}
          </div>

          {/* Shutter button */}
          {cameraOn && !capturedRaw && (
            <div className="p-5 border-t border-white/10 bg-zinc-900 flex items-center justify-center">
              <button
                type="button"
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-zinc-400 shadow-[0_0_0_4px_rgba(255,255,255,0.15)] active:scale-95 transition"
                aria-label="Take photo"
              />
            </div>
          )}

          {/* Comment + handle + submit */}
          <div className="p-5 space-y-3 border-t border-white/10">
            <div>
              <label className="text-[10px] tracking-widest uppercase text-zinc-400 block mb-1.5">COMMENT (OPTIONAL)</label>
              <input type="text" value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Just hit the dancefloor!"
                className="bg-black w-full border border-white/10 rounded-2xl py-3 px-4 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-pink-500"
                maxLength={100} />
            </div>

            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <AtSign className="w-4 h-4 text-pink-400 shrink-0" />
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => {
                    setInstagramHandle(e.target.value);
                    localStorage.setItem('rch_tv_insta_handle', e.target.value.replace(/^@+/, '').trim());
                  }}
                  placeholder="your_insta_handle"
                  className="bg-transparent w-full text-pink-300 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:text-white"
                />
              </div>
              <label className="flex items-center justify-between sm:justify-start gap-2 cursor-pointer shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Add tag on TV</span>
                <div className="relative">
                  <input type="checkbox" checked={showHandleOnTV} onChange={(e) => setShowHandleOnTV(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-zinc-800 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                </div>
              </label>
            </div>

            <button type="submit" disabled={isSubmitting || !capturedRaw}
              className="mt-2 flex w-full items-center justify-center gap-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-700 disabled:text-zinc-400 text-black font-semibold py-3.5 rounded-2xl text-sm transition-colors">
              {isSubmitting ? <>UPLOADING <Loader2 className="animate-spin w-4 h-4" /></> : <>SEND TO RCH TV <Send className="w-4 h-4" /></>}
            </button>
          </div>
        </form>

        <div className="text-center mt-4 text-zinc-500 text-[10px] px-2">
          All requests are moderated — scroll to check your status below
        </div>

        {submissions.length > 0 && (
          <div className="text-center mt-2 text-zinc-600 text-[10px] flex items-center justify-center gap-1">
            RECENT PHOTOS <ChevronDown className="w-3 h-3 animate-bounce" />
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-5 pb-10">
        <div className="text-[10px] uppercase text-zinc-400 tracking-widest mb-3 mt-2">Recent Submissions</div>

        {submissions.length > 0 ? (
          <div className="space-y-2.5">
            {submissions.map((item) => {
              const config = statusConfig[item.status];
              const Icon = config.icon;
              return (
                <div key={item.id} className="flex items-center bg-zinc-900 border border-white/10 rounded-2xl p-3 gap-3.5">
                  <img
                    src={`/api/fame/image/${item.id}?v=polaroid`}
                    alt="photo"
                    className="w-14 h-14 rounded-xl object-cover bg-black border border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setFullscreenImage(`/api/fame/image/${item.id}?v=polaroid`)}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `/api/fame/image/${item.id}`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug text-white truncate">
                      {item.caption ? `"${item.caption}"` : 'Photo submission'}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-1">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border shrink-0 ${config.color}`}>
                    <Icon className={`w-3 h-3 ${item.status === 'in_progress' ? 'animate-spin' : ''}`} /> {config.label}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-zinc-900/70 border border-white/5 rounded-3xl p-6 text-center text-zinc-500 text-sm">
            No photos yet. Be the first!
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <img
            src={fullscreenImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Thank You overlay - mobile-safe */}
      {submitted && (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl my-4">
              <div className="mx-auto w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">You're on the Wall of Fame!</h3>
              <p className="text-zinc-400 text-xs mb-5 leading-relaxed">
                Your photo has been sent to the DJ for review.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-5">
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  <span className="font-semibold text-white">Show this screen to the DJ</span> to increase your chances of getting approved!
                </p>
              </div>
              {showThankYouTwitch && (
                <div className="mb-5 text-left">
                  <div className="text-[10px] uppercase tracking-widest text-pink-300 mb-2">Live from @jakarl_dj</div>
                  <TwitchThankYouPlayer />
                </div>
              )}
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="w-full py-3 bg-white text-black font-semibold rounded-2xl text-sm hover:bg-zinc-200 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
