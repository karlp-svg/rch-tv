import { db } from '@/db';
import { shoutouts, songRequests, fameSubmissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type PostType = 'songs' | 'shoutouts' | 'photos';

type ChosenItems = {
  shoutIds?: number[];
  songIds?: number[];
  photoIds?: number[];
};

/**
 * Generates a catchy, humorous end-of-night caption that ties in shoutouts,
 * song requests and photos from tonight.
 *
 * Provider priority (first key found wins, auto-fallback on error):
 *   1. Gemini  (GEMINI_API_KEY)   — free, no card required
 *   2. Groq    (GROQ_API_KEY)     — free, no card required
 *   3. OpenAI  (OPENAI_API_KEY)   — paid ($0.00003 per caption with gpt-4o-mini)
 *   4. Anthropic (ANTHROPIC_API_KEY) — paid
 *
 * Returns { caption, provider } on success, or a graceful 200 with { caption: null,
 * error: '...' } when no key is configured.
 */

// ─── Context builder ───────────────────────────────────────────────

async function buildContext(postType: PostType, chosen: ChosenItems) {
  const [completedShouts, completedSongs, completedPhotos] = await Promise.all([
    db.select().from(shoutouts).where(eq(shoutouts.status, 'complete')).orderBy(desc(shoutouts.createdAt)).limit(40),
    db.select().from(songRequests).where(eq(songRequests.status, 'complete')).orderBy(desc(songRequests.createdAt)).limit(40),
    db.select({
      id: fameSubmissions.id,
      caption: fameSubmissions.caption,
      name: fameSubmissions.name,
      instagramHandle: fameSubmissions.instagramHandle,
    }).from(fameSubmissions).where(eq(fameSubmissions.status, 'complete')).orderBy(desc(fameSubmissions.createdAt)).limit(40),
  ]);

  const filterOrAll = <T extends { id: number }>(rows: T[], ids?: number[]) =>
    ids && ids.length > 0 ? rows.filter(r => ids.includes(r.id)) : rows;

  const chosenShouts = filterOrAll(completedShouts, chosen.shoutIds).slice(0, 12);
  const chosenSongs = filterOrAll(completedSongs, chosen.songIds).slice(0, 12);
  const chosenPhotos = filterOrAll(completedPhotos as any, chosen.photoIds).slice(0, 12);

  return {
    postType,
    shouts: chosenShouts.map(s => ({ message: s.message, from: s.fromName })),
    songs: chosenSongs.map(s => ({ artist: s.artist, title: s.title, anyTitle: !!s.anyTitle, by: s.requesterName })),
    photos: chosenPhotos.map((p: any) => ({ caption: p.caption, name: p.name })),
  };
}

// ─── Prompt ─────────────────────────────────────────────────────────

function buildPrompt(ctx: Awaited<ReturnType<typeof buildContext>>) {
  const focus = ctx.postType === 'photos' ? 'Wall of Fame photos' : ctx.postType === 'songs' ? 'song requests' : 'shoutouts';

  const shoutsBlock = ctx.shouts.length
    ? ctx.shouts.map(s => `- "${s.message}"${s.from ? ` — ${s.from}` : ''}`).join('\n')
    : '(none tonight)';
  const songsBlock = ctx.songs.length
    ? ctx.songs.map(s => `- ${s.anyTitle ? `Anything by ${s.artist}` : `${s.title || 'Untitled'} — ${s.artist}`}${s.by ? ` (by ${s.by})` : ''}`).join('\n')
    : '(none tonight)';
  const photosBlock = ctx.photos.length
    ? ctx.photos.map(p => `- ${p.caption || p.name || 'Wall of Fame photo'}`).join('\n')
    : '(none tonight)';

  return `You write short, punchy, funny social media captions for a live DJ show called RCH TV run by @jakarl_dj.

You are writing the bottom-of-post caption for a "${focus}" end-of-night highlight card that will be posted to Instagram Stories.

Vibe: warm, in-jokey, party crowd, cheeky but never mean. It's meant to feel like the DJ recapping the night to their friends.

Tonight's crowd shoutouts (from the screens):
${shoutsBlock}

Tonight's song requests:
${songsBlock}

Tonight's Wall of Fame photo captions/names:
${photosBlock}

Rules:
- One sentence. Absolute max 90 characters. Ideally 40–70.
- Playful, human, first-person from the DJ or the crowd's point of view is fine.
- Where possible, tie the caption to a specific detail from the shoutouts/songs/photos above (e.g. a birthday name, a song mentioned, a group name) — but do NOT quote a whole shoutout. Just riff on it.
- 1 emoji max (or none). No hashtags. No @mentions.
- No quotes around the output. Return ONLY the caption text, nothing else.`;
}

const SYSTEM_MSG = 'You are a witty short-form copywriter. Output the caption text only.';

// ─── Provider callers ───────────────────────────────────────────────

// Gemini model fallback chain — kept current as of mid-2026.
// gemini-1.5-flash and gemini-2.0-flash are deprecated (shut down April 2025).
// gemini-2.5-flash-lite is the cheapest current model; gemini-2.5-flash is
// the best price-performance option. Both work on the free tier.
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

async function callGeminiModel(prompt: string, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_MSG}\n\n${prompt}` }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 100 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini/${model} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.toString().trim() || '';
  return text.replace(/^["'""'']+|["'""'']+$/g, '').trim();
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  // If user explicitly set a model, only try that one
  const explicit = process.env.GEMINI_MODEL;
  if (explicit) return callGeminiModel(prompt, apiKey, explicit);

  // Otherwise try models in order, falling back on any retryable error
  let lastErr: Error | null = null;
  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiModel(prompt, apiKey, model);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      console.error(`Gemini model ${model} failed:`, msg.slice(0, 200));
      lastErr = e;
      // Always continue to the next model on:
      //  - 404 (model not found / deprecated)
      //  - 429 (rate-limited / quota exhausted)
      //  - 503 (temporarily unavailable)
      // Only stop on auth/permission errors (401, 403) — those
      // will never succeed with a different model either.
      if (/40[13]/.test(msg)) throw e;
      continue;
    }
  }
  throw lastErr || new Error('All Gemini models exhausted');
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      max_tokens: 80,
      messages: [
        { role: 'system', content: SYSTEM_MSG },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.toString().trim() || '';
  return text.replace(/^["'""'']+|["'""'']+$/g, '').trim();
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      max_tokens: 80,
      messages: [
        { role: 'system', content: SYSTEM_MSG },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.toString().trim() || '';
  return text.replace(/^["'""'']+|["'""'']+$/g, '').trim();
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      temperature: 0.9,
      system: SYSTEM_MSG,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data?.content?.[0]?.text ?? '').toString().trim();
  return text.replace(/^["'""'']+|["'""'']+$/g, '').trim();
}

// ─── Provider chain ─────────────────────────────────────────────────

type ProviderName = 'gemini' | 'groq' | 'openai' | 'anthropic';

interface ProviderConfig {
  name: ProviderName;
  key: string;
  call: (prompt: string, key: string) => Promise<string>;
}

function getProviderChain(): ProviderConfig[] {
  const chain: ProviderConfig[] = [];
  const g = process.env.GEMINI_API_KEY;
  const q = process.env.GROQ_API_KEY;
  const o = process.env.OPENAI_API_KEY;
  const a = process.env.ANTHROPIC_API_KEY;
  if (g) chain.push({ name: 'gemini', key: g, call: callGemini });
  if (q) chain.push({ name: 'groq', key: q, call: callGroq });
  if (o) chain.push({ name: 'openai', key: o, call: callOpenAI });
  if (a) chain.push({ name: 'anthropic', key: a, call: callAnthropic });
  return chain;
}

// ─── Route handler ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const postType: PostType = (body?.postType as PostType) || 'photos';
    if (postType !== 'songs' && postType !== 'shoutouts' && postType !== 'photos') {
      return NextResponse.json({ error: 'invalid postType' }, { status: 400 });
    }

    const chain = getProviderChain();
    if (chain.length === 0) {
      return NextResponse.json({
        caption: null,
        provider: null,
        error: 'No AI key configured. Set GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in your Vercel env vars.',
      });
    }

    const ctx = await buildContext(postType, {
      shoutIds: Array.isArray(body?.shoutIds) ? body.shoutIds.map((n: any) => Number(n)).filter(Number.isFinite) : undefined,
      songIds: Array.isArray(body?.songIds) ? body.songIds.map((n: any) => Number(n)).filter(Number.isFinite) : undefined,
      photoIds: Array.isArray(body?.photoIds) ? body.photoIds.map((n: any) => Number(n)).filter(Number.isFinite) : undefined,
    });
    const prompt = buildPrompt(ctx);

    let caption = '';
    let provider: ProviderName = chain[0].name;
    let lastError: Error | null = null;

    for (const p of chain) {
      try {
        caption = await p.call(prompt, p.key);
        provider = p.name;
        lastError = null;
        break;
      } catch (e: any) {
        console.error(`AI caption: ${p.name} failed:`, e?.message || e);
        lastError = e;
      }
    }

    if (lastError || !caption) {
      throw lastError || new Error('All providers failed');
    }

    // Enforce 90-char hard limit and strip stray quotes/hashtags
    caption = caption.replace(/[#][^\s]+/g, '').replace(/^["'""'']+|["'""'']+$/g, '').trim();
    if (caption.length > 90) caption = caption.slice(0, 87).trimEnd() + '…';

    return NextResponse.json({ caption, provider });
  } catch (error: any) {
    console.error('AI caption error:', error);
    return NextResponse.json({ caption: null, error: String(error?.message || error) }, { status: 500 });
  }
}
