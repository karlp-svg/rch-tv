'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, AtSign } from 'lucide-react';
import Link from 'next/link';
import { useRotatingPlaceholder, markInputUsed } from '@/lib/useRotatingPlaceholder';
import { getStoredPublicSession, useRequireValidSession } from '@/lib/useSessionGuard';
import TwitchThankYouPlayer from '@/components/TwitchThankYouPlayer';

const MESSAGE_SAMPLES = [
  'Happy Birthday Sarah! 🔥',
  'Shout out to my crew from Sydney!',
  'Marry me Emma? 💍',
  'DJ IS ON FIRE TONIGHT 🎧',
  'Big love from the dance floor ❤️',
];

const FROM_SAMPLES = [
  'Alex from the dancefloor',
  'The Birthday Girl',
  'Your #1 fan',
  'Sarah & the girls',
  'Table 14 crew',
];

type Shoutout = {
  id: number;
  message: string;
  fromName: string | null;
  instagramHandle: string | null;
  status: 'verifying' | 'in_progress' | 'complete' | 'rejected';
  createdAt: string;
};

const statusConfig = {
  verifying: { label: 'Verifying', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-400/30', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-400 border-blue-400/30', icon: Loader2 },
  complete: { label: 'Complete', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-400/30', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-400 border-red-400/30', icon: XCircle },
};

