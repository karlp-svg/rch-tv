'use client';

import { useEffect, useState, useRef } from 'react';
import { Music, Tv, Star, Clock, CheckCircle2, XCircle, Loader2, Trash2, PlayCircle, ExternalLink, RefreshCw, Shield, Download, AtSign, Moon, QrCode } from 'lucide-react';
import EndOfNightModal from '@/components/EndOfNightModal';
import QRCode from 'qrcode';

type Status = 'verifying' | 'queued' | 'in_progress' | 'complete' | 'rejected';

type Shoutout = { id: number; message: string; fromName: string | null; instagramHandle: string | null; showHandleOnTv?: boolean; followerVerified?: boolean | null; status: Status; createdAt: string };
type SongRequest = { id: number; artist: string; title: string | null; anyTitle?: boolean; requesterName: string | null; instagramHandle: string | null; showHandleOnTv?: boolean; followerVerified?: boolean | null; status: Status; createdAt: string };
type FameSubmission = { id: number; imageSrc: string; polaroidSrc?: string | null; caption: string | null; name: string | null; instagramHandle: string | null; showHandleOnTv?: boolean; followerVerified?: boolean | null; status: Status; createdAt: string };

type AdminData = {
  shoutouts: Shoutout[];
  songRequests: SongRequest[];
  fameSubmissions: FameSubmission[];
};

type Tab = 'shoutout' | 'song' | 'fame';

const statusConfig: Record<Status, { label: string; color: string; icon: typeof Clock }> = {
  verifying: { label: 'Verifying', color: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30', icon: Clock },
  queued: { label: 'Queued', color: 'bg-amber-400/10 text-amber-400 border-amber-400/30', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-400/10 text-blue-400 border-blue-400/30', icon: Loader2 },
  complete: { label: 'Complete', color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-400/10 text-red-400 border-red-400/30', icon: XCircle },
};

type FilterKey = 'all' | 'active' | Status;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'To Process' },
  { key: 'verifying', label: 'Pending' },
  { key: 'queued', label: 'Queued' },
  { key: 'in_progress', label: 'Live' },
  { key: 'complete', label: 'Done' },
  { key: 'rejected', label: 'Rejected' },
];

const TAB_LABELS: Record<Tab, string> = {
  shoutout: 'shoutouts',
  song: 'song requests',
  fame: 'photos',
};

async function downloadImage(src: string, id: number, name?: string | null) {
  const safeName = (name || 'photo').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);

  // Data URL (base64) — download directly
  if (src.startsWith('data:')) {
    const match = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mime = match?.[1] || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const link = document.createElement('a');
    link.href = src;
    link.download = `rch-tv-${safeName}-${id}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Remote URL (Supabase) — fetch as blob then download
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `rch-tv-${safeName}-${id}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open in new tab
    window.open(src, '_blank');
  }
}

