'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

// ── Types ──────────────────────────────────────────────────────────────────

type Team = { id: string; name: string; logoUrl: string };

type Match = {
  id: string;
  status: string;
  kickoffTime?: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: Team;
  awayTeam: Team;
  homeUsed: boolean;
  awayUsed: boolean;
};

type MyPick = {
  id: string;
  status: string;
  pickType?: 'WIN' | 'WIN_OR_DRAW';
  team: Team | null;
};

type StandingRow = {
  alias: string;
  status: string;
  totalPoints?: number;
  eliminatedAtMatchday?: number | null;
};

// ── Constants ──────────────────────────────────────────────────────────────

const PICK_STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  SURVIVED:           { label: 'Sobreviviste',        cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  DRAW_ELIMINATED:    { label: 'Eliminado · empate',  cls: 'text-red-400 bg-red-500/10 border-red-500/25',            icon: <XCircle className="w-3.5 h-3.5" />     },
  LOSS_ELIMINATED:    { label: 'Eliminado · derrota', cls: 'text-red-400 bg-red-500/10 border-red-500/25',            icon: <XCircle className="w-3.5 h-3.5" />     },
  NO_PICK_ELIMINATED: { label: 'Sin pick · eliminado',cls: 'text-red-400 bg-red-500/10 border-red-500/25',            icon: <XCircle className="w-3.5 h-3.5" />     },
  PENDING:            { label: 'Pendiente',           cls: 'text-orange-400 bg-orange-500/10 border-orange-500/25',   icon: <Clock className="w-3.5 h-3.5" />       },
  POSTPONED_PENDING:  { label: 'Aplazado',            cls: 'text-sky-400 bg-sky-500/10 border-sky-500/25',            icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

function formatKickoff(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ── PickBottomSheet ────────────────────────────────────────────────────────

function PickBottomSheet({
  team,
  submitting,
  onPick,
  onClose,
}: {
  team: Team;
  submitting: boolean;
  onPick: (pickType: 'WIN' | 'WIN_OR_DRAW') => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-x-0 top-0 bg-black/60 z-[60]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}
        onClick={onClose}
      />
      <div className="fixed bottom-[56px] inset-x-0 z-[70] bg-[#111] rounded-t-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-3">
            {team.logoUrl && (
              <img src={team.logoUrl} alt={team.name} className="w-9 h-9 object-contain" />
            )}
            <span className="font-bold text-white text-base">{team.name}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3 pb-safe">
          <button
            disabled={submitting}
            onClick={() => onPick('WIN')}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-50 font-bold text-white text-base transition-colors"
          >
            🏆 Gana
          </button>
          <button
            disabled={submitting}
            onClick={() => onPick('WIN_OR_DRAW')}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-xl bg-white/8 hover:bg-white/12 active:bg-white/5 border border-white/15 disabled:opacity-50 font-bold text-white text-base transition-colors"
          >
            🤝 Gana o Empata
          </button>
        </div>
      </div>
    </>
  );
}

// ── TeamButton ─────────────────────────────────────────────────────────────

function TeamButton({
  team,
  isUsed,
  isMyPick,
  isSelected,
  isOtherSelected,
  canPick,
  onSelect,
  align,
}: {
  team: Team;
  isUsed: boolean;
  isMyPick: boolean;
  isSelected: boolean;
  isOtherSelected: boolean;
  canPick: boolean;
  onSelect: () => void;
  align: 'left' | 'right';
}) {
  const clickable = canPick && !isUsed;

  return (
    <button
      onClick={clickable ? onSelect : undefined}
      disabled={!clickable}
      className={cn(
        'flex-1 flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all min-w-0',
        align === 'right' && 'flex-row-reverse text-right',
        isMyPick && 'bg-orange-500/12 ring-1 ring-inset ring-orange-500/35',
        isSelected && !isMyPick && 'bg-white/8 ring-1 ring-inset ring-white/20',
        isUsed && !isMyPick && 'opacity-35',
        isOtherSelected && !isMyPick && !isSelected && 'opacity-30',
        clickable && !isMyPick && !isSelected && 'hover:bg-white/5 active:bg-white/10',
        !clickable && 'cursor-default',
      )}
    >
      <div className="relative shrink-0">
        <img
          src={team.logoUrl}
          alt={team.name}
          className={cn('w-10 h-10 object-contain', isUsed && !isMyPick && 'grayscale opacity-60')}
        />
        {isMyPick && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-xs font-semibold truncate leading-tight',
          isMyPick ? 'text-orange-300' : isUsed ? 'text-white/25' : 'text-white/85',
        )}>
          {team.name}
        </p>
        <p className="text-[10px] mt-0.5 leading-none">
          {isMyPick
            ? <span className="text-orange-400/70 font-medium">Tu pick</span>
            : isUsed
            ? <span className="text-white/20">Usado</span>
            : canPick && !isOtherSelected
            ? <span className="text-white/25">Toca para elegir</span>
            : null}
        </p>
      </div>
    </button>
  );
}

// ── ParticipantsList ───────────────────────────────────────────────────────

function ParticipantsList({ editionId }: { editionId: string }) {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/editions/${editionId}/standings`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [editionId]);

  if (loading) {
    return <p className="text-center py-12 text-white/25 text-sm">Cargando jugadores...</p>;
  }

  const active = rows.filter((r) => r.status !== 'ELIMINATED');
  const eliminated = rows.filter((r) => r.status === 'ELIMINATED');

  return (
    <div className="space-y-6 py-2">
      {active.length > 0 && (
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-emerald-400/50 mb-3">
            Activos · {active.length}
          </p>
          {active.map((r) => (
            <div key={r.alias} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-emerald-400 uppercase">{r.alias[0]}</span>
              </div>
              <span className="text-sm text-white/80 flex-1 font-medium">{r.alias}</span>
              {r.totalPoints != null && (
                <span className="text-xs font-bold text-orange-400 tabular-nums">{r.totalPoints} pts</span>
              )}
            </div>
          ))}
        </div>
      )}

      {eliminated.length > 0 && (
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-red-400/35 mb-3">
            Eliminados · {eliminated.length}
          </p>
          {eliminated.map((r) => (
            <div key={r.alias} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 opacity-40">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-red-400 uppercase">{r.alias[0]}</span>
              </div>
              <span className="text-sm text-white/50 flex-1 font-medium">{r.alias}</span>
              <XCircle className="w-4 h-4 text-red-400/40" />
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-center py-8 text-white/25 text-sm">Sin participantes</p>
      )}
    </div>
  );
}

// ── LogoImage ──────────────────────────────────────────────────────────────

function LaLigaLogo() {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) {
    return (
      <Shield className="relative w-16 h-16 sm:w-20 sm:h-20 text-orange-500 drop-shadow-[0_0_20px_rgba(249,115,22,0.5)]" />
    );
  }
  return (
    <img
      src="/Logo_LaLiga.png"
      alt="La Liga"
      className="relative w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_20px_rgba(249,115,22,0.45)]"
      onError={() => setImgFailed(true)}
    />
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function EditionPage() {
  const { id: editionId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [editionStartMatchday, setEditionStartMatchday] = useState<number | null>(null);
  const [editionEndMatchday, setEditionEndMatchday] = useState<number | null>(null);
  const [leagueSeason, setLeagueSeason] = useState<number | null>(null);
  const [championshipName, setChampionshipName] = useState('');

  const [currentMatchday, setCurrentMatchday] = useState<number>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myPick, setMyPick] = useState<MyPick | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [participantEliminated, setParticipantEliminated] = useState(false);
  const [matchdayFirstKickoff, setMatchdayFirstKickoff] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'picks' | 'jugadores'>('picks');

  // 1-second countdown + deadline check
  useEffect(() => {
    if (!matchdayFirstKickoff) {
      setCountdown('');
      setDeadlinePassed(false);
      return;
    }
    const tick = () => {
      const diff = new Date(matchdayFirstKickoff).getTime() - Date.now();
      if (diff <= 0) {
        setDeadlinePassed(true);
        setCountdown('Cerrado');
      } else {
        setDeadlinePassed(false);
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setCountdown(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
      }
    };
    tick();
    const t = setInterval(tick, 1_000);
    return () => clearInterval(t);
  }, [matchdayFirstKickoff]);

  const loadData = useCallback(async (matchday: number) => {
    setLoading(true);
    setError('');
    try {
      const [matchesRes, picksRes] = await Promise.all([
        fetch(`/api/editions/${editionId}/matches?matchday=${matchday}`),
        fetch(`/api/editions/${editionId}/picks?matchday=${matchday}`),
      ]);
      const matchesData = await matchesRes.json();
      const picksData = await picksRes.json();

      const list: Match[] = Array.isArray(matchesData) ? matchesData : [];
      setMatches(list);

      if (list.length > 0) {
        const kickoffs = list
          .map((m) => m.kickoffTime)
          .filter((k): k is string => typeof k === 'string' && !Number.isNaN(new Date(k).getTime()))
          .map((k) => new Date(k).getTime());
        setMatchdayFirstKickoff(kickoffs.length > 0 ? new Date(Math.min(...kickoffs)).toISOString() : null);
      } else {
        setMatchdayFirstKickoff(null);
      }

      setMyPick(picksData?.myPick ?? null);
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  // Load edition meta → find current matchday
  useEffect(() => {
    if (authLoading) return;
    setEditionStartMatchday(null);
    setLoading(true);

    fetch(`/api/editions/${editionId}/meta`)
      .then((r) => r.json())
      .then(async (meta) => {
        const start = Number.isFinite(Number(meta.startMatchday)) ? Number(meta.startMatchday) : 1;
        const end = meta.endMatchday != null ? Number(meta.endMatchday) : null;
        setEditionStartMatchday(start);
        setEditionEndMatchday(Number.isFinite(end) ? end : null);
        setLeagueSeason(meta.season ?? null);
        setChampionshipName(meta.championshipName ?? meta.name ?? '');

        let initialMd = start;
        try {
          const dRes = await fetch(`/api/editions/${editionId}/deadline`);
          const dData = await dRes.json();
          const current = Number(dData?.matchdayNumber);
          if (Number.isFinite(current)) {
            initialMd = end != null && Number.isFinite(end)
              ? Math.min(Math.max(current, start), end as number)
              : Math.max(current, start);
          }
        } catch { /* keep start */ }
        setCurrentMatchday(initialMd);
      })
      .catch(() => {
        setEditionStartMatchday(1);
        setCurrentMatchday(1);
        setLoading(false);
      });
  }, [authLoading, editionId]);

  useEffect(() => {
    if (authLoading || editionStartMatchday === null) return;
    loadData(currentMatchday);
  }, [authLoading, editionStartMatchday, currentMatchday, loadData]);

  // Fetch elimination status
  useEffect(() => {
    if (authLoading || !user?.alias) { setParticipantEliminated(false); return; }
    fetch(`/api/editions/${editionId}/standings`)
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        const me = rows.find((r: StandingRow) => r.alias === user.alias);
        setParticipantEliminated(me?.status === 'ELIMINATED');
      })
      .catch(() => setParticipantEliminated(false));
  }, [editionId, user?.alias, authLoading]);

  const canPick = !submitting && !participantEliminated && !deadlinePassed;

  function handleSelectTeam(teamId: string) {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
    setError('');
  }

  async function handlePick(pickType: 'WIN' | 'WIN_OR_DRAW') {
    if (!selectedTeamId || !canPick) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/editions/${editionId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId, matchdayNumber: currentMatchday, pickType }),
      });
      if (res.ok) {
        setSelectedTeamId(null);
        await loadData(currentMatchday);
      } else {
        const data = await res.json();
        const msg = Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Error al registrar el pick');
        setError(msg);
      }
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTeam = selectedTeamId
    ? matches.flatMap((m) => [m.homeTeam, m.awayTeam]).find((t) => t.id === selectedTeamId) ?? null
    : null;

  const pickStatus = myPick?.status ? (PICK_STATUS_CONFIG[myPick.status] ?? null) : null;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (authLoading || (loading && editionStartMatchday === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-center space-y-4">
          <Shield className="w-14 h-14 mx-auto text-orange-500 animate-pulse drop-shadow-[0_0_20px_rgba(249,115,22,0.5)]" />
          <p className="text-xs font-black tracking-[0.4em] uppercase text-white/20">Cargando…</p>
        </div>
      </div>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24 lg:pb-0">

      {/* ══ BOTTOM SHEET ══════════════════════════════════════════════════ */}
      {selectedTeam && canPick && (
        <PickBottomSheet
          team={selectedTeam}
          submitting={submitting}
          onPick={handlePick}
          onClose={() => setSelectedTeamId(null)}
        />
      )}

      {/* ══ HERO HEADER ═══════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        {/* Layered backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/60 via-stone-950/95 to-[#0a0a0a]" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(249,115,22,0.18) 0%, transparent 65%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg,#f97316 0,#f97316 1px,transparent 0,transparent 50%)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/25 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4">
          {/* Nav row */}
          <div className="h-13 flex items-center justify-between py-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-1.5 text-sm font-semibold text-orange-400/50 hover:text-orange-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </button>
            <div className="hidden sm:flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-black tracking-[0.45em] uppercase text-orange-500/25">
                LA LIGA
              </span>
              {championshipName && (
                <span className="text-[11px] font-bold text-orange-300/45 truncate max-w-[180px]">
                  {championshipName}
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveTab('jugadores')}
              className="text-orange-400/50 hover:text-orange-400 transition-colors"
            >
              <Users className="w-5 h-5" />
            </button>
          </div>

          {/* Hero content */}
          <div className="pb-8 pt-3 flex flex-col items-center text-center gap-3">
            {/* Logo */}
            <div className="relative">
              <div className="absolute inset-0 scale-150 blur-2xl bg-orange-500/10 rounded-full" />
              <LaLigaLogo />
            </div>

            {/* Title */}
            <div>
              <h1
                className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-orange-400"
                style={{ textShadow: '0 0 50px rgba(249,115,22,0.4), 0 0 100px rgba(249,115,22,0.15), 0 3px 10px rgba(0,0,0,0.9)' }}
              >
                La Liga
              </h1>
              {leagueSeason != null && (
                <p className="text-xs font-bold tracking-[0.35em] uppercase text-orange-300/30 mt-1.5">
                  Temporada {leagueSeason}/{Number(leagueSeason) + 1}
                </p>
              )}
            </div>

            {/* Matchday nav */}
            <div className="flex items-center gap-3 mt-0.5">
              <button
                onClick={() => {
                  const min = editionStartMatchday ?? 1;
                  if (currentMatchday > min) {
                    setCurrentMatchday((m) => m - 1);
                    setSelectedTeamId(null);
                  }
                }}
                disabled={currentMatchday <= (editionStartMatchday ?? 1)}
                className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/12 disabled:opacity-20 transition-colors text-lg"
              >
                ‹
              </button>
              <span className="text-sm font-bold text-white/55 min-w-[90px] text-center">
                Jornada {currentMatchday}
              </span>
              <button
                onClick={() => {
                  if (editionEndMatchday == null || currentMatchday < editionEndMatchday) {
                    setCurrentMatchday((m) => m + 1);
                    setSelectedTeamId(null);
                  }
                }}
                disabled={editionEndMatchday != null && currentMatchday >= editionEndMatchday}
                className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/12 disabled:opacity-20 transition-colors text-lg"
              >
                ›
              </button>
            </div>

            {/* Deadline / eliminated pill */}
            {participantEliminated ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-bold text-red-400">Has sido eliminado</span>
              </div>
            ) : deadlinePassed ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Clock className="w-3.5 h-3.5 text-white/25" />
                <span className="text-xs font-bold text-white/30">Picks cerrados</span>
              </div>
            ) : matchdayFirstKickoff ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-orange-400">Cierra en {countdown}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative border-b border-white/8">
          <div className="max-w-4xl mx-auto px-4 flex">
            {(['picks', 'jugadores'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-5 py-3 text-sm font-bold transition-colors relative',
                  activeTab === tab ? 'text-orange-400' : 'text-white/25 hover:text-white/50',
                )}
              >
                {tab === 'picks' ? '⚽ Picks' : '👥 Jugadores'}
                {activeTab === tab && (
                  <span className="absolute bottom-0 inset-x-3 h-0.5 bg-orange-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ CONTENT ════════════════════════════════════════════════════════ */}
      <main className="max-w-4xl mx-auto px-4 py-4">

        {/* ── Picks tab ──────────────────────────────────────────────────── */}
        {activeTab === 'picks' && (
          <div>
            {error && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* My pick banner */}
            {myPick?.team && (
              <div className={cn(
                'mb-4 flex items-center gap-3 px-3 py-3 rounded-xl border',
                pickStatus ? pickStatus.cls : 'border-orange-500/20 bg-orange-500/5 text-orange-400',
              )}>
                <img
                  src={myPick.team.logoUrl}
                  alt={myPick.team.name}
                  className="w-10 h-10 object-contain shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white/90 text-sm truncate">{myPick.team.name}</p>
                  {myPick.pickType && (
                    <p className="text-[11px] text-white/35 mt-0.5">
                      {myPick.pickType === 'WIN_OR_DRAW' ? '🤝 Gana o Empata' : '🏆 Gana'}
                    </p>
                  )}
                </div>
                {pickStatus && (
                  <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold shrink-0', pickStatus.cls)}>
                    {pickStatus.icon}
                    <span>{pickStatus.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* Match list */}
            {loading ? (
              <div className="text-center py-12 text-white/20 text-sm">Cargando jornada…</div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12 text-white/20 text-sm">No hay partidos disponibles</div>
            ) : (
              <div className="flex flex-col gap-2">
                {matches.map((match) => {
                  const homeLocked = match.homeUsed && myPick?.team?.id !== match.homeTeam.id;
                  const awayLocked = match.awayUsed && myPick?.team?.id !== match.awayTeam.id;
                  const isHomeMyPick = myPick?.team?.id === match.homeTeam.id;
                  const isAwayMyPick = myPick?.team?.id === match.awayTeam.id;
                  const isHomeSelected = selectedTeamId === match.homeTeam.id;
                  const isAwaySelected = selectedTeamId === match.awayTeam.id;
                  const someSelected = isHomeSelected || isAwaySelected;
                  const isPickedMatch = isHomeMyPick || isAwayMyPick;

                  const isLive = ['LIVE', 'IN_PLAY', 'HALFTIME', '1H', '2H', 'HT'].includes(match.status);
                  const isFinished = ['FINISHED', 'FT', 'AET', 'PEN'].includes(match.status);
                  const hasScore = match.homeScore !== null && match.awayScore !== null;

                  return (
                    <div
                      key={match.id}
                      className={cn(
                        'rounded-2xl border overflow-hidden transition-colors',
                        isPickedMatch
                          ? 'border-orange-500/30 bg-gradient-to-br from-orange-950/20 to-transparent shadow-[0_0_24px_rgba(249,115,22,0.06)]'
                          : 'border-white/7 bg-white/[0.025]',
                      )}
                    >
                      {/* Status / kickoff row */}
                      <div className="flex items-center justify-between px-3 pt-2 pb-0.5">
                        <div className="flex items-center gap-1.5">
                          {isLive ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">En vivo</span>
                            </>
                          ) : isFinished ? (
                            <span className="text-[10px] font-bold text-white/18 uppercase tracking-wide">Finalizado</span>
                          ) : (
                            <span className="text-[10px] text-white/25">{formatKickoff(match.kickoffTime)}</span>
                          )}
                        </div>
                        {hasScore && (
                          <span className="text-xs font-black text-white/45 tabular-nums">
                            {match.homeScore} – {match.awayScore}
                          </span>
                        )}
                      </div>

                      {/* Teams */}
                      <div className="flex items-stretch gap-1 px-1.5 pb-1.5">
                        <TeamButton
                          team={match.homeTeam}
                          isUsed={homeLocked}
                          isMyPick={isHomeMyPick}
                          isSelected={isHomeSelected}
                          isOtherSelected={someSelected && !isHomeSelected}
                          canPick={canPick}
                          onSelect={() => handleSelectTeam(match.homeTeam.id)}
                          align="left"
                        />
                        <div className="flex items-center justify-center w-5 shrink-0">
                          <span className="text-[10px] font-black text-white/12">vs</span>
                        </div>
                        <TeamButton
                          team={match.awayTeam}
                          isUsed={awayLocked}
                          isMyPick={isAwayMyPick}
                          isSelected={isAwaySelected}
                          isOtherSelected={someSelected && !isAwaySelected}
                          canPick={canPick}
                          onSelect={() => handleSelectTeam(match.awayTeam.id)}
                          align="right"
                        />
                      </div>

                      {/* Orange strip on picked match */}
                      {isPickedMatch && (
                        <div className="h-0.5 bg-gradient-to-r from-transparent via-orange-500/45 to-transparent" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Jugadores tab ──────────────────────────────────────────────── */}
        {activeTab === 'jugadores' && (
          <ParticipantsList editionId={editionId} />
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
}
