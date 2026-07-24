'use client';

import { useState, useEffect, type ReactNode } from 'react';

const AUTH_STORAGE_KEY = 'rch_tv_dj_auth';

function encodeBasicAuth(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`);
}

export default function DJAuthGuard({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if we already have stored credentials
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      verifyAuth(stored);
    } else {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyAuth = async (authHeader: string) => {
    try {
      const res = await fetch('/api/admin', {
        headers: { 'authorization': authHeader },
      });
      if (res.ok) {
        localStorage.setItem(AUTH_STORAGE_KEY, authHeader);
        setAuthed(true);
        setChecking(false);
        return true;
      }
    } catch {}
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthed(false);
    setChecking(false);
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const auth = encodeBasicAuth(username, password);
    const ok = await verifyAuth(auth);
    if (!ok) {
      setError('Invalid DJ console credentials');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Checking access...</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-8">
          <div className="text-center mb-6">
            <div className="text-3xl mb-3">🎛️</div>
            <h1 className="text-xl font-bold">DJ Console</h1>
            <p className="text-zinc-400 text-xs mt-1">Enter your credentials</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 focus:outline-none"
                placeholder="dj"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={!username || !password}
              className="w-full py-3 bg-white text-black font-semibold rounded-xl text-sm hover:bg-white/90 disabled:opacity-50 transition-all"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
