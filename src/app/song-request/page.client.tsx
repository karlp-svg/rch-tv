'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Music, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, AtSign } from 'lucide-react';
import Link from 'next/link';
import { useRotatingPlaceholder, markInputUsed } from '@/lib/useRotatingPlaceholder';
import { getStoredPublicSession, useRequireValidSession } from '@/lib/useSessionGuard';

const ARTIST_SAMPLES = [
  'Rufus Du Sol',
  'John Summit',
  'Rihanna',
  'Justin Bieber',
  'Fisher',
];

const TITLE_SAMPLES = [
  'Innerbloom',
  'Where You Are',
  'Losing It',
  'Umbrella',
  'Somewhere Only We Know',
];

const NAME_SAMPLES = [
  'Sophie',
  'Marcus',
  'The Birthday Girl',
  'Table 14',
  'Ben & the boys',
];

type SongRequest = {
  id: number;
  artist: string;
  title: string | null;
  anyTitle?: boolean;
  requesterName: string | null;
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

export default function SongRequestPage() {
  const { checking, valid } = useRequireValidSession();
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [anyTitle, setAnyTitle] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [showHandleOnTV, setShowHandleOnTV] = useState(false);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const artistPlaceholder = useRotatingPlaceholder(ARTIST_SAMPLES, artist);
  const titlePlaceholder = useRotatingPlaceholder(TITLE_SAMPLES, title);
  const namePlaceholder = useRotatingPlaceholder(NAME_SAMPLES, requesterName);

  useEffect(() => {
    const saved = localStorage.getItem('rch_tv_insta_handle') || '';
    setInstagramHandle(saved);
    fetchRequests();
    const interval = setInterval(fetchRequests, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/song-requests');
      if (res.ok) setRequests(await res.json());
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist.trim() || (!anyTitle && !title.trim())) return;

    setIsSubmitting(true);
    setSubmitError(null);
    const firstPageHandle = (typeof window !== 'undefined' ? localStorage.getItem('rch_tv_insta_handle') : '')?.trim() || instagramHandle.trim() || '';
    const sessionToken = getStoredPublicSession();

    try {
      const res = await fetch('/api/song-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          artist: artist.trim(), 
          title: anyTitle ? undefined : title.trim(),
          anyTitle,
          requesterName: requesterName.trim() || undefined,
          instagramHandle: firstPageHandle || undefined,
          showHandleOnTV,
          sessionToken,
        }),
      });
      
      if (res.ok) {
        setArtist('');
        setTitle('');
        setAnyTitle(false);
        setShowHandleOnTV(false);
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 2500);
        fetchRequests();
      } else {
        let apiMessage = 'Could not submit request.';
        try {
          const body = await res.json();
          if (body.error) apiMessage = body.error;
        } catch {}
        setSubmitError(`${apiMessage} (HTTP ${res.status})`);
      }
    } catch (e) {
      setSubmitError('Could not reach the request service. Please try again.');
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
          <span className="text-3xl">🎵</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter leading-none">Song Request</h1>
            <p className="text-zinc-400 text-xs mt-1">Ask the DJ to play your favorite</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-white/10 rounded-3xl p-5 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">ARTIST</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => { setArtist(e.target.value); markInputUsed(); }}
              className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-base focus:border-amber-400 placeholder:text-zinc-600 focus:outline-none"
              placeholder={artistPlaceholder}
              required
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500">SONG TITLE</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-[10px] text-amber-400 uppercase tracking-wider font-mono">Anything by artist</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={anyTitle}
                    onChange={(e) => { setAnyTitle(e.target.checked); markInputUsed(); }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-zinc-800 peer-checked:bg-amber-500 rounded-full transition-colors"></div>
                  <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform peer-checked:translate-x-3.5"></div>
                </div>
              </label>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); markInputUsed(); }}
              disabled={anyTitle}
              className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-base focus:border-amber-400 placeholder:text-zinc-600 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              placeholder={anyTitle ? 'Any song will do!' : titlePlaceholder}
              required={!anyTitle}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">YOUR NAME (OPTIONAL)</label>
            <input
              type="text"
              value={requesterName}
              onChange={(e) => { setRequesterName(e.target.value); markInputUsed(); }}
              className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-amber-400 placeholder:text-zinc-600 focus:outline-none"
              placeholder={namePlaceholder}
            />
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
            disabled={isSubmitting || !artist.trim() || (!anyTitle && !title.trim())}
            className="mt-2 w-full py-3.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-black font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-60 transition-all"
          >
            {isSubmitting ? 'SENDING...' : 'REQUEST THIS SONG'}
            {!isSubmitting && <Music className="w-4 h-4" />}
          </button>
          
          {submitted && (
            <p className="text-center text-emerald-400 text-xs flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> REQUEST RECEIVED
            </p>
          )}
          {submitError && (
            <p className="text-center text-red-300 text-xs leading-relaxed rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              {submitError}
            </p>
          )}
        </form>

        <div className="text-center mt-4 text-zinc-500 text-[10px] px-2">
          All requests are moderated — scroll to check your status below
        </div>

        {requests.length > 0 && (
          <div className="text-center mt-2 text-zinc-600 text-[10px] flex items-center justify-center gap-1">
            RECENT REQUESTS <ChevronDown className="w-3 h-3 animate-bounce" />
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-5 pb-10">
        <div className="uppercase text-[10px] tracking-widest text-zinc-400 mb-3 mt-2">Recent Song Requests</div>
        
        <div className="space-y-2.5">
          {requests.length === 0 ? (
            <div className="bg-zinc-900/70 border border-white/5 rounded-3xl p-6 text-center text-zinc-500 text-sm">
              No requests yet
            </div>
          ) : (
            requests.map((req) => {
              const config = statusConfig[req.status];
              const Icon = config.icon;
              return (
                <div key={req.id} className="flex items-center bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{req.anyTitle ? 'Anything' : req.title}</div>
                    <div className="text-xs text-amber-400 truncate">{req.artist}</div>
                    {req.requesterName && <div className="text-[10px] text-zinc-400 mt-0.5">by {req.requesterName}</div>}
                  </div>
                  
                  <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border shrink-0 ${config.color}`}>
                    <Icon className={`w-3 h-3 ${req.status === 'in_progress' ? 'animate-spin' : ''}`} /> {config.label}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
