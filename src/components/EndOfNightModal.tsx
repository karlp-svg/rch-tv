'use client';

import { useEffect, useState } from 'react';
import { Download, Trash2, Loader2, Moon, ChevronLeft, Sparkles } from 'lucide-react';

type PostType = 'songs' | 'shoutouts' | 'photos';

type SongItem = {
  id: number;
  artist: string;
  title: string | null;
  anyTitle?: boolean;
  requesterName: string | null;
  instagramHandle?: string | null;
  showHandleOnTv?: boolean;
};
type ShoutItem = {
  id: number;
  message: string;
  fromName: string | null;
  instagramHandle?: string | null;
  showHandleOnTv?: boolean;
};
type PhotoItem = {
  id: number;
  polaroidSrc?: string | null;
  imageSrc?: string | null;
  caption: string | null;
  instagramHandle?: string | null;
  showHandleOnTv?: boolean;
};

type SocialPost = { id: number; postType: string; imageSrc: string | null; createdAt: string };

const W = 1080;
const H = 1920;

const TAGLINE_POOLS: Record<PostType, string[]> = {
  songs: [
    'Thanks for keeping the dance floor moving! 🎶',
    'You picked the anthems, he dropped them! 🔥',
    'What a lineup you requested tonight! 🎵',
    'The crowd chose the soundtrack! 🙌',
    'From classics to bangers – all you! 💿',
    'Your songs made the night legendary! ✨',
    'The ultimate crowd-curated setlist! 🎧',
    'Thanks for the tunes – what a night! 🎶',
    'You requested, he played, you danced! 🕺',
    'Tonight was scored by YOU! 🎶💜',
    'Big energy, bigger requests! 🚀',
    'Keep those requests coming next time! 🎤',
    'Best. Request list. Ever. 🏆',
    'Your taste in music is unmatched! 👑',
    'The dance floor approved every single one! 💃',
    'Tonight hit every musical note perfect! 🎵💫',
    'You brought the requests, we brought the party! 🎉',
    'Next-level song choices all night long! 🔊',
  ],
  shoutouts: [
    'Thanks for all the love tonight! 💜',
    'Your shoutouts lit up the screens! ✨',
    'Big love from the RCH family! ❤️',
    'You made the screens shine tonight! 🌟',
    'Shoutouts that rocked the house! 📣',
    'Love was in the air tonight! 💜',
    'Thanks for spreading the love! 💖',
    'Your words made the night! 🎤',
    'From birthdays to proposals – we saw it all! 🎉',
    'The crowd had a lot to say tonight! 😍',
    'Messages from the heart to the big screen! 💌',
    'You wrote it, we showed it! 🙏',
    'Every single shoutout hit home! 💕',
    'What a talkative, lovely crowd! 😘',
    'Your shoutouts deserve their own encore! 🎊',
    'You hype for each other so well! 👏',
    'The kindest words tonight were yours! 🫶',
  ],
  photos: [
    'Looking good legends! Thanks for getting involved 📸',
    'What a good-looking crowd! 😍📸',
    'The Wall of Fame was on fire tonight! 🔥',
    'Smiles, selfies & good times! 📸✨',
    'You brought the vibes, we caught the moments! 📸',
    'Thanks for getting your photo on the wall! 🙌',
    'Legends only on the Wall of Fame! 🌟',
    'Cheers to a night of epic faces! 📸',
    'From selfies to group shots – love it! ❤️',
    'Until next time – keep smiling! 😎',
    'Fame looks good on you! ✨📸',
    'Wall of Fame = Hall of Legends! 🏆',
    'Camera loves a crowd like this! 💖',
    'The best part of the night? You! 📸🔥',
    'Every photo is pure gold tonight! 💯',
    'Beauty, glam and pure energy! 💫🎉',
    'Your faces deserve their own hall of fame! 👑',
    'One click, countless favourites! 📸✨',
  ],
};

const DEFAULT_TAGLINES: Record<PostType, string> = {
  songs: TAGLINE_POOLS.songs[0],
  shoutouts: TAGLINE_POOLS.shoutouts[0],
  photos: TAGLINE_POOLS.photos[0],
};

const MAX_SELECT: Record<PostType, number> = { songs: 8, shoutouts: 6, photos: 6 };

