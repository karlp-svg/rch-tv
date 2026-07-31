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

  const filterSelectedOnly = <T extends { id: number }>(rows: T[], ids?: number[]) => {
    if (!ids || ids.length === 0) return [];
    const selectedIds = new Set(ids);
    return rows.filter(r => selectedIds.has(r.id));
  };

  // Only the selected items for the active post type should influence the AI tagline.
  // Do not fall back to "all completed" and do not mix in other categories.
  const chosenShouts = postType === 'shoutouts'
    ? filterSelectedOnly(completedShouts, chosen.shoutIds).slice(0, 12)
    : [];
  const chosenSongs = postType === 'songs'
    ? filterSelectedOnly(completedSongs, chosen.songIds).slice(0, 12)
    : [];
  const chosenPhotos = postType === 'photos'
    ? filterSelectedOnly(completedPhotos as any, chosen.photoIds).slice(0, 12)
    : [];

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

Selected crowd shoutouts for this post:
${shoutsBlock}

Selected song requests for this post:
${songsBlock}

Selected Wall of Fame photo captions/names for this post:
${photosBlock}

Rules:
- One sentence. Absolute max 90 characters. Ideally 40–70.
- Playful, human, first-person from the DJ or the crowd's point of view is fine.
- Only use the selected items above. Do not invent, reference, or imply any unselected requests.
- Where possible, tie the caption to a specific detail from the selected items above (e.g. a birthday name, a song mentioned, a group name) — but do NOT quote a whole shoutout. Just riff on it.
- 1 emoji max (or none). No hashtags. No @mentions.
- No quotes around the output. Return ONLY the caption text, nothing else.`;
}

const SYSTEM_MSG = 'You are a witty short-form copywriter. Output the caption text only.';

// ─── Provider callers ───────────────────────────────────────────────

// Gemini fallback chain.
// Do NOT include gemini-1.5-* or gemini-2.0-* — they now return 404.
// Also avoid gemini-2.5-flash-lite: Google now returns "no longer available to new users"
// for some API keys. We dynamically ask ListModels below and prefer newer Flash models.
const GEMINI_PREFERRED_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const GEMINI_BLOCKED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
]);

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

type GeminiListedModel = {
  name?: string;
  supportedGenerationMethods?: string[];
};

function normalizeGeminiModelName(name: string) {
  return name.replace(/^models\//, '').trim();
}

function isUsefulTextGeminiModel(model: string) {
  const m = normalizeGeminiModelName(model);
  if (!m || GEMINI_BLOCKED_MODELS.has(m)) return false;
  // Exclude non-text-generation families. The caption route only needs text.
  if (/(embedding|imagen|image|veo|tts|audio|live)/i.test(m)) return false;
  return true;
}

function rankGeminiModel(model: string) {
  const m = normalizeGeminiModelName(model);
  const preferredIndex = GEMINI_PREFERRED_MODELS.indexOf(m);
  if (preferredIndex !== -1) return preferredIndex;
  if (/flash-lite/i.test(m)) return 50;
  if (/flash/i.test(m)) return 60;
  if (/pro/i.test(m)) return 80;
  return 100;
}

async function listAvailableGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`Gemini ListModels ${res.status}:`, (await res.text()).slice(0, 300));
      return [];
    }
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models as GeminiListedModel[] : [];
    return models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => normalizeGeminiModelName(m.name || ''))
      .filter(isUsefulTextGeminiModel)
      .sort((a, b) => rankGeminiModel(a) - rankGeminiModel(b));
  } catch (e: any) {
    console.error('Gemini ListModels failed:', e?.message || e);
    return [];
  }
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  // If user explicitly set a model, only try that one.
  // This lets you override quickly in Vercel with GEMINI_MODEL.
  const explicit = process.env.GEMINI_MODEL;
  if (explicit) return callGeminiModel(prompt, apiKey, normalizeGeminiModelName(explicit));

  const discovered = await listAvailableGeminiModels(apiKey);
  const candidates = discovered.length > 0
    ? discovered
    : Array.from(new Set(GEMINI_PREFERRED_MODELS.map(normalizeGeminiModelName).filter(isUsefulTextGeminiModel)));

  let lastErr: Error | null = null;
  for (const model of candidates) {
    try {
      return await callGeminiModel(prompt, apiKey, model);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      console.error(`Gemini model ${model} failed:`, msg.slice(0, 300));
      lastErr = e;
      // Only stop on auth/permission errors. Model availability, quota, and temporary
      // platform failures should fall through to the next candidate.
      if (/\b40[13]\b/.test(msg)) throw e;
    }
  }
  throw lastErr || new Error('No usable Gemini generateContent model found for this API key');
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

    // Skip LLM calls in sandbox/dev/preview — saves API credits and avoids
    // confusing errors when no provider key is set.
    if (process.env.NEXT_PUBLIC_PRODUCTION_MODE !== 'true') {
      return NextResponse.json({
        caption: '[AI caption will generate on your production deploy]',
        provider: 'skipped (non-production)',
      });
    }

    const chain = getProviderChain();
    if (chain.length === 0) {
      return NextResponse.json({
        caption: null,
        provider: null,
        error: 'No AI key configured. Set GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in your Vercel env vars.',
      });
    }

    const parseIds = (value: unknown) =>
      Array.isArray(value) ? value.map((n: any) => Number(n)).filter(Number.isFinite) : [];

    const selectedIds: ChosenItems = {
      shoutIds: postType === 'shoutouts' ? parseIds(body?.shoutIds) : [],
      songIds: postType === 'songs' ? parseIds(body?.songIds) : [],
      photoIds: postType === 'photos' ? parseIds(body?.photoIds) : [],
    };

    const activeIds = postType === 'shoutouts'
      ? selectedIds.shoutIds
      : postType === 'songs'
        ? selectedIds.songIds
        : selectedIds.photoIds;

    if (!activeIds || activeIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one item before generating an AI caption.' }, { status: 400 });
    }

    const ctx = await buildContext(postType, selectedIds);
    const matchedCount = ctx.shouts.length + ctx.songs.length + ctx.photos.length;
    if (matchedCount === 0) {
      return NextResponse.json({ error: 'None of the selected items are available for AI captioning.' }, { status: 400 });
    }
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
