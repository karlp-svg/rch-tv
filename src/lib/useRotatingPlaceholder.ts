'use client';

import { useEffect, useState } from 'react';

/**
 * Rotates through placeholder samples every `intervalMs`.
 * Returns empty string when ANY monitored value has been typed,
 * or when any field on the form has input (via global flag).
 */

// Global flag: set to true once any field across any form has been typed.
// Reset on page navigation (fresh page load restarts rotation).
let globalHasInput = false;

export function useRotatingPlaceholder(samples: string[], value: string, intervalMs = 2500): string {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Reset the global flag on mount so rotating works on fresh page visits
    globalHasInput = false;
    // Small delay to let React hydrate fully (fixes mobile rendering)
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (samples.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % samples.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [samples.length, intervalMs]);

  // Wait for ready state to avoid hydration mismatch
  // If this field or any other field has input, stop all rotation
  if (!ready || globalHasInput || value.trim().length > 0) return '';
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