async function ensureFonts() {
  try {
    const d = document as any;
    if (!d.fonts) return;
    await Promise.all([
      d.fonts.load("400 110px 'Vortax'"),
      d.fonts.load("400 60px 'Permanent Marker'"),
      d.fonts.load("400 60px 'Gochi Hand'"),
      d.fonts.load("400 70px 'Westmeath'"),
      d.fonts.load("400 55px 'Caveat'"),
      d.fonts.load("700 40px 'Montserrat'"),
      d.fonts.load("400 30px 'Montserrat'"),
    ]);
    await d.fonts.ready;
  } catch {}
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if ((ctx as any).roundRect) {
    ctx.beginPath();
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
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
  return lines;
}

function drawHeader(ctx: CanvasRenderingContext2D, accent: string, subtitle: string, subtitleFont: string) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = accent;
  ctx.font = "400 110px 'Vortax', sans-serif";
  ctx.fillText('RCH  TV', W / 2, 85);
  ctx.fillStyle = '#ffffff';
  ctx.font = subtitleFont;
  ctx.fillText(subtitle, W / 2, 230);
}

function drawFooter(ctx: CanvasRenderingContext2D, tagline: string) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e4e4e7';
  ctx.font = "400 54px 'Caveat', cursive";
  const lines = wrapLines(ctx, tagline, W - 140);
  let y = H - 165 - (lines.length - 1) * 58;
  for (const ln of lines) {
    ctx.fillText(ln, W / 2, y);
    y += 58;
  }
}

function bgGradient(ctx: CanvasRenderingContext2D, from: string, mid: string, to: string) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, from);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // subtle vignette
  const rg = ctx.createRadialGradient(W/2, H/2, 300, W/2, H/2, 1200);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = rg;
  ctx.fillRect(0,0,W,H);
}

function drawInstagramIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const r = size * 0.22;
  const inset = size * 0.12;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.beginPath();
  (ctx as any).roundRect ? (ctx as any).roundRect(x+inset*0.3, y+inset*0.3, size-inset*0.6, size-inset*0.6, r) : ctx.rect(x,y,size,size);
  ctx.stroke();
  const cx = x + size/2;
  const cy = y + size/2;
  ctx.beginPath();
  ctx.arc(cx, cy, size*0.22, 0, Math.PI*2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x+size*0.72, y+size*0.28, size*0.06, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawHandleSticker(ctx: CanvasRenderingContext2D, cx: number, cy: number, handle: string, fontSize = 26, rotationDeg = 0) {
  const clean = handle.replace(/^@+/, '').trim();
  if (!clean) return;
  const text = clean; // no @ per latest spec
  const iconSize = Math.round(fontSize * 1.15);
  const gap = 10;
  const padX = 16;
  const padY = 10;
  ctx.font = `700 ${fontSize}px 'Montserrat', sans-serif`;
  const textW = ctx.measureText(text).width;
  const stickerW = iconSize + gap + textW + padX * 2;
  const stickerH = Math.max(iconSize, fontSize) + padY * 2;

  // Grayscale sticker (no rainbow accent), can rotate to match bubble rotation
  ctx.save();
  ctx.translate(cx, cy);
  if (rotationDeg !== 0) ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  const grad = ctx.createLinearGradient(-stickerW/2, -stickerH/2, stickerW/2, stickerH/2);
  grad.addColorStop(0, '#555555');
  grad.addColorStop(0.5, '#333333');
  grad.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  if ((ctx as any).roundRect) {
    (ctx as any).roundRect(-stickerW/2, -stickerH/2, stickerW, stickerH, 22);
  } else {
    ctx.rect(-stickerW/2, -stickerH/2, stickerW, stickerH);
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.stroke();

  const iconX = -stickerW/2 + padX;
  const iconY = -iconSize/2;
  drawInstagramIcon(ctx, iconX, iconY, iconSize);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px 'Montserrat', sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillText(text, iconX + iconSize + gap, 2);

  ctx.restore();
}

function generateSongsPost(items: SongItem[], tagline: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Rich cohesive dark gradient with warmth
  const songGrad = ctx.createLinearGradient(0, 0, W, H);
  songGrad.addColorStop(0, '#1a1a2e');
  songGrad.addColorStop(0.3, '#0f0f23');
  songGrad.addColorStop(0.6, '#16213e');
  songGrad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = songGrad;
  ctx.fillRect(0, 0, W, H);
  // subtle edge glow
  const glow = ctx.createLinearGradient(0, 0, W, 0);
  glow.addColorStop(0, 'rgba(29,185,84,0.08)');
  glow.addColorStop(0.5, 'rgba(0,0,0,0)');
  glow.addColorStop(1, 'rgba(162,89,255,0.08)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawHeader(ctx, '#1DB954', "Tonight's Song Requests", "400 58px 'Permanent Marker', cursive");

  const areaTop = 350;
  const areaBottom = H - 250;
  const slot = (areaBottom - areaTop) / Math.max(items.length, 1);

  items.forEach((item, i) => {
    const artistText = item.artist.trim();
    const titleText = item.anyTitle ? 'Anything!' : (item.title || '').trim();

    // Measure text widths for dynamic bubble sizing
    ctx.font = "700 44px 'Montserrat', sans-serif";
    const artistW = ctx.measureText(artistText).width;
    ctx.font = "400 36px 'Montserrat', sans-serif";
    const titleW = ctx.measureText(titleText).width;
    const textMax = Math.max(artistW, titleW);

    const minBubbleW = 440;
    // Leave room for an external requester chip when a name is available.
    const maxBubbleW = item.requesterName ? 740 : 940;
    const bubbleW = Math.min(maxBubbleW, Math.max(minBubbleW, textMax + 230));
    const bubbleH = 148;

    // Vary accent colors per bubble
    const accentColors = ['#1DB954', '#FF4A00', '#F7E600', '#A259FF', '#00C8F0', '#FF69B4'];
    const accent = accentColors[i % accentColors.length];

    // Leave visual space on the right when the requester chip is present.
    const jitter = (i % 2 === 0 ? -1 : 1) * (16 + (i * 7) % 22);
    const cx = W / 2 - (item.requesterName ? 72 : 0) + jitter;
    const cy = areaTop + slot * i + slot / 2;
    // Stronger varied rotation: 4° to 10° alternating sign.
    const rotSign = i % 2 === 0 ? -1 : 1;
    const rotDeg = (4 + (i % 7)) * rotSign;
    const rot = rotDeg * (Math.PI / 180);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 11;

    // Dark player card with an accent-tinted gradient.
    const cardGrad = ctx.createLinearGradient(-bubbleW / 2, 0, bubbleW / 2, 0);
    cardGrad.addColorStop(0, '#111217');
    cardGrad.addColorStop(0.72, '#20212a');
    cardGrad.addColorStop(1, accent);
    ctx.fillStyle = cardGrad;
    roundRect(ctx, -bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 30);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Accent rail and inner border.
    ctx.fillStyle = accent;
    roundRect(ctx, -bubbleW / 2 + 5, -bubbleH / 2 + 10, 10, bubbleH - 20, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    roundRect(ctx, -bubbleW / 2 + 16, -bubbleH / 2 + 14, bubbleW - 32, bubbleH - 28, 22);
    ctx.stroke();

    // Decorative waveform bars at the far right.
    const waveX = bubbleW / 2 - 76;
    const waveHeights = [18, 34, 52, 38, 24];
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    waveHeights.forEach((barH, barIndex) => {
      roundRect(ctx, waveX + barIndex * 11, -barH / 2, 6, barH, 3);
      ctx.fill();
    });

    // Colored play circle with a second ring.
    const playX = -bubbleW / 2 + 62;
    ctx.beginPath();
    ctx.arc(playX, 0, 37, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(playX, 0, 31, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    // play triangle
    ctx.beginPath();
    ctx.moveTo(playX - 8, -12);
    ctx.lineTo(playX - 8, 12);
    ctx.lineTo(playX + 13, 0);
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Text block between play button and waveform.
    const textX = -bubbleW / 2 + 118;
    const textAvailableW = bubbleW - 220;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // FLIPPED positions: Artist on top (large Montserrat bold), Title below (Permanent Marker / cursive styling)
    ctx.font = "700 42px 'Montserrat', sans-serif";
    ctx.fillStyle = '#ffffff';
    let artistOnly = artistText;
    while (ctx.measureText(artistOnly).width > textAvailableW && artistOnly.length > 10) {
      artistOnly = artistOnly.slice(0, -2) + '…';
    }
    ctx.fillText(artistOnly, textX, -16);

    if (item.anyTitle) {
      ctx.font = "400 32px 'Permanent Marker', cursive";
      ctx.fillStyle = accent; // themed color for anything goes!
      ctx.fillText('Anything', textX, 24);
    } else {
      ctx.font = "400 32px 'Permanent Marker', cursive";
      ctx.fillStyle = '#e4e4e7';
      let tTitle = titleText;
      while (ctx.measureText(tTitle).width > textAvailableW && tTitle.length > 10) {
        tTitle = tTitle.slice(0, -2) + '…';
      }
      ctx.fillText(tTitle, textX, 24);
    }

    ctx.restore();

    // Stack requester name and Instagram handle beneath the bubble, aligned left.
    const metaLeft = -bubbleW / 2 + 18;
    const metaTop = bubbleH / 2 + 8;

    if (item.requesterName) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.font = "400 24px 'Caveat', cursive";
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`requested by ${item.requesterName}`, metaLeft, metaTop);
      ctx.restore();
    }

    if (item.showHandleOnTv && item.instagramHandle) {
      const cleanHandle = item.instagramHandle.replace(/^@+/, '').trim();
      const stickerFontSize = 18;
      const iconSize = Math.round(stickerFontSize * 1.15);
      const stickerGap = 10;
      const stickerPadX = 16;
      const stickerPadY = 10;
      ctx.font = `700 ${stickerFontSize}px 'Montserrat', sans-serif`;
      const stickerTextW = ctx.measureText(cleanHandle).width;
      const stickerW = iconSize + stickerGap + stickerTextW + stickerPadX * 2;
      const stickerH = Math.max(iconSize, stickerFontSize) + stickerPadY * 2;

      // If requester exists, place handle directly below it; otherwise start at first metadata row.
      const localStickerX = metaLeft + stickerW / 2;
      const localStickerY = metaTop + (item.requesterName ? 32 : 0) + stickerH / 2;
      const stickerRadX = cx + localStickerX * Math.cos(rot) - localStickerY * Math.sin(rot);
      const stickerRadY = cy + localStickerX * Math.sin(rot) + localStickerY * Math.cos(rot);
      drawHandleSticker(ctx, stickerRadX, stickerRadY, cleanHandle, stickerFontSize, rotDeg);
    }
  });

  drawFooter(ctx, tagline);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function generateShoutoutsPost(items: ShoutItem[], tagline: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  bgGradient(ctx, '#2a0845', '#000000', '#1a1a2e');

  drawHeader(ctx, '#c084fc', "Tonight's Shoutouts", "400 60px 'Gochi Hand', cursive");

  const areaTop = 360;
  const areaBottom = H - 260;
  const slot = (areaBottom - areaTop) / Math.max(items.length, 1);

  items.forEach((item, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    
    // Scale text and size dynamically based on item count to utilize vertical space perfectly
    const numItems = items.length;
    const shoutFontSize = numItems <= 3 ? 54 : numItems <= 4 ? 48 : 42;
    const lineH = numItems <= 3 ? 64 : numItems <= 4 ? 56 : 50;
    const fromFontSize = numItems <= 3 ? 42 : numItems <= 4 ? 38 : 34;
    const padVertical = numItems <= 3 ? 72 : numItems <= 4 ? 64 : 56;

    // dynamic width calculation
    ctx.font = `400 ${shoutFontSize}px 'Gochi Hand', cursive`;
    const maxContentW = numItems <= 3 ? 680 : 620;
    const lines = wrapLines(ctx, `"${item.message}"`, maxContentW).slice(0, 3);
    let maxLineW = 0;
    for (const ln of lines) {
      const w = ctx.measureText(ln).width;
      if (w > maxLineW) maxLineW = w;
    }
    if (item.fromName) {
      ctx.font = `400 ${fromFontSize}px 'Caveat', cursive`;
      const fw = ctx.measureText(`— ${item.fromName}`).width;
      if (fw > maxLineW) maxLineW = fw;
    }
    const bubbleW = Math.min(900, Math.max(340, maxLineW + 110));
    const fromH = item.fromName ? (fromFontSize + 8) : 0;
    const bubbleH = lines.length * lineH + fromH + padVertical;

    const cx = W/2 + side * (35 + (i * 13) % 50);
    const cy = areaTop + slot * i + slot/2;
    const rotDeg = side * (1.5 + (i % 3) * 0.6);
    const rot = rotDeg * (Math.PI / 180);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // speech bubble
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = i % 2 === 0 ? '#f3e8ff' : '#e9d5ff';
    roundRect(ctx, -bubbleW/2, -bubbleH/2, bubbleW, bubbleH, 32);
    ctx.fill();
    // tail — always on LEFT side of centre so sticker doesn't cover it
    ctx.beginPath();
    const tailX = -bubbleW/3;
    ctx.moveTo(tailX - 22, bubbleH/2 - 2);
    ctx.lineTo(tailX + 22, bubbleH/2 - 2);
    ctx.lineTo(tailX - 28, bubbleH/2 + 32);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#2a0845';
    ctx.font = `400 ${shoutFontSize}px 'Gochi Hand', cursive`;
    let ty = -bubbleH/2 + (padVertical / 2);
    for (const ln of lines) {
      ctx.fillText(ln, 0, ty);
      ty += lineH;
    }
    if (item.fromName) {
      ctx.font = `400 ${fromFontSize}px 'Caveat', cursive`;
      ctx.fillStyle = '#7e22ce';
      ctx.fillText(`— ${item.fromName}`, 0, ty + 2);
    }
    ctx.restore();

    // Instagram sticker — bottom-right, matches bubble rotation and grayscale
    if (item.showHandleOnTv && item.instagramHandle) {
      const sx = cx + bubbleW/2 - 20;
      const sy = cy + bubbleH/2 + 6;
      drawHandleSticker(ctx, sx, sy, item.instagramHandle, 22, rotDeg);
    }
  });

  drawFooter(ctx, tagline);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function generatePhotosPost(items: PhotoItem[], tagline: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  bgGradient(ctx, '#500724', '#000000', '#4c0519');

  drawHeader(ctx, '#f472b6', 'Wall of Fame', "400 76px 'Westmeath', sans-serif");

  const imgs: HTMLImageElement[] = [];
  for (const item of items) {
    const src = item.polaroidSrc || item.imageSrc || `/api/fame/image/${item.id}?v=polaroid`;
    try {
      imgs.push(await loadImg(src));
    } catch {
      try {
        imgs.push(await loadImg(`/api/fame/image/${item.id}?v=polaroid`));
      } catch { /* skip */ }
    }
  }

  // Safe 2-column grid: roomy enough to scatter, constrained inside the 9:16 frame.
  const cols = 2;
  const rows = Math.ceil(imgs.length / cols);
  const areaTop = 400;
  const areaBottom = H - 300; // keep clear of the bottom tagline
  const cellH = (areaBottom - areaTop) / Math.max(rows, 1);
  const cellW = W / cols;
  const maxPhotoW = cellW * 0.78;
  const maxPhotoH = cellH * 0.86;
  const canvasMargin = 38;
  const verticalMargin = 16;

  const isOdd = imgs.length % 2 !== 0;
  const lastIndex = imgs.length - 1;

  imgs.forEach((img, i) => {
    const isLastOdd = isOdd && i === lastIndex;
    const col = isLastOdd ? 0 : i % cols; // last odd photo gets col 0 but centred
    const row = Math.floor(i / cols);
    const baseX = isLastOdd ? W / 2 : cellW * col + cellW / 2;
    // Small inward jitter so larger rotated corners never leave the canvas.
    const inward = isLastOdd ? 0 : (col === 0 ? 14 : -14);
    const jitterX = ((i * 47) % 36 - 18) + inward;
    const jitterY = ((i * 89) % 44 - 22);
    const rawCx = baseX + jitterX;
    const rawCy = areaTop + cellH * row + cellH / 2 + jitterY;
    // Scattered but safe rotation: -20° to +20°.
    const rot = ((i * 73) % 41 - 20) * (Math.PI / 180);

    const scale = Math.min(maxPhotoW / img.width, maxPhotoH / img.height) * (0.88 + (i % 4) * 0.04);
    const dw = img.width * scale;
    const dh = img.height * scale;

    // Rotated bounding box; clamp its centre to safe canvas/title/footer bounds.
    const cos = Math.abs(Math.cos(rot));
    const sin = Math.abs(Math.sin(rot));
    const rotatedW = dw * cos + dh * sin;
    const rotatedH = dw * sin + dh * cos;
    const cx = Math.max(canvasMargin + rotatedW / 2, Math.min(W - canvasMargin - rotatedW / 2, rawCx));
    const cy = Math.max(areaTop + verticalMargin + rotatedH / 2, Math.min(areaBottom - verticalMargin - rotatedH / 2, rawCy));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    // No additional Instagram sticker on Wall of Fame posts.
  });

  drawFooter(ctx, tagline);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function EndOfNightModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'gallery' | 'pick-type' | 'select'>('gallery');
  const [postType, setPostType] = useState<PostType>('shoutouts');
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [shouts, setShouts] = useState<ShoutItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tagline, setTagline] = useState('');
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('gallery');
      fetchPosts();
      fetchItems();
    }
  }, [open]);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/social-posts', { cache: 'no-store' });
      if (res.ok) setPosts(await res.json());
    } catch {}
  };

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/admin', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        // End of Night should only show finished (Complete) items
        setSongs((d.songRequests || []).filter((s: any) => s.status === 'complete'));
        setShouts((d.shoutouts || []).filter((s: any) => s.status === 'complete'));
        setPhotos((d.fameSubmissions || []).filter((p: any) => p.status === 'complete'));
      }
    } catch {}
  };

  const startSelect = (type: PostType) => {
    setPostType(type);
    setSelected(new Set());
    setTagline(TAGLINE_POOLS[type][0]);
    setError(null);
    setStep('select');
  };

  const generateRandomTagline = () => {
    const pool = TAGLINE_POOLS[postType];
    const current = tagline.trim();
    let candidates = pool.filter(t => t !== current);
    if (candidates.length === 0) candidates = pool;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setTagline(pick);
  };

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT[postType]) {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    setError(null);
    try {
      await ensureFonts();
      let dataUrl = '';
      if (postType === 'songs') {
        const items = songs.filter(s => selected.has(s.id));
        dataUrl = generateSongsPost(items, tagline);
      } else if (postType === 'shoutouts') {
        const items = shouts.filter(s => selected.has(s.id));
        dataUrl = generateShoutoutsPost(items, tagline);
      } else {
        const items = photos.filter(p => selected.has(p.id));
        dataUrl = await generatePhotosPost(items, tagline);
      }

      const res = await fetch('/api/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postType, imageBase64: dataUrl }),
      });
      if (!res.ok) throw new Error('save failed');

      await fetchPosts();
      setStep('gallery');
    } catch (e) {
      setError('Failed to generate. If using photos, some images may not have loaded.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPost = async (post: SocialPost) => {
    if (!post.imageSrc) return;
    const date = new Date(post.createdAt).toISOString().slice(0, 10);
    const filename = `rch-tv-${post.postType}-${date}-${post.id}.jpg`;
    if (post.imageSrc.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = post.imageSrc;
      a.download = filename;
      a.click();
    } else {
      try {
        const res = await fetch(post.imageSrc);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        window.open(post.imageSrc, '_blank');
      }
    }
  };

  const deletePost = async (id: number) => {
    if (!confirm('Delete this post?')) return;
    await fetch('/api/social-posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchPosts();
  };

  if (!open) return null;

  const typeLabel: Record<PostType, string> = { songs: 'Song Requests', shoutouts: 'Shoutouts', photos: 'Wall of Fame Photos' };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-400" /> End of Night Posts
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm font-bold px-2 py-1">✕</button>
        </div>

        {step === 'gallery' && (
          <>
            <div className="text-[10px] uppercase text-zinc-500 font-mono mb-2">Selection only includes items with <span className="text-emerald-400 font-semibold">Complete</span> status.</div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <button onClick={() => startSelect('shoutouts')} className="p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-2xl text-center transition">
                <div className="text-2xl mb-1">📺</div>
                <div className="text-xs font-semibold text-purple-300">Shoutouts</div>
              </button>
              <button onClick={() => startSelect('songs')} className="p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-center transition">
                <div className="text-2xl mb-1">🎵</div>
                <div className="text-xs font-semibold text-amber-300">Song Requests</div>
              </button>
              <button onClick={() => startSelect('photos')} className="p-4 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-2xl text-center transition">
                <div className="text-2xl mb-1">📸</div>
                <div className="text-xs font-semibold text-pink-300">Wall of Fame</div>
              </button>
            </div>

            <div className="text-[10px] uppercase text-zinc-400 font-mono mb-3">Generated Posts ({posts.length})</div>
            {posts.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl text-zinc-500 text-sm">
                No posts yet. Pick a type above to create one.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {posts.map(post => (
                  <div key={post.id} className="bg-black border border-white/10 rounded-xl overflow-hidden">
                    {post.imageSrc && (
                      <img src={post.imageSrc} alt={post.postType} className="w-full aspect-[9/16] object-cover" />
                    )}
                    <div className="p-2 flex items-center justify-between">
                      <span className="text-[9px] uppercase text-zinc-400 font-mono">{post.postType}</span>
                      <div className="flex gap-1">
                        <button onClick={() => downloadPost(post)} className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg" title="Download">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deletePost(post.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'select' && (
          <>
            <button onClick={() => setStep('gallery')} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white mb-3">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="text-sm font-semibold mb-1">Select {typeLabel[postType]}</div>
            <div className="text-[10px] text-zinc-500 mb-3">Pick up to {MAX_SELECT[postType]} — selected: {selected.size}</div>

            <div className="space-y-2 max-h-[38vh] overflow-y-auto mb-4 pr-1">
              {(postType === 'songs' ? songs : postType === 'shoutouts' ? shouts : photos).length === 0 && (
                <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl text-zinc-500 text-xs">
                  No {typeLabel[postType].toLowerCase()} marked Complete yet.
                </div>
              )}
              {postType === 'songs' && songs.map(s => (
                <button key={s.id} onClick={() => toggleItem(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition ${selected.has(s.id) ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-black border-white/10 text-zinc-400 hover:border-white/30'}`}>
                  <span className="font-semibold">{s.anyTitle ? 'Anything' : s.title}</span>
                  <span className="text-amber-400"> — {s.artist}</span>
                  {s.requesterName && <span className="text-zinc-500"> (by {s.requesterName})</span>}
                  {s.showHandleOnTv && s.instagramHandle && <span className="ml-2 text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded-full">@{s.instagramHandle}</span>}
                </button>
              ))}
              {postType === 'shoutouts' && shouts.map(s => (
                <button key={s.id} onClick={() => toggleItem(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition ${selected.has(s.id) ? 'bg-purple-500/20 border-purple-500/50 text-white' : 'bg-black border-white/10 text-zinc-400 hover:border-white/30'}`}>
                  <span>"{s.message.slice(0, 70)}{s.message.length > 70 ? '…' : ''}"</span>
                  {s.fromName && <span className="text-purple-400"> — {s.fromName}</span>}
                  {s.showHandleOnTv && s.instagramHandle && <span className="ml-2 text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded-full">@{s.instagramHandle}</span>}
                </button>
              ))}
              {postType === 'photos' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {photos.map(p => {
                    // Always request the composed polaroid so its caption/text is visible.
                    const src = p.polaroidSrc || `/api/fame/image/${p.id}?v=polaroid`;
                    return (
                      <button key={p.id} onClick={() => toggleItem(p.id)}
                        className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 bg-black transition ${selected.has(p.id) ? 'border-pink-500' : 'border-white/10 hover:border-white/30'}`}>
                        <img
                          src={src}
                          alt="Full polaroid preview"
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = p.imageSrc || `/api/fame/image/${p.id}`;
                          }}
                        />
                        {selected.has(p.id) && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Bottom Tagline</label>
                <button onClick={generateRandomTagline} className="flex items-center gap-1 text-[10px] bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-full transition">
                  <Sparkles className="w-3 h-3" /> New Tagline
                </button>
              </div>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                maxLength={90}
              />
            </div>

            {error && <div className="p-3 rounded-xl text-xs mb-3 bg-red-500/10 text-red-300 border border-red-500/20">{error}</div>}

            <button
              onClick={handleGenerate}
              disabled={generating || selected.size === 0}
              className="w-full py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : `Generate 9:16 Post (${selected.size} selected)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
