'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Heart, MessageCircle, AtSign } from 'lucide-react';
import { storePublicSession, getStoredPublicSession, clearPublicSession } from '@/lib/useSessionGuard';

export default function LandingClient() {
  const [instaHandle, setInstaHandle] = useState('');
  const [touched, setTouched] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('rch_tv_insta_handle');
    if (saved) setInstaHandle(saved);
  }, []);

  useEffect(() => {
    const run = async () => {
      const queryToken = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('session') || ''
        : '';
      const storedToken = getStoredPublicSession();
      const token = queryToken || storedToken;
      if (!token) {
        setSessionValid(false);
        setSessionChecking(false);
        return;
      }
      try {
        const res = await fetch(`/api/session?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data.valid) {
          storePublicSession(token);
          setSessionValid(true);
        } else {
          clearPublicSession();
          setSessionValid(false);
        }
      } catch {
        setSessionValid(false);
      } finally {
        setSessionChecking(false);
      }
    };
    run();
  }, []);

  const normalizedHandle = instaHandle.trim().replace(/^@+/, '');

  const isValid = /^[a-zA-Z0-9._]{1,30}$/.test(normalizedHandle);

  const verifyFollowerAndProceed = async (openIgFirst = false) => {
    if (!sessionValid) return;
    if (!isValid) {
      setTouched(true);
      return;
    }
    localStorage.setItem('rch_tv_insta_handle', normalizedHandle);

    if (openIgFirst) {
      window.open('https://www.instagram.com/jakarl_dj/', '_blank');
    }

    setChecking(true);
    try {
      const res = await fetch(`/api/followers/check?handle=${encodeURIComponent(normalizedHandle)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          window.location.href = '/dashboard';
          return;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }

    // Not in static database dump -> ask confirmation
    setShowConfirmModal(true);
  };

  const handleFollowClick = () => {
    verifyFollowerAndProceed(true);
  };

  const handleAlreadyFollowing = () => {
    verifyFollowerAndProceed(false);
  };

  return (
    <main className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-gradient-to-br from-purple-950 via-black to-indigo-950 text-white flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:36px_36px] pointer-events-none"></div>

      <div className="relative z-10 flex-1 flex flex-col px-5 py-5 max-w-md mx-auto w-full">
        {/* Compact Header - only LIVE centered */}
        <div className="flex justify-center items-center mb-4 shrink-0">
          <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
            LIVE
          </div>
        </div>

        {/* Hero */}
        <div className="text-center shrink-0 my-3">
          <h1
            style={{ fontFamily: "'Vortax', 'Orbitron', 'Audiowide', sans-serif" }}
            className="text-7xl sm:text-8xl font-black tracking-wider leading-[0.9] text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-100 to-purple-400 drop-shadow-[0_10px_20px_rgba(168,85,247,0.3)]"
          >
            RCH<br />TV
          </h1>
        </div>

        {/* Follow Card */}
        <div className="flex-1 flex items-center min-h-0">
          <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">

            <div className="text-center mb-5">
              <div className="text-xl font-semibold mb-1">Follow @jakarl_dj</div>
              <div className="text-purple-300 text-xs">on Instagram to use RCH TV apps</div>
            </div>

            {sessionChecking ? (
              <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-xs text-zinc-400">
                Checking session…
              </div>
            ) : !sessionValid ? (
              <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-xs text-red-200">
                This QR session has expired. Please scan the latest code on screen.
              </div>
            ) : null}

            {/* IG Handle Input */}
            <div className="mb-4">
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-2">
                Your Instagram Handle
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <AtSign className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={instaHandle}
                  onChange={(e) => setInstaHandle(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="yourhandle"
                  className={`w-full bg-black border rounded-2xl pl-10 pr-4 py-3.5 text-sm placeholder:text-zinc-600 focus:outline-none transition-colors ${
                    touched && !isValid
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-white/10 focus:border-purple-500'
                  }`}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {touched && !isValid ? (
                <div className="text-[10px] text-red-400 mt-1.5">Enter a valid IG handle (letters, numbers, . _ )</div>
              ) : (
                <div className="text-[10px] text-zinc-500 mt-1.5">We use this to verify you followed</div>
              )}
            </div>

            <button
              onClick={handleFollowClick}
              disabled={checking || sessionChecking || !sessionValid}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:brightness-110 py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4" />
              {checking ? 'VERIFYING...' : 'FOLLOW ON INSTAGRAM'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleAlreadyFollowing}
              disabled={checking || sessionChecking || !sessionValid}
              className="w-full mt-3 py-3 border border-white/20 hover:bg-white/5 rounded-2xl text-white flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {checking ? 'CHECKING...' : <>YES, I&apos;M FOLLOWING <Heart className="w-4 h-4 text-pink-400" /></>}
            </button>
          </div>
        </div>

      </div>

      {/* Confirmation modal if not in static DB dump */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="mx-auto w-14 h-14 bg-pink-500/10 border border-pink-500/20 rounded-2xl flex items-center justify-center mb-4">
              <AtSign className="w-7 h-7 text-pink-400" />
            </div>

            <h3 className="text-xl font-bold mb-2">Are you sure you&apos;re following?</h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              We couldn&apos;t automatically verify <span className="text-pink-300 font-semibold">@{normalizedHandle}</span> in our current followers database.
              <br /><br />
              If you just followed recently, click Yes and our DJ will verify manually!
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="w-full py-3 bg-white text-black rounded-2xl font-semibold text-sm hover:bg-zinc-200 transition-colors"
              >
                Yes, I&apos;m following
              </button>

              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  window.open('https://www.instagram.com/jakarl_dj/', '_blank');
                }}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-medium text-xs transition-colors"
              >
                Ooops I forgot
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
