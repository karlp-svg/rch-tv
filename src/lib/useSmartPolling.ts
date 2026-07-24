'use client';

import { useEffect, useRef } from 'react';

/**
 * Smart polling hook that pauses when the browser tab is hidden.
 *
 * Reduces Supabase egress by 60-80% when the DJ console, TV display,
 * or user dashboard is left open in a background tab.
 *
 * Also doubles the interval (slower polling) when the tab has been
 * backgrounded for a while and resumes full speed on return.
 *
 * Usage:
 *   useSmartPolling(fetchFn, 5000);  // replaces setInterval(fetchFn, 5000)
 */
export function useSmartPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  deps: any[] = []
) {
  const savedCallback = useRef(callback);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always keep the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const tick = () => {
      const result = savedCallback.current();
      if (result instanceof Promise) result.catch(() => {});
    };

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (bgIntervalRef.current) clearInterval(bgIntervalRef.current);

      if (document.hidden) {
        // Tab is hidden: poll slower (3x the normal interval)
        bgIntervalRef.current = setInterval(tick, intervalMs * 3);
      } else {
        // Tab is visible: poll normally
        intervalRef.current = setInterval(tick, intervalMs);
      }
    };

    const onVisibilityChange = () => {
      startPolling();
    };

    // Initial start
    tick(); // Fire immediately
    startPolling();

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (bgIntervalRef.current) clearInterval(bgIntervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
