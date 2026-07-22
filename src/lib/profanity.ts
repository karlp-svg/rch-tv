import { Filter } from 'bad-words';

const filter = new Filter();

// Add extra terms specific to venues / party context
filter.addWords(
  'stripper', 'nazi', 'kill', 'die', 'suicide', 'racist',
  'slur', 'terrorist', 'bomb', 'rape'
);

/**
 * Check if text contains profanity or unsafe content.
 * Returns true if the text is clean, false if it should be rejected.
 */
export function isClean(text: string | null | undefined): boolean {
  if (!text) return true;
  try {
    return !filter.isProfane(text);
  } catch {
    return true;
  }
}

/**
 * Return true if any of the provided text fields contain profanity.
 */
export function hasProfanity(...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => f && !isClean(f));
}