export default function DJAdminPage() {
  const [data, setData] = useState<AdminData>({ shoutouts: [], songRequests: [], fameSubmissions: [] });
  const [tab, setTab] = useState<Tab>('shoutout');
  const [filter, setFilter] = useState<FilterKey>('active');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddHandleModal, setShowAddHandleModal] = useState(false);
  const [manualHandle, setManualHandle] = useState('');
  const [addingHandle, setAddingHandle] = useState(false);
  const [addHandleMessage, setAddHandleMessage] = useState<string | null>(null);
  const [uploadingDump, setUploadingDump] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [displayDuration, setDisplayDuration] = useState<number>(60);
  const [showTVLinkModal, setShowTVLinkModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<any | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [tvQueueLength, setTvQueueLength] = useState<number>(0);
  const [hideBackground, setHideBackground] = useState<boolean>(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [famePhotoSize, setFamePhotoSize] = useState(42);
  const [fameCompletedScale, setFameCompletedScale] = useState(70);
  const [fameRotation, setFameRotation] = useState(15);
  const [fameSpread, setFameSpread] = useState(600);
  const [fameSpreadY, setFameSpreadY] = useState(200);
  const [fameTitleOffset, setFameTitleOffset] = useState(22);
  const [fameDisplayOffset, setFameDisplayOffset] = useState(0);
  const [fameCompletedFade, setFameCompletedFade] = useState(70);
  const [showFameControls, setShowFameControls] = useState(false);
  const [showEndOfNight, setShowEndOfNight] = useState(false);
  // Manual entry modals
  const [showManualShoutoutModal, setShowManualShoutoutModal] = useState(false);
  const [showManualSongModal, setShowManualSongModal] = useState(false);
  const [manualShoutout, setManualShoutout] = useState({ message: '', fromName: '', instagramHandle: '' });
  const [manualSong, setManualSong] = useState({ artist: '', title: '', anyTitle: false, requesterName: '', instagramHandle: '' });
  const [publicSession, setPublicSession] = useState('');
  const [publicQr, setPublicQr] = useState('');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchFollowersCount();
    fetchSettings();
    fetchTVCurrent();
    fetchPublicSession();
    const interval = setInterval(fetchData, 5000);
    const tvInterval = setInterval(fetchTVCurrent, 3000);
    return () => { clearInterval(interval); clearInterval(tvInterval); };
  }, []);

  const completeCurrentAction = async () => {
    if (!currentAction) return;
    try {
      if (countdownRef.current) clearInterval(countdownRef.current);
      await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_and_promote',
          type: currentAction.type,
          id: currentAction.id,
        }),
      });
      setCurrentAction(null);
      setCountdown(0);
      await fetchData();
      await fetchTVCurrent();
    } catch (_) {}
  };

  // Countdown timer – when it hits 0, complete current and promote next queued
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!currentAction || countdown <= 0) return;

    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          // Fire-and-forget complete+promote
          void (async () => {
            try {
              await fetch('/api/admin', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'complete_and_promote',
                  type: currentAction.type,
                  id: currentAction.id,
                }),
              });
              await fetchData();
              await fetchTVCurrent();
            } catch (_) {}
          })();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAction?.id, currentAction?.type]);

  const fetchTVCurrent = async () => {
    try {
      const res = await fetch('/api/tv', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        const live = d.current || (d.queue && d.queue[0]) || null;
        setTvQueueLength((d.queuedCount || 0) + (live ? 1 : 0));
        if (d.displayDuration) setDisplayDuration(d.displayDuration);

        setCurrentAction((prev: any) => {
          if (!live) {
            setCountdown(0);
            return null;
          }
          // New item on air → restart countdown
          if (!prev || prev.id !== live.id || prev.type !== live.type) {
            setCountdown(d.displayDuration || displayDuration);
            return live;
          }
          return { ...prev, ...live };
        });
      }
    } catch (_) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const s = await res.json();
        if (s.display_duration) setDisplayDuration(parseInt(s.display_duration, 10));
        if (s.fame_photo_size) setFamePhotoSize(parseInt(s.fame_photo_size, 10));
        if (s.fame_completed_scale) setFameCompletedScale(parseInt(s.fame_completed_scale, 10));
        if (s.fame_rotation) setFameRotation(parseInt(s.fame_rotation, 10));
        if (s.fame_spread) setFameSpread(parseInt(s.fame_spread, 10));
        if (s.fame_spread_y) setFameSpreadY(parseInt(s.fame_spread_y, 10));
        if (s.fame_title_offset) setFameTitleOffset(parseInt(s.fame_title_offset, 10));
        if (s.fame_display_offset !== undefined) setFameDisplayOffset(parseInt(s.fame_display_offset, 10));
        if (s.fame_completed_fade) setFameCompletedFade(parseInt(s.fame_completed_fade, 10));
        if (s.tv_hide_background !== undefined) setHideBackground(s.tv_hide_background === 'true');
      }
    } catch (_) {}
  };

  const buildPublicUrl = (session: string) => {
    const base = process.env.NEXT_PUBLIC_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base.replace(/\/$/, '')}/?session=${encodeURIComponent(session)}`;
  };

  const fetchPublicSession = async () => {
    try {
      const res = await fetch('/api/admin/session', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const session = data.session || '';
      setPublicSession(session);
      if (session) {
        const qr = await QRCode.toDataURL(buildPublicUrl(session), { margin: 1, width: 320, color: { dark: '#ffffff', light: '#00000000' } });
        setPublicQr(qr);
      }
    } catch {}
  };

  const regeneratePublicSession = async () => {
    setSessionLoading(true);
    try {
      const res = await fetch('/api/admin/session', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      const session = data.session || '';
      setPublicSession(session);
      const qr = await QRCode.toDataURL(buildPublicUrl(session), { margin: 1, width: 320, color: { dark: '#ffffff', light: '#00000000' } });
      setPublicQr(qr);
    } finally {
      setSessionLoading(false);
    }
  };

  const updateDisplayDuration = async (secs: number) => {
    setDisplayDuration(secs);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_duration: String(secs) }),
      });
    } catch (_) {}
  };

  const updateHideBackground = async (hide: boolean) => {
    setHideBackground(hide);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tv_hide_background: String(hide) }),
      });
    } catch (_) {}
  };

  const handleManualShoutout = async () => {
    if (!manualShoutout.message.trim()) return;
    try {
      await fetch('/api/shoutouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: manualShoutout.message.trim(),
          fromName: manualShoutout.fromName.trim() || undefined,
          instagramHandle: manualShoutout.instagramHandle.trim().replace(/^@+/, '') || undefined,
        }),
      });
      setManualShoutout({ message: '', fromName: '', instagramHandle: '' });
      setShowManualShoutoutModal(false);
      fetchData();
    } catch (_) {}
  };

  const handleManualSong = async () => {
    if (!manualSong.artist.trim() || (!manualSong.anyTitle && !manualSong.title.trim())) return;
    try {
      await fetch('/api/song-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: manualSong.artist.trim(),
          title: manualSong.anyTitle ? undefined : manualSong.title.trim(),
          anyTitle: manualSong.anyTitle,
          requesterName: manualSong.requesterName.trim() || undefined,
          instagramHandle: manualSong.instagramHandle.trim().replace(/^@+/, '') || undefined,
        }),
      });
      setManualSong({ artist: '', title: '', anyTitle: false, requesterName: '', instagramHandle: '' });
      setShowManualSongModal(false);
      fetchData();
    } catch (_) {}
  };

  const handleAddManualHandle = async () => {
    if (!manualHandle.trim()) {
      setAddHandleMessage('❌ Please enter a handle');
      return;
    }

    setAddingHandle(true);
    setAddHandleMessage(null);
    
    try {
      // Clean the handle (remove @ if present)
      const cleanHandle = manualHandle.trim().replace(/^@/, '');
      
      const res = await fetch('/api/admin/add-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: cleanHandle }),
      });
      
      const d = await res.json();
      if (res.ok) {
        setAddHandleMessage(`✅ Added @${cleanHandle}! Verified ${d.verifiedCount || 0} requests.`);
        setManualHandle('');
        await fetchData();
        await fetchFollowersCount();
        await fetchTVCurrent();
      } else {
        setAddHandleMessage(`❌ Error: ${d.error || 'Failed to add handle'}`);
      }
    } catch (err) {
      setAddHandleMessage('❌ Failed to add handle.');
    } finally {
      setAddingHandle(false);
    }
  };

  const fetchFollowersCount = async () => {
    try {
      const res = await fetch('/api/admin/followers', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setFollowersCount(d.count || 0);
      }
    } catch (_) {}
  };

  const handleDumpFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDump(true);
    setUploadMessage(null);
    try {
      const text = await file.text();
      let payload: any = { rawText: text };
      try {
        const parsed = JSON.parse(text);
        payload = { dump: parsed };
      } catch (_) {}

      const res = await fetch('/api/admin/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        setUploadMessage(`✅ Successfully loaded ${d.processed} handles! Total in database: ${d.totalLoaded}`);
        setFollowersCount(d.totalLoaded);
        await fetchData();
      } else {
        setUploadMessage(`❌ Error: ${d.error || 'Upload failed'}`);
      }
    } catch (err) {
      setUploadMessage('❌ Failed to read or process file.');
    } finally {
      setUploadingDump(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/admin', { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
      } else {
        let detail = '';
        try {
          const errorBody = await res.json();
          detail = errorBody.error ? ` — ${errorBody.error}` : '';
        } catch {}
        setLoadError(`Could not load requests (HTTP ${res.status})${detail}`);
      }
    } catch (e) {
      console.error('Failed to fetch admin data', e);
      setLoadError('Could not reach the admin API. Check your deployment and database connection.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (type: Tab, id: number, status: Status | 'in_progress_force') => {
    setUpdatingId(id);
    try {
      if (status === 'in_progress_force') {
        // Force queued item to go live on TV now
        await fetch('/api/admin', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id, status: 'in_progress' }),
        });
      } else if (status === 'in_progress') {
        // Smart approve: if TV is empty -> in_progress; if TV active -> queued
        await fetch('/api/admin', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve', type, id }),
        });
      } else {
        await fetch('/api/admin', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id, status }),
        });
      }
      await fetchData();
      await fetchTVCurrent();
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteItem = async (type: Tab, id: number) => {
    if (!confirm('Delete this permanently?')) return;
    await fetch('/api/admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    });
    fetchData();
  };

  const deleteAll = async () => {
    const label = TAB_LABELS[tab];
    if (!confirm(`Delete ALL ${label}? This cannot be undone.`)) return;
    setDeletingAll(true);
    try {
      await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tab, deleteAll: true }),
      });
      await fetchData();
    } finally {
      setDeletingAll(false);
    }
  };

  const currentItems = () => {
    let items: (Shoutout | SongRequest | FameSubmission)[] = [];
    if (tab === 'shoutout') items = data.shoutouts;
    else if (tab === 'song') items = data.songRequests;
    else items = data.fameSubmissions;
    
    if (filter === 'active') {
      items = items.filter(i => i.status === 'verifying' || i.status === 'queued' || i.status === 'in_progress');
    } else if (filter !== 'all') {
      items = items.filter(i => i.status === filter);
    }
    return items;
  };

  const totalForTab = () => {
    if (tab === 'shoutout') return data.shoutouts.length;
    if (tab === 'song') return data.songRequests.length;
    return data.fameSubmissions.length;
  };

  const pendingCount = (items: { status: Status }[]) => items.filter(i => i.status === 'verifying').length;

  const stats = {
    shoutout: pendingCount(data.shoutouts),
    song: pendingCount(data.songRequests),
    fame: pendingCount(data.fameSubmissions),
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-500 text-xs font-mono">DJ ONLY</span>
            {process.env.NEXT_PUBLIC_DEPLOY_TARGET && (
              <span className="text-emerald-400 text-[10px] font-mono px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                DEPLOY: {String(process.env.NEXT_PUBLIC_DEPLOY_TARGET).toUpperCase()}
              </span>
            )}
            <span className="text-zinc-600">•</span>
            <a href="/" className="text-zinc-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
              Public Site <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="p-2 text-zinc-400 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-mono rounded-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
              LIVE FEED
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-4 items-start">
          {/* Left title column */}
          <aside className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 min-h-[210px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">🎛️</div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tighter leading-none">DJ<br />Console</h1>
                  <div className="mt-3 text-[10px] text-zinc-500 font-mono tracking-widest uppercase leading-relaxed">RCH TV<br />Management</div>
                </div>
              </div>
              <p className="text-zinc-500 text-xs leading-relaxed">Approve, reject and mark requests as they hit the screen</p>
            </div>
          </aside>

          {/* Right controls grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3 items-stretch">
            {/* Public Session */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between min-h-[132px]">
              <div>
                <div className="text-[10px] text-zinc-400 uppercase font-mono">Public Session</div>
                <div className="mt-1 text-sm font-bold text-indigo-300 font-mono">{publicSession ? `${publicSession.slice(0, 6)}…` : 'Loading…'}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={regeneratePublicSession}
                  disabled={sessionLoading}
                  className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-200 text-xs font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {sessionLoading ? 'Creating…' : 'New Session'}
                </button>
                <button
                  onClick={() => setShowSessionModal(true)}
                  className="px-3 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" /> QR
                </button>
              </div>
            </div>

            {/* IG Followers */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between min-h-[132px]">
              <div>
                <div className="text-[10px] text-zinc-400 uppercase font-mono">IG Followers DB</div>
                <div className="mt-1 text-sm font-bold text-pink-400">{followersCount.toLocaleString()} handles</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-2 bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <AtSign className="w-3.5 h-3.5" /> Upload
                </button>
                <button
                  onClick={() => setShowAddHandleModal(true)}
                  className="px-3 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-300 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <AtSign className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* TV Display Settings */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between min-h-[132px]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">TV Display</div>
                  <div className="mt-1 text-xs font-bold text-purple-400">{displayDuration >= 60 ? `${displayDuration / 60}m` : `${displayDuration}s`} per item</div>
                </div>
                <button
                  onClick={() => setShowTVLinkModal(true)}
                  className="px-2.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[10px] font-semibold rounded-lg transition flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> TV Link
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1">
                {[
                  { secs: 30, label: '30s' },
                  { secs: 60, label: '1m' },
                  { secs: 120, label: '2m' },
                  { secs: 300, label: '5m' },
                ].map((opt) => (
                  <button
                    key={opt.secs}
                    onClick={() => updateDisplayDuration(opt.secs)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition ${
                      displayDuration === opt.secs
                        ? 'bg-purple-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                <div className="text-[10px] text-zinc-400 uppercase font-mono">Hide BG</div>
                <button
                  onClick={() => updateHideBackground(!hideBackground)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${hideBackground ? 'bg-purple-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${hideBackground ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* On Air Now */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between min-h-[132px]">
              <div className="text-[10px] text-zinc-400 uppercase font-mono">On Air Now</div>
              {currentAction ? (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      currentAction.type === 'shoutout' ? 'bg-purple-500/20 text-purple-300' :
                      currentAction.type === 'song' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-pink-500/20 text-pink-300'
                    }`}>
                      {currentAction.type === 'shoutout' ? '📺 SHOUTOUT' : currentAction.type === 'song' ? '🎵 REQUEST' : '📸 PHOTO'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className={`text-xs font-mono font-bold ${countdown <= 10 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                      </div>
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-xs text-white truncate">
                    {currentAction.type === 'shoutout' && `"${(currentAction as any).message?.slice(0, 35)}"`}
                    {currentAction.type === 'song' && ((currentAction as any).anyTitle ? `Anything – ${(currentAction as any).artist}` : `${(currentAction as any).title} – ${(currentAction as any).artist}`)}
                    {currentAction.type === 'fame' && `${(currentAction as any).caption || 'Photo'}`}
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${Math.max(0, (countdown / displayDuration) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-zinc-500">{tvQueueLength > 1 ? `+${tvQueueLength - 1} queued` : 'Last in queue'}</div>
                    <button
                      onClick={completeCurrentAction}
                      className="text-[10px] px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-full font-semibold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Complete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-500 text-center py-2">Nothing on TV yet —<br />approve a request to go live</div>
              )}
            </div>

            {/* Secondary row */}
            <div className="md:col-start-2 2xl:col-start-2">
              <button
                onClick={() => setShowEndOfNight(true)}
                className="w-full px-3 py-3 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-2xl transition flex items-center justify-center gap-1.5"
              >
                <Moon className="w-3.5 h-3.5" /> End of Night
              </button>
            </div>

            <div className="md:col-span-2 2xl:col-span-2">
              <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full">
                <button
                  onClick={() => setShowFameControls(!showFameControls)}
                  className="w-full p-3.5 flex items-center justify-between text-[10px] text-zinc-400 uppercase font-mono hover:bg-white/5 transition"
                >
                  <span>📸 Wall of Fame Settings</span>
                  <span className="text-zinc-600">{showFameControls ? '▲' : '▼'}</span>
                </button>

                {showFameControls && (
                  <div className="px-3.5 pb-3.5 flex flex-col gap-3 border-t border-white/5 pt-3">
                    {/* In-progress photo size */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Photo Size</label>
                      <input
                        type="range"
                        min={20}
                        max={70}
                        value={famePhotoSize}
                        onChange={(e) => setFamePhotoSize(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_photo_size: String(famePhotoSize) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_photo_size: String(famePhotoSize) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">{famePhotoSize}%</span>
                    </div>

                    {/* Completed photos scale */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Completed Size</label>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={fameCompletedScale}
                        onChange={(e) => setFameCompletedScale(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_completed_scale: String(fameCompletedScale) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_completed_scale: String(fameCompletedScale) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">{fameCompletedScale}%</span>
                    </div>

                    {/* Rotation */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Rotation</label>
                      <input
                        type="range"
                        min={0}
                        max={45}
                        value={fameRotation}
                        onChange={(e) => setFameRotation(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_rotation: String(fameRotation) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_rotation: String(fameRotation) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">±{fameRotation}°</span>
                    </div>

                    {/* Spread Left/Right */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Left/Right</label>
                      <input
                        type="range"
                        min={100}
                        max={1200}
                        step={50}
                        value={fameSpread}
                        onChange={(e) => setFameSpread(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_spread: String(fameSpread) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_spread: String(fameSpread) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">{fameSpread}px</span>
                    </div>

                    {/* Spread Up/Down */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Up/Down</label>
                      <input
                        type="range"
                        min={50}
                        max={400}
                        step={25}
                        value={fameSpreadY}
                        onChange={(e) => setFameSpreadY(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_spread_y: String(fameSpreadY) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_spread_y: String(fameSpreadY) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">{fameSpreadY}px</span>
                    </div>

                    {/* Title Y Offset */}
                    <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Titles Y</label>
                      <input
                        type="range"
                        min={0}
                        max={70}
                        step={1}
                        value={fameTitleOffset}
                        onChange={(e) => setFameTitleOffset(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_title_offset: String(fameTitleOffset) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_title_offset: String(fameTitleOffset) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">{fameTitleOffset}%</span>
                    </div>

                    {/* Display Y Offset (whole layout) */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Display Y</label>
                      <input
                        type="range"
                        min={-300}
                        max={300}
                        step={10}
                        value={fameDisplayOffset}
                        onChange={(e) => setFameDisplayOffset(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_display_offset: String(fameDisplayOffset) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_display_offset: String(fameDisplayOffset) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">{fameDisplayOffset}px</span>
                    </div>

                    {/* Completed photo fade */}
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-zinc-500 w-24 shrink-0">Completed Fade</label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={fameCompletedFade}
                        onChange={(e) => setFameCompletedFade(parseInt(e.target.value, 10))}
                        onMouseUp={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_completed_fade: String(fameCompletedFade) }) });
                        }}
                        onTouchEnd={async () => {
                          await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fame_completed_fade: String(fameCompletedFade) }) });
                        }}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-pink-400 font-mono w-10 text-right">{fameCompletedFade}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
        {/* Upload Followers Dump Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <AtSign className="w-5 h-5 text-pink-400" /> Upload Instagram Followers Dump
                </h3>
                <button onClick={() => setShowUploadModal(false)} className="text-zinc-500 hover:text-white text-sm font-bold px-2 py-1">✕</button>
              </div>

              <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
                Upload your Instagram data export (`.json`, `.csv`, or `.txt`) containing follower handles.
                We&apos;ll parse all handles and add them to the verification database so followers can verify instantly!
              </p>

              <div className="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-pink-500/50 transition relative mb-4">
                <input
                  type="file"
                  accept=".json,.csv,.txt"
                  onChange={handleDumpFileUpload}
                  disabled={uploadingDump}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="text-sm font-semibold text-white mb-1">
                  {uploadingDump ? 'Parsing & Loading into Database...' : 'Click or Drag & Drop Dump File Here'}
                </div>
                <div className="text-[10px] text-zinc-500">Supports JSON dump files, CSVs, or text lists</div>
              </div>

              {uploadMessage && (
                <div className={`p-3 rounded-xl text-xs mb-4 ${uploadMessage.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                  {uploadMessage}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Handle Manually Modal */}
        {showAddHandleModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowAddHandleModal(false)}>
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <AtSign className="w-5 h-5 text-green-400" /> Add Instagram Handle Manually
                </h3>
                <button onClick={() => setShowAddHandleModal(false)} className="text-zinc-500 hover:text-white text-sm font-bold px-2 py-1">✕</button>
              </div>

              <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
                Manually add a verified follower handle. This will verify any pending requests from this user.
              </p>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono mb-1 block">Instagram Handle</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={manualHandle}
                      onChange={(e) => setManualHandle(e.target.value)}
                      placeholder="username"
                      disabled={addingHandle}
                      className="w-full pl-9 pr-4 py-2.5 bg-black border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:border-green-500/50 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {addHandleMessage && (
                <div className={`p-3 rounded-xl text-xs mb-4 ${addHandleMessage.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                  {addHandleMessage}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddHandleModal(false);
                    setManualHandle('');
                    setAddHandleMessage(null);
                  }}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddManualHandle}
                  disabled={addingHandle || !manualHandle.trim()}
                  className="px-5 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingHandle ? 'Adding...' : 'Add & Verify'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Shoutout Modal */}
        {showManualShoutoutModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowManualShoutoutModal(false)}>
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Tv className="w-5 h-5 text-purple-400" /> Manual Shoutout
                </h3>
                <button onClick={() => setShowManualShoutoutModal(false)} className="text-zinc-500 hover:text-white text-sm font-bold px-2 py-1">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Message</label>
                  <input
                    type="text"
                    value={manualShoutout.message}
                    onChange={(e) => setManualShoutout({ ...manualShoutout, message: e.target.value })}
                    placeholder="Happy Birthday!"
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">From (optional)</label>
                  <input
                    type="text"
                    value={manualShoutout.fromName}
                    onChange={(e) => setManualShoutout({ ...manualShoutout, fromName: e.target.value })}
                    placeholder="Alex"
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Instagram Handle (optional)</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={manualShoutout.instagramHandle}
                      onChange={(e) => setManualShoutout({ ...manualShoutout, instagramHandle: e.target.value })}
                      placeholder="username"
                      className="w-full pl-9 pr-3 py-2 bg-black border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowManualShoutoutModal(false)} className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold">
                  Cancel
                </button>
                <button onClick={handleManualShoutout} disabled={!manualShoutout.message.trim()} className="px-5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold disabled:opacity-50">
                  Add Shoutout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Song Request Modal */}
        {showManualSongModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowManualSongModal(false)}>
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Music className="w-5 h-5 text-amber-400" /> Manual Song Request
                </h3>
                <button onClick={() => setShowManualSongModal(false)} className="text-zinc-500 hover:text-white text-sm font-bold px-2 py-1">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Artist</label>
                  <input
                    type="text"
                    value={manualSong.artist}
                    onChange={(e) => setManualSong({ ...manualSong, artist: e.target.value })}
                    placeholder="Rufus Du Sol"
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-mono">Song Title</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-[10px] text-amber-400 uppercase tracking-wider font-mono">Anything by artist</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={manualSong.anyTitle}
                          onChange={(e) => setManualSong({ ...manualSong, anyTitle: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-zinc-800 peer-checked:bg-amber-500 rounded-full transition-colors"></div>
                        <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform peer-checked:translate-x-3.5"></div>
                      </div>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={manualSong.title}
                    onChange={(e) => setManualSong({ ...manualSong, title: e.target.value })}
                    disabled={manualSong.anyTitle}
                    placeholder={manualSong.anyTitle ? 'Any song will do!' : 'Innerbloom'}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Requested By (optional)</label>
                  <input
                    type="text"
                    value={manualSong.requesterName}
                    onChange={(e) => setManualSong({ ...manualSong, requesterName: e.target.value })}
                    placeholder="Sophie"
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Instagram Handle (optional)</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={manualSong.instagramHandle}
                      onChange={(e) => setManualSong({ ...manualSong, instagramHandle: e.target.value })}
                      placeholder="username"
                      className="w-full pl-9 pr-3 py-2 bg-black border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowManualSongModal(false)} className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold">
                  Cancel
                </button>
                <button onClick={handleManualSong} disabled={!manualSong.artist.trim() || (!manualSong.anyTitle && !manualSong.title.trim())} className="px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold disabled:opacity-50">
                  Add Song Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Public Session QR Modal */}
        {showSessionModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowSessionModal(false)}>
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6 text-center" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-400" /> Public Session QR
                </h3>
                <button onClick={() => setShowSessionModal(false)} className="text-zinc-500 hover:text-white text-sm font-bold px-2 py-1">✕</button>
              </div>
              {publicQr ? (
                <img src={publicQr} alt="Public QR" className="mx-auto w-72 h-72 object-contain mb-4" />
              ) : (
                <div className="mx-auto w-72 h-72 rounded-2xl border border-dashed border-white/10 grid place-items-center text-zinc-500 mb-4">No session QR yet</div>
              )}
              <div className="bg-black border border-white/10 rounded-2xl p-3 mb-4 text-left">
                <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Public URL</div>
                <div className="text-xs text-indigo-200 break-all font-mono">{publicSession ? buildPublicUrl(publicSession) : 'No active session'}</div>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={async () => {
                    if (publicSession) await navigator.clipboard.writeText(buildPublicUrl(publicSession));
                  }}
                  className="px-4 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold"
                >
                  Copy URL
                </button>
                <button
                  onClick={regeneratePublicSession}
                  disabled={sessionLoading}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {sessionLoading ? 'Creating…' : 'New Session'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TV Link Modal */}
        {showTVLinkModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowTVLinkModal(false)}>
            <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Tv className="w-5 h-5 text-purple-400" /> TV Browser Source
                </h3>
                <button onClick={() => setShowTVLinkModal(false)} className="text-zinc-500 hover:text-white text-sm font-bold px-2 py-1">✕</button>
              </div>

              <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
                Add this URL as a <strong className="text-white">Browser Source</strong> in OBS, vMix, or any streaming software.
                It will display approved requests on the screen, cycling every <strong className="text-white">{displayDuration} seconds</strong>.
              </p>

              <div className="bg-black border border-white/10 rounded-2xl p-4 mb-4">
                <div className="text-[10px] text-zinc-500 uppercase font-mono mb-2">Browser Source URL</div>
                <code className="text-purple-300 text-sm break-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/tv` : '/tv'}
                </code>
              </div>

              <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 mb-4 text-xs text-zinc-400 space-y-2">
                <div className="font-semibold text-zinc-300">OBS Setup:</div>
                <div>1. Add a new <strong className="text-white">Browser Source</strong></div>
                <div>2. Paste the URL above</div>
                <div>3. Set width/height to your resolution (e.g. 1920×1080)</div>
                <div>4. Check <strong className="text-white">Shutdown source when not visible</strong></div>
                <div>5. Approved items from the DJ Console will auto-rotate</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/tv`);
                  }}
                  className="flex-1 px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-xs font-semibold transition"
                >
                  Copy URL
                </button>
                <button
                  onClick={() => setShowTVLinkModal(false)}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {loadError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            <div>
              <strong className="block text-red-300 mb-1">Console data error</strong>
              {loadError}
            </div>
            <button onClick={fetchData} className="shrink-0 rounded-lg border border-red-400/30 px-2 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-500/20">Retry</button>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <TabButton active={tab === 'shoutout'} onClick={() => setTab('shoutout')} icon={<Tv className="w-4 h-4" />} label="Shoutouts" count={stats.shoutout} color="purple" />
          <TabButton active={tab === 'song'} onClick={() => setTab('song')} icon={<Music className="w-4 h-4" />} label="Songs" count={stats.song} color="amber" />
          <TabButton active={tab === 'fame'} onClick={() => setTab('fame')} icon={<Star className="w-4 h-4" />} label="Photos" count={stats.fame} color="pink" />
        </div>

        {/* Filter + Delete All */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  filter === f.key ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {tab === 'shoutout' && (
            <button
              onClick={() => {
                setManualShoutout({ message: '', fromName: '', instagramHandle: '' });
                setShowManualShoutoutModal(true);
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition"
            >
              + Shoutout
            </button>
          )}
          {tab === 'song' && (
            <button
              onClick={() => {
                setManualSong({ artist: '', title: '', anyTitle: false, requesterName: '', instagramHandle: '' });
                setShowManualSongModal(true);
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition"
            >
              + Request
            </button>
          )}
          <button
            onClick={deleteAll}
            disabled={deletingAll || totalForTab() === 0}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title={`Delete all ${TAB_LABELS[tab]}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deletingAll ? 'Deleting…' : `Delete all ${TAB_LABELS[tab]}`}
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          {currentItems().length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl text-zinc-500">
              {loading ? 'Loading...' : 'Nothing here'}
            </div>
          ) : (
            currentItems().map(item => (
              <AdminCard
                key={`${tab}-${item.id}`}
                type={tab}
                item={item}
                updating={updatingId === item.id}
                onUpdate={(status) => updateStatus(tab, item.id, status)}
                onDelete={() => deleteItem(tab, item.id)}
                onImageClick={(src) => setFullscreenImage(src)}
              />
            ))
          )}
        </div>
      </div>

      {/* Fullscreen modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <img
            src={fullscreenImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* End of Night social posts */}
      <EndOfNightModal open={showEndOfNight} onClose={() => setShowEndOfNight(false)} />
    </main>
  );
}

