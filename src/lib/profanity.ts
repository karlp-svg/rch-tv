/**
 * Lightweight profanity filter - edge/Worker compatible.
 * No Node.js dependencies - works in Cloudflare Workers, Vercel Edge, etc.
 */

const BLOCKED_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'cunt', 'dick', 'bastard',
  'piss', 'slut', 'whore', 'cock', 'porn', 'sex',
  'stripper', 'nazi', 'kill', 'die', 'suicide', 'racist',
  'terrorist', 'bomb', 'rape',
];

/**
 * Check if text contains profanity or unsafe content.
 * Returns true if the text is clean, false if it should be rejected.
 */
export function isClean(text: string | null | undefined): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return !BLOCKED_WORDS.some(word => {
    // Match whole word or as part of compound words
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * Return true if any of the provided text fields contain profanity.
 */
export function hasProfanity(...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => f && !isClean(f));
}