export default function ShoutoutPage() {
  const { checking, valid } = useRequireValidSession();
  const [message, setMessage] = useState('');
  const [fromName, setFromName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [showHandleOnTV, setShowHandleOnTV] = useState(false);
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showThankYouTwitch, setShowThankYouTwitch] = useState(false);
  const messagePlaceholder = useRotatingPlaceholder(MESSAGE_SAMPLES, message);
  const fromPlaceholder = useRotatingPlaceholder(FROM_SAMPLES, fromName);

  useEffect(() => {
    const saved = localStorage.getItem('rch_tv_insta_handle') || '';
    setInstagramHandle(saved);
    fetchShoutouts();
    const interval = setInterval(fetchShoutouts, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(settings => setShowThankYouTwitch(settings?.thank_you_twitch_enabled === 'true'))
      .catch(() => {});
  }, []);

  const fetchShoutouts = async () => {
    try {
      const res = await fetch('/api/shoutouts');
      if (res.ok) setShoutouts(await res.json());
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    const firstPageHandle = (typeof window !== 'undefined' ? localStorage.getItem('rch_tv_insta_handle') : '')?.trim() || instagramHandle.trim() || '';
    const sessionToken = getStoredPublicSession();

    try {
      const res = await fetch('/api/shoutouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message, 
          fromName: fromName.trim() || undefined,
          instagramHandle: firstPageHandle || undefined,
          showHandleOnTV,
          sessionToken,
        }),
      });
      
      if (res.ok) {
        setMessage('');
        setShowHandleOnTV(false);
        setSubmitted(true);
        fetchShoutouts();
      }
    } catch (e) {
      alert("Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking || !valid) {
    return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">Checking session…</main>;
  }

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-white">
      <div className="max-w-md mx-auto px-5 pt-5 pb-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white mb-4 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">📺</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter leading-none">TV Shoutout</h1>
            <p className="text-zinc-400 text-xs mt-1">Send a message to the big screen</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-white/10 rounded-3xl p-5">
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">YOUR MESSAGE</label>
            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); markInputUsed(); }}
              rows={2}
              className="w-full min-h-[5.5rem] bg-black border border-white/10 focus:border-purple-500 rounded-2xl p-4 text-base leading-snug placeholder:text-zinc-600 resize-none focus:outline-none"
              placeholder={messagePlaceholder}
              maxLength={140}
              required
            />
            <div className="text-right text-[10px] text-zinc-500 mt-1">{message.length}/140</div>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">FROM (OPTIONAL)</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => { setFromName(e.target.value); markInputUsed(); }}
              className="w-full bg-black border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 focus:outline-none"
              placeholder={fromPlaceholder}
              maxLength={60}
            />
          </div>

          <div className="mb-4 bg-zinc-950 border border-white/10 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <AtSign className="w-4 h-4 text-pink-400 shrink-0" />
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => {
                  setInstagramHandle(e.target.value);
                  localStorage.setItem('rch_tv_insta_handle', e.target.value.replace(/^@+/, '').trim());
                  markInputUsed();
                }}
                placeholder="your_insta_handle"
                className="bg-transparent w-full text-pink-300 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:text-white"
              />
            </div>
            <label className="flex items-center justify-between sm:justify-start gap-2 cursor-pointer shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Add tag on TV</span>
              <div className="relative">
                <input type="checkbox" checked={showHandleOnTV} onChange={(e) => setShowHandleOnTV(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-zinc-800 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="w-full py-3.5 bg-white text-black font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 disabled:opacity-50 transition-all active:scale-[0.985] text-sm"
          >
            {isSubmitting ? <>SENDING <Loader2 className="w-4 h-4 animate-spin" /></> : <>SEND TO RCH TV <Send className="w-4 h-4" /></>}
          </button>
        </form>

        <div className="text-center mt-4 text-zinc-500 text-[10px] px-2">
          All requests are moderated — scroll to check your status below
        </div>

        {shoutouts.length > 0 && (
          <div className="text-center mt-2 text-zinc-600 text-[10px] flex items-center justify-center gap-1">
            RECENT SHOUTOUTS <ChevronDown className="w-3 h-3 animate-bounce" />
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-5 pb-10">
        <div className="uppercase text-[10px] tracking-widest text-zinc-400 font-medium mb-3 mt-2">Recent Shoutouts</div>

        <div className="space-y-3">
          {shoutouts.length === 0 && (
            <div className="bg-zinc-900/70 border border-white/5 rounded-3xl p-6 text-center text-zinc-500 text-sm">
              No shoutouts yet. Be the first!
            </div>
          )}
          
          {shoutouts.map((shoutout) => {
            const config = statusConfig[shoutout.status];
            const Icon = config.icon;
            
            return (
              <div key={shoutout.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
                <div className="text-sm leading-tight mb-1.5">&quot;{shoutout.message}&quot;</div>
                {shoutout.fromName && (
                  <div className="text-xs text-purple-300">— {shoutout.fromName}</div>
                )}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border ${config.color}`}>
                    <Icon className={`w-3 h-3 ${shoutout.status === 'in_progress' ? 'animate-spin' : ''}`} /> {config.label}
                  </div>
                  <div className="text-[10px] text-zinc-600 font-mono">
                    {new Date(shoutout.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thank You overlay - mobile-safe scroll */}
      {submitted && (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl my-4">
            {/* Instagram handle at top */}
            <div className="mb-5">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-full px-4 py-2">
                <svg className="w-5 h-5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                </svg>
                <span className="text-white font-bold text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {instagramHandle || 'yourhandle'}
                </span>
              </div>
            </div>

            {/* Success icon */}
            <div className="mx-auto w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>

            {/* Main message */}
            <h3 className="text-lg font-bold text-white mb-2">Shoutout Sent!</h3>
            <p className="text-zinc-400 text-xs mb-5 leading-relaxed">
              Your shoutout has been sent to the DJ for review.
            </p>

            {/* DJ tip */}
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-5">
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                <span className="font-semibold text-white">Show this screen to the DJ</span> to increase your chances of getting approved!
              </p>
            </div>

            {showThankYouTwitch && (
              <div className="mb-5 text-left">
                <div className="text-[10px] uppercase tracking-widest text-purple-300 mb-2">Live from @jakarl_dj</div>
                <TwitchThankYouPlayer />
              </div>
            )}

            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="w-full py-3 bg-white text-black font-semibold rounded-2xl text-sm hover:bg-zinc-200 transition-colors"
            >
              Back to Menu
            </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