function TabButton({ active, onClick, icon, label, count, color }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    purple: 'border-purple-500 bg-purple-500/10',
    amber: 'border-amber-500 bg-amber-500/10',
    pink: 'border-pink-500 bg-pink-500/10',
  };
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 p-3 rounded-2xl border transition ${
        active ? colorMap[color] : 'border-white/10 bg-zinc-900 hover:border-white/20'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {count > 0 && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
          {count}
        </div>
      )}
    </button>
  );
}

function AdminCard({ type, item, updating, onUpdate, onDelete, onImageClick }: {
  type: Tab;
  item: Shoutout | SongRequest | FameSubmission;
  updating: boolean;
  onUpdate: (status: Status) => void;
  onDelete: () => void;
  onImageClick: (src: string) => void;
}) {
  const config = statusConfig[item.status];
  const Icon = config.icon;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {type === 'shoutout' && 'message' in item && (
            <>
              <div className="text-white text-base sm:text-lg leading-snug">&quot;{item.message}&quot;</div>
              {item.fromName && <div className="text-purple-400 text-sm mt-1">— {item.fromName}</div>}
              {item.instagramHandle && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <a href={`https://instagram.com/${item.instagramHandle}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full hover:bg-pink-500/20">
                    <AtSign className="w-3 h-3" /> {item.instagramHandle}
                  </a>
                  <span className={`text-[10px] px-2 py-1 rounded-full border ${item.showHandleOnTv ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-800 border-white/10'}`}>
                    {item.showHandleOnTv ? 'Add tag on TV' : 'No tag on TV'}
                  </span>
                  {item.followerVerified === true ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> ✓ Verified Follower
                    </span>
                  ) : item.followerVerified === false ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                      ⚠ Check Follower Manual
                    </span>
                  ) : null}
                </div>
              )}
            </>
          )}
          
          {type === 'song' && 'artist' in item && (
            <>
              <div className="font-semibold text-lg">
                {item.anyTitle ? (
                  <span className="text-amber-300 italic">Anything by</span>
                ) : (
                  item.title
                )}
              </div>
              <div className="text-amber-400 text-sm">{item.artist}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {item.requesterName && <div className="text-zinc-400 text-xs bg-white/5 px-2 py-1 rounded-full">by {item.requesterName}</div>}
                {item.instagramHandle && (
                  <a href={`https://instagram.com/${item.instagramHandle}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full hover:bg-pink-500/20">
                    <AtSign className="w-3 h-3" /> {item.instagramHandle}
                  </a>
                )}
                {item.instagramHandle && (
                  <span className={`text-[10px] px-2 py-1 rounded-full border ${item.showHandleOnTv ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-800 border-white/10'}`}>
                    {item.showHandleOnTv ? 'Add tag on TV' : 'No tag on TV'}
                  </span>
                )}
                {item.instagramHandle && (item.followerVerified === true ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> ✓ Verified Follower
                  </span>
                ) : item.followerVerified === false ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                    ⚠ Check Follower Manual
                  </span>
                ) : null)}
              </div>
            </>
          )}
          
          {type === 'fame' && 'imageSrc' in item && (
            <div className="flex gap-4">
              {item.polaroidSrc ? (
                <img
                  src={item.polaroidSrc}
                  alt="polaroid"
                  className="w-24 h-28 sm:w-32 sm:h-36 object-contain flex-shrink-0 bg-zinc-800 rounded-lg p-0.5 border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onImageClick(item.polaroidSrc!)}
                />
              ) : (
                <img
                  src={item.imageSrc}
                  alt="submission"
                  className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-xl border border-white/10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onImageClick(item.imageSrc)}
                />
              )}
              <div className="flex-1 min-w-0">
                {item.caption && <div className="text-white text-sm">&quot;{item.caption}&quot;</div>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.instagramHandle && (
                    <a href={`https://instagram.com/${item.instagramHandle}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full hover:bg-pink-500/20">
                      <AtSign className="w-3 h-3" /> {item.instagramHandle}
                    </a>
                  )}
                  {item.instagramHandle && (
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${item.showHandleOnTv ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-800 border-white/10'}`}>
                      {item.showHandleOnTv ? 'Add tag on TV' : 'No tag on TV'}
                    </span>
                  )}
                  {item.instagramHandle && (item.followerVerified === true ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> ✓ Verified Follower
                    </span>
                  ) : item.followerVerified === false ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                      ⚠ Check Follower Manual
                    </span>
                  ) : null)}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => downloadImage(item.imageSrc, item.id, `raw-${item.instagramHandle || 'photo'}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/30 hover:bg-pink-500/25 transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Original
                  </button>
                  {item.polaroidSrc && (
                    <button
                      onClick={() => downloadImage(item.polaroidSrc!, item.id, `polaroid-${item.instagramHandle || 'photo'}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/15 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Polaroid
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <div className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${config.color}`}>
              <Icon className={`w-3 h-3 ${item.status === 'in_progress' ? 'animate-spin' : ''}`} /> {config.label}
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2 sm:w-40">
          {item.status === 'verifying' && (
            <button
              onClick={() => onUpdate('in_progress')}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Approve
            </button>
          )}

          {item.status === 'queued' && (
            <button
              onClick={() => onUpdate('in_progress_force' as any)}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Make Live
            </button>
          )}
          
          {(item.status === 'in_progress' || item.status === 'queued') && (
            <button
              onClick={() => onUpdate('complete')}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Complete
            </button>
          )}

          {(item.status === 'verifying' || item.status === 'queued' || item.status === 'in_progress') && (
            <button
              onClick={() => onUpdate('rejected')}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold rounded-xl disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          )}

          {(item.status === 'complete' || item.status === 'rejected') && (
            <button
              onClick={() => onUpdate('verifying')}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          )}

          {type === 'fame' && 'imageSrc' in item && (
            <button
              onClick={() => downloadImage((item.polaroidSrc || item.imageSrc) as string, item.id, item.instagramHandle || item.name)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 text-xs font-semibold rounded-xl"
              title="Download photo for TV"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          )}

          <button
            onClick={onDelete}
            className="flex items-center justify-center py-2 px-3 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-500 text-xs rounded-xl"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
