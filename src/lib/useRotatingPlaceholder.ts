'use client';

import { useEffect, useState } from 'react';

/**
 * Rotates through placeholder samples every `intervalMs`.
 * Returns empty string when ANY monitored value has been typed,
 * or when any field on the form has input (via global flag).
 */

// Global flag: set to true once any field across any form has been typed.
// Reset on page load (fresh visit starts rotating again).
let globalHasInput = false;

export function useRotatingPlaceholder(samples: string[], value: string, intervalMs = 2500): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (samples.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % samples.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [samples.length, intervalMs]);

  // If this field or any other field has input, stop all rotation
  if (globalHasInput || value.trim().length > 0) return '';
  return samples[index] || '';
}

/**
 * Call this from any input's onChange to stop all rotating placeholders site-wide.
 */
export function markInputUsed() {
  globalHasInput = true;
}

/**
 * Reset all rotation on page load (optional — call in useEffect).
 */
export function resetPlaceholders() {
  globalHasInput = false;
}
