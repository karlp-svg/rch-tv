'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'rch_tv_public_session';

export function storePublicSession(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearPublicSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStoredPublicSession() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function useRequireValidSession() {
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    // In sandbox/dev mode, skip session check for testing
    if (process.env.NEXT_PUBLIC_PRODUCTION_MODE !== 'true') {
      setValid(true);
      setChecking(false);
      return;
    }

    const run = async () => {
      const token = getStoredPublicSession();
      if (!token) {
        setValid(false);
        setChecking(false);
        window.location.href = '/';
        return;
      }
      try {
        const res = await fetch(`/api/session?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data.valid) {
          setValid(true);
        } else {
          clearPublicSession();
          setValid(false);
          window.location.href = '/';
        }
      } catch {
        setValid(false);
        window.location.href = '/';
      } finally {
        setChecking(false);
      }
    };
    run();
  }, []);

  return { checking, valid };
}
