'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trophy, Clock, Shield, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Users, History } from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

// ── Types ──────────────────────────────────────────────────────────────────

type Team = { id: string; name: string; logoUrl: string };

type WcMatch = {
  id: string;
  status: string;
  kickoffTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  wcGroup: string | null;
  tournamentPhase: string | null;
  homeTeam: Team;
  awayTeam: Team;
  homeUsed: boolean;
  awayUsed: boolean;
};

type MyPick = { id: string; status: string; pickType: 'WIN' | 'WIN_OR_DRAW'; team: Team | null };

type TodayContext = {
  championshipName: string;
  matchday: {
    id: string;
    number: number;
    status: string;
    tournamentPhase: string | null;
    wcGroupDay: number | null;
    firstKickoff: string | null;
    deadlinePassed: boolean;
    prevNumber: number | null;
    nextNumber: number | null;
  } | null;
  matches: WcMatch[];
  myPick: MyPick | null;
  participant: { status: string; eliminatedAtPhase: string | null };
};

type GroupStanding = {
  position: number;
  team: Team;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; points: number;
};

type Group = { name: string; standings: GroupStanding[] }

type Participant = {
  alias: string;
  status: string;
  eliminatedAtPhase: string | null;
  lastPick: { team: { name: string; logoUrl: string }; pickStatus: string } | null;
};

type EditionHistoryEntry = {
  id: string;
  name: string;
  finishedAt: string | null;
  winnerAlias: string | null;
  participantCount: number;
};

type EditionPickDetail = {
  matchdayNumber: number;
  team: { name: string; logoUrl: string } | null;
  pickStatus: string;
};

type EditionParticipantDetail = {
  alias: string;
  status: string;
  picks: EditionPickDetail[];
};

type EditionDetail = {
  edition: { id: string; name: string; finishedAt: string | null; winnerAlias: string | null };
  participants: EditionParticipantDetail[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  GROUP_STAGE:     'Fase de Grupos',
  ROUND_OF_32:    'Ronda de 32',
  ROUND_OF_16:    'Octavos de Final',
  QUARTER_FINALS: 'Cuartos de Final',
  SEMI_FINALS:    'Semifinales',
  THIRD_PLACE:    'Tercer Puesto',
  FINAL:          'Gran Final',
};

const PICK_STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  SURVIVED:           { label: 'Sobreviviste', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  DRAW_ELIMINATED:    { label: 'Eliminado · empate', cls: 'text-red-400 bg-red-500/10 border-red-500/25', icon: <XCircle className="w-3.5 h-3.5" /> },
  LOSS_ELIMINATED:    { label: 'Eliminado · derrota', cls: 'text-red-400 bg-red-500/10 border-red-500/25', icon: <XCircle className="w-3.5 h-3.5" /> },
  NO_PICK_ELIMINATED: { label: 'Sin pick · eliminado', cls: 'text-red-400 bg-red-500/10 border-red-500/25', icon: <XCircle className="w-3.5 h-3.5" /> },
  PENDING:            { label: 'Pendiente', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25', icon: <Clock className="w-3.5 h-3.5" /> },
  POSTPONED_PENDING:  { label: 'Aplazado', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/25', icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

function formatKickoff(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(iso: string | null): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Cerrado';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── GroupTable ─────────────────────────────────────────────────────────────

function GroupTable({ group }: { group: Group }) {
  const hasStats = group.standings.some((s) => s.played > 0);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500/20 to-transparent border-b border-white/8 flex items-center justify-between">
        <span className="text-xs font-black tracking-widest uppercase text-amber-400">
          Grupo {group.name}
        </span>
        {hasStats && (
          <div className="flex gap-2 text-[10px] font-bold text-white/30 uppercase tracking-wider">
            <span>J</span><span>G</span><span>E</span><span>P</span>
            <span className="text-amber-400/60">Pts</span>
          </div>
        )}
      </div>
      {group.standings.map((s, i) => {
        const qualifies = hasStats && i < 2;
        return (
          <div
            key={s.team.id}
            className={`flex items-center gap-2 px-3 py-2.5 border-b border-white/5 last:border-0 transition-colors
              ${qualifies ? 'bg-emerald-500/5' : ''}`}
          >
            <span className={`w-4 text-[11px] font-black shrink-0 ${qualifies ? 'text-emerald-400' : 'text-white/20'}`}>
              {s.position}
            </span>
            <img src={s.team.logoUrl} alt={s.team.name} className="w-5 h-5 object-contain shrink-0" />
            <span className="flex-1 text-xs font-semibold truncate text-white/80">{s.team.name}</span>
            {hasStats && (
              <div className="flex gap-2 text-[11px] text-white/35 font-medium">
                <span className="w-4 text-center">{s.played}</span>
                <span className="w-4 text-center">{s.won}</span>
                <span className="w-4 text-center">{s.drawn}</span>
                <span className="w-4 text-center">{s.lost}</span>
                <span className="w-5 text-center font-black text-amber-400">{s.points}</span>
              </div>
            )}
          </div>
        );
      })}
      {hasStats && (
        <div className="px-3 py-1.5 flex items-center gap-1.5 bg-black/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-[10px] text-white/25">Clasifican top 2</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WcPickPage() {
  const { editionId } = useParams<{ editionId: string }>();
  const router = useRouter();

  const [ctx, setCtx] = useState<TodayContext | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'picks' | 'jugadores' | 'historico'>('picks');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsFetched, setParticipantsFetched] = useState(false);
  const [history, setHistory] = useState<EditionHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [editionDetails, setEditionDetails] = useState<Record<string, EditionDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);

  const loadData = useCallback(async (matchdayNum?: number) => {
    try {
      const mdParam = matchdayNum ? `?matchday=${matchdayNum}` : '';
      const [todayRes, groupsRes] = await Promise.all([
        fetch(`/api/wc/editions/${editionId}/today${mdParam}`),
        fetch(`/api/wc/editions/${editionId}/groups`),
      ]);
      if (todayRes.ok) {
        const data = await todayRes.json();
        setCtx(data);
      }
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data);
        if (data.length > 0) setActiveGroup((prev) => prev ?? data[0].name);
      }
    } catch {
      // network error or non-JSON response — page stays in loading=false with null ctx
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!ctx?.matchday?.firstKickoff) return;
    const id = setInterval(() => setCountdown(formatCountdown(ctx.matchday!.firstKickoff)), 1000);
    setCountdown(formatCountdown(ctx.matchday.firstKickoff));
    return () => clearInterval(id);
  }, [ctx?.matchday?.firstKickoff]);

  async function handlePick(teamId: string, pickType: 'WIN' | 'WIN_OR_DRAW') {
    if (!ctx?.matchday || ctx.matchday.deadlinePassed) return;
    setPicking(`${teamId}-${pickType}`);
    try {
      const res = await fetch(`/api/editions/${editionId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, matchdayNumber: ctx.matchday.number, pickType }),
      });
      if (res.ok) {
        setSelectedTeamId(null);
        await loadData(selectedMatchday ?? undefined);
      }
    } finally { setPicking(null); }
  }

  function handleMatchdayNav(direction: 'prev' | 'next') {
    const target = direction === 'prev'
      ? ctx?.matchday?.prevNumber ?? null
      : ctx?.matchday?.nextNumber ?? null;
    if (target === null) return;
    setSelectedMatchday(target);
    setSelectedTeamId(null);
    loadData(target);
  }

  function handleSelectTeam(teamId: string) {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
  }

  useEffect(() => {
    if (activeTab !== 'jugadores' || participantsFetched) return;
    setParticipantsLoading(true);
    fetch(`/api/wc/editions/${editionId}/participants`)
      .then((r) => r.json())
      .then((data) => { setParticipants(Array.isArray(data) ? data : []); setParticipantsFetched(true); })
      .catch(() => setParticipantsFetched(true))
      .finally(() => setParticipantsLoading(false));
  }, [activeTab, editionId, participantsFetched]);

  useEffect(() => {
    if (activeTab !== 'historico' || historyFetched) return;
    setHistoryLoading(true);
    fetch(`/api/wc/editions/${editionId}/history`)
      .then((r) => r.json())
      .then((data) => { setHistory(Array.isArray(data) ? data : []); setHistoryFetched(true); })
      .catch(() => setHistoryFetched(true))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, editionId, historyFetched]);

  function handleHistoryToggle(id: string) {
    setExpandedHistoryId((prev) => (prev === id ? null : id));
    if (!editionDetails[id]) {
      setDetailLoadingId(id);
      fetch(`/api/wc/editions/${id}/detail`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) setEditionDetails((prev) => ({ ...prev, [id]: data })); })
        .finally(() => setDetailLoadingId(null));
    }
  }

  const matchesByGroup = ctx?.matches.reduce<Record<string, WcMatch[]>>((acc, m) => {
    const key = m.wcGroup ?? m.tournamentPhase ?? 'knockout';
    (acc[key] ??= []).push(m);
    return acc;
  }, {}) ?? {};

  const isEliminated = ctx?.participant.status === 'ELIMINATED';
  const globalCanPick = !(ctx?.matchday?.deadlinePassed ?? true) && !isEliminated;
  const selectedTeam = selectedTeamId
    ? (ctx?.matches ?? []).flatMap(m => [m.homeTeam, m.awayTeam]).find(t => t.id === selectedTeamId) ?? null
    : null;
  const phase = ctx?.matchday?.tournamentPhase;
  const isGroupStage = phase === 'GROUP_STAGE';
  const activeGroupData = groups.find((g) => g.name === activeGroup) ?? null;

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d0b08]">
        <div className="text-center space-y-5">
          <Trophy className="w-16 h-16 mx-auto text-amber-400 drop-shadow-[0_0_24px_rgba(251,191,36,0.6)] animate-pulse" />
          <p className="text-xs font-black tracking-[0.4em] uppercase text-white/30">Cargando Mundial…</p>
        </div>
      </div>
    );
  }

  // ── Page ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0b08] pb-24 lg:pb-0">

      {/* ══ HERO HEADER ═══════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        {/* Layered backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/70 via-stone-950/95 to-[#0d0b08]" />
        {/* Stadium spotlight from top */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(217,119,6,0.25) 0%, transparent 65%)' }}
        />
        {/* Diamond grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg,#f59e0b 0,#f59e0b 1px,transparent 0,transparent 50%)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* Bottom fade line */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4">
          {/* Nav */}
          <div className="h-13 flex items-center justify-between py-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-400/50 hover:text-amber-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </button>
            <div className="hidden sm:flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-black tracking-[0.45em] uppercase text-amber-500/30">
                FIFA WORLD CUP
              </span>
              {ctx?.championshipName && (
                <span className="text-[11px] font-bold text-amber-300/60 truncate max-w-[180px]">
                  {ctx.championshipName}
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveTab('jugadores')}
              className="text-amber-400/50 hover:text-amber-400 transition-colors"
            >
              <Users className="w-5 h-5" />
            </button>
          </div>

          {/* Hero content */}
          <div className="pb-9 pt-4 flex flex-col items-center text-center gap-4">

            {/* Trophy with glow */}
            <div className="relative">
              <div className="absolute inset-0 scale-150 blur-2xl bg-amber-400/15 rounded-full" />
              <Trophy
                className="relative w-16 h-16 sm:w-20 sm:h-20 text-amber-400 drop-shadow-[0_0_24px_rgba(251,191,36,0.7)]"
              />
            </div>

            {/* Title */}
            <div>
              <h1
                className="text-5xl sm:text-6xl font-black uppercase tracking-tight text-amber-400"
                style={{ textShadow: '0 0 50px rgba(251,191,36,0.5), 0 0 100px rgba(251,191,36,0.2), 0 3px 10px rgba(0,0,0,0.9)' }}
              >
                World Cup
              </h1>
              <p className="text-xs font-bold tracking-[0.35em] uppercase text-amber-300/40 mt-1.5">
                🇺🇸 USA · 🇲🇽 México · 🇨🇦 Canadá · 2026
              </p>
            </div>

            {/* Phase / date badge */}
            {phase ? (
              <span className="text-xs font-black px-4 py-1.5 rounded-full border border-amber-500/35 text-amber-400 bg-amber-500/10 tracking-widest uppercase">
                {PHASE_LABELS[phase] ?? phase}
              </span>
            ) : (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-500/20 text-amber-300/50 bg-amber-500/5 tracking-wider">
                11 Jun – 19 Jul 2026
              </span>
            )}

            {/* Deadline pill */}
            {ctx?.matchday && (
              <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-sm border max-w-full flex-wrap justify-center
                ${ctx.matchday.deadlinePassed
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-amber-500/25 bg-amber-500/8 text-white/70'}`}
              >
                {ctx.matchday.deadlinePassed ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-bold text-red-400">Plazo cerrado</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Deadline: <strong className="text-white">{formatKickoff(ctx.matchday.firstKickoff)}</strong>
                    </span>
                    {countdown && (
                      <span className="ml-1 font-black font-mono text-amber-400 tabular-nums">{countdown}</span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Matchday navigation */}
            {ctx?.matchday && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleMatchdayNav('prev')}
                  disabled={ctx.matchday!.prevNumber === null}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-all
                    border border-amber-500/25 text-amber-400/60
                    hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/45
                    disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  ‹
                </button>
                <span className="text-xs font-black tracking-widest uppercase text-amber-400/60 min-w-[4rem] text-center">
                  J{ctx.matchday!.number}
                </span>
                <button
                  onClick={() => handleMatchdayNav('next')}
                  disabled={ctx.matchday!.nextNumber === null}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-all
                    border border-amber-500/25 text-amber-400/60
                    hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/45
                    disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ TAB NAV ════════════════════════════════════════════════════════ */}
      <div className="border-b border-amber-500/15">
        <div className="max-w-6xl mx-auto px-4 flex">
          {([
            { key: 'picks',     label: '⚽ Picks' },
            { key: 'jugadores', label: '👥 Jugadores' },
            { key: 'historico', label: '🏅 Historial' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 sm:px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap
                ${activeTab === key
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-white/30 hover:text-white/55'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CONTENT ════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[1fr_290px] xl:grid-cols-[1fr_310px] gap-6 sm:gap-8">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Eliminated */}
          {activeTab === 'picks' && isEliminated && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/25 bg-red-500/8">
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-bold text-red-300 text-sm">Has sido eliminado</p>
                {ctx?.participant.eliminatedAtPhase && (
                  <p className="text-xs text-red-400/50 mt-0.5">
                    en {PHASE_LABELS[ctx.participant.eliminatedAtPhase] ?? ctx.participant.eliminatedAtPhase}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── NO DATA FOR NAVIGATED MATCHDAY ── */}
          {activeTab === 'picks' && selectedMatchday !== null && !ctx?.matchday && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="text-4xl font-black text-white/10">J{selectedMatchday}</span>
              <p className="text-sm text-white/30">No hay partidos disponibles para esta jornada.</p>
              <p className="text-xs text-white/20">Puede que aún no esté sincronizada. Intentá con otra.</p>
            </div>
          )}

          {/* ── PRE-TOURNAMENT COUNTDOWN ── */}
          {activeTab === 'picks' && selectedMatchday === null && !ctx?.matchday && (() => {
            const wcStart = new Date('2026-06-11T00:00:00Z');
            const msLeft = wcStart.getTime() - Date.now();
            const daysLeft = Math.ceil(msLeft / 86400000);
            const isBefore = msLeft > 0;
            return (
              <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 text-center border border-amber-500/15 bg-gradient-to-br from-amber-950/40 via-stone-900/30 to-[#0d0b08]">
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(217,119,6,0.15) 0%, transparent 65%)' }}
                />
                <div className="relative space-y-6">
                  <div className="space-y-2">
                    <Trophy className="w-14 h-14 mx-auto text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
                    <p className="text-[11px] font-black tracking-[0.4em] uppercase text-amber-400/40">
                      FIFA World Cup 2026
                    </p>
                  </div>
                  {isBefore ? (
                    <div className="space-y-3">
                      <div
                        className="text-8xl sm:text-9xl font-black font-mono leading-none text-amber-400"
                        style={{ textShadow: '0 0 60px rgba(251,191,36,0.45)' }}
                      >
                        {daysLeft}
                      </div>
                      <p className="text-lg font-bold tracking-widest uppercase text-amber-300/50">
                        {daysLeft === 1 ? 'día' : 'días'} para el pitido inicial
                      </p>
                      <div className="flex justify-center gap-5 text-sm text-white/40">
                        <span>🇺🇸 USA</span>
                        <span>🇲🇽 México</span>
                        <span>🇨🇦 Canadá</span>
                      </div>
                      <p className="text-xs text-white/25 pt-1">
                        Primer partido: <span className="text-white/50 font-semibold">11 Jun 2026</span>
                        {' · '}Podrás hacer tu pick ese día antes del primer partido.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-white/70 font-semibold">No hay partidos hoy</p>
                      <p className="text-sm text-white/35">Volvé mañana para los próximos partidos.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── MY PICK ── */}
          {activeTab === 'picks' && ctx?.myPick?.team && (() => {
            const cfg = PICK_STATUS_CONFIG[ctx.myPick!.status];
            return (
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <img src={ctx.myPick.team.logoUrl} alt={ctx.myPick.team.name} className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black tracking-widest uppercase text-amber-400/50 mb-1">Tu pick de hoy</p>
                  <p className="font-bold text-sm truncate text-white">{ctx.myPick.team.name}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border
                      ${ctx.myPick.pickType === 'WIN_OR_DRAW'
                        ? 'text-sky-400 bg-sky-500/10 border-sky-500/25'
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/25'}`}
                    >
                      {ctx.myPick.pickType === 'WIN_OR_DRAW' ? '🤝 Empata' : '🏆 Gana'}
                    </span>
                    {cfg && (
                      <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── MATCH CARDS ── */}
          {activeTab === 'picks' && Object.entries(matchesByGroup).map(([groupKey, gMatches]) => (
            <div key={groupKey} className="space-y-3">

              {/* Group section header */}
              <div className="flex items-center gap-3 pt-1">
                <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-transparent shrink-0" />
                <span className="text-xs font-black tracking-widest uppercase text-amber-400">
                  {isGroupStage ? `Grupo ${groupKey}` : (PHASE_LABELS[groupKey] ?? groupKey)}
                </span>
                <div className="flex-1 h-px bg-amber-500/15" />
              </div>

              {gMatches.map((m) => {
                const deadlinePassed = ctx?.matchday?.deadlinePassed ?? true;
                const canPick = !deadlinePassed && !isEliminated;
                const isMyPickHome = ctx?.myPick?.team?.id === m.homeTeam.id;
                const isMyPickAway = ctx?.myPick?.team?.id === m.awayTeam.id;
                const hasMyPick = isMyPickHome || isMyPickAway;

                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl overflow-hidden transition-all
                      ${hasMyPick
                        ? 'border border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-stone-900/80 shadow-[0_0_30px_rgba(217,119,6,0.1)]'
                        : 'border border-white/8 bg-gradient-to-br from-stone-900/60 to-neutral-900/80'}`}
                  >
                    {/* Match meta */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
                      <span className="font-mono text-xs text-white/35">{formatKickoff(m.kickoffTime)}</span>
                      {m.status === 'LIVE' && (
                        <span className="flex items-center gap-1.5 text-xs font-black text-red-400">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                          EN VIVO
                        </span>
                      )}
                      {m.status === 'FINISHED' && (
                        <span className="text-[11px] font-bold text-white/25 tracking-widest">FINALIZADO</span>
                      )}
                      {m.status !== 'LIVE' && m.status !== 'FINISHED' && (
                        <span className="text-[10px] text-amber-400/30 font-bold tracking-wider uppercase">
                          {isGroupStage ? `GRP ${m.wcGroup ?? ''}` : (PHASE_LABELS[m.tournamentPhase ?? ''] ?? '')}
                        </span>
                      )}
                    </div>

                    {/* Teams + score */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-5 px-4 py-5">
                      <TeamSection
                        team={m.homeTeam} used={m.homeUsed}
                        isMyPick={isMyPickHome}
                        myPickType={isMyPickHome ? ctx?.myPick?.pickType : undefined}
                        canPick={canPick && !m.homeUsed}
                        isSelected={selectedTeamId === m.homeTeam.id}
                        isOtherSelected={selectedTeamId !== null && selectedTeamId !== m.homeTeam.id}
                        onSelect={() => handleSelectTeam(m.homeTeam.id)}
                        loadingWin={picking === `${m.homeTeam.id}-WIN`}
                        loadingDraw={picking === `${m.homeTeam.id}-WIN_OR_DRAW`}
                        onPickWin={() => handlePick(m.homeTeam.id, 'WIN')}
                        onPickDraw={() => handlePick(m.homeTeam.id, 'WIN_OR_DRAW')}
                        align="left"
                      />

                      {/* Score / VS */}
                      <div className="text-center shrink-0 min-w-[2.5rem] self-center">
                        {m.status === 'FINISHED' || m.status === 'LIVE' ? (
                          <span className={`text-2xl sm:text-3xl font-black font-mono
                            ${m.status === 'LIVE' ? 'text-red-400' : 'text-white'}`}
                          >
                            {m.homeScore ?? 0}–{m.awayScore ?? 0}
                          </span>
                        ) : (
                          <span className="text-sm font-black text-white/15 tracking-widest">VS</span>
                        )}
                      </div>

                      <TeamSection
                        team={m.awayTeam} used={m.awayUsed}
                        isMyPick={isMyPickAway}
                        myPickType={isMyPickAway ? ctx?.myPick?.pickType : undefined}
                        canPick={canPick && !m.awayUsed}
                        isSelected={selectedTeamId === m.awayTeam.id}
                        isOtherSelected={selectedTeamId !== null && selectedTeamId !== m.awayTeam.id}
                        onSelect={() => handleSelectTeam(m.awayTeam.id)}
                        loadingWin={picking === `${m.awayTeam.id}-WIN`}
                        loadingDraw={picking === `${m.awayTeam.id}-WIN_OR_DRAW`}
                        onPickWin={() => handlePick(m.awayTeam.id, 'WIN')}
                        onPickDraw={() => handlePick(m.awayTeam.id, 'WIN_OR_DRAW')}
                        align="right"
                      />
                    </div>


                    {/* Gold bottom bar when picked */}
                    {hasMyPick && (
                      <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* ── JUGADORES TAB ─────────────────────────────────────────── */}
          {activeTab === 'jugadores' && (
            <ParticipantsList participants={participants} loading={participantsLoading} phaseLabels={PHASE_LABELS} />
          )}

          {/* ── HISTORIAL TAB ─────────────────────────────────────────── */}
          {activeTab === 'historico' && (
            <EditionHistoryList
              entries={history}
              loading={historyLoading}
              expandedId={expandedHistoryId}
              onToggle={handleHistoryToggle}
              details={editionDetails}
              detailLoadingId={detailLoadingId}
            />
          )}

          {/* ── GRUPOS MOBILE ─────────────────────────────────────────── */}
          {activeTab === 'picks' && groups.length > 0 && (
            <div className="lg:hidden space-y-4 pt-3">
              {/* Section title */}
              <div className="flex items-center gap-3">
                <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-transparent shrink-0" />
                <span className="text-xs font-black tracking-widest uppercase text-amber-400">
                  {isGroupStage ? 'Clasificación' : 'Equipos por grupo'}
                </span>
                <div className="flex-1 h-px bg-amber-500/15" />
              </div>

              {/* Scrollable group tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {groups.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => setActiveGroup(activeGroup === g.name ? null : g.name)}
                    className={`shrink-0 w-11 h-11 rounded-xl text-sm font-black transition-all
                      ${activeGroup === g.name
                        ? 'bg-amber-400 text-black shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                        : 'bg-white/5 text-amber-400/60 border border-amber-500/15 hover:bg-white/8'}`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>

              {/* Active group table */}
              {activeGroupData && <GroupTable group={activeGroupData} />}
            </div>
          )}
        </div>

        {/* ── DESKTOP SIDEBAR ──────────────────────────────────────────── */}
        {groups.length > 0 && (
          <aside className="hidden lg:flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-0.5 h-4 rounded-full bg-gradient-to-b from-amber-400 to-transparent shrink-0" />
              <span className="text-xs font-black tracking-widest uppercase text-amber-400">
                {isGroupStage ? 'Clasificación' : 'Grupos'}
              </span>
            </div>

            {/* Group tabs */}
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <button
                  key={g.name}
                  onClick={() => setActiveGroup(activeGroup === g.name ? null : g.name)}
                  className={`w-9 h-9 rounded-lg text-xs font-black transition-all
                    ${activeGroup === g.name
                      ? 'bg-amber-400 text-black shadow-[0_0_14px_rgba(251,191,36,0.35)]'
                      : 'bg-white/5 text-amber-400/55 border border-amber-500/12 hover:bg-white/8'}`}
                >
                  {g.name}
                </button>
              ))}
            </div>

            {/* Table */}
            {activeGroupData
              ? <GroupTable group={activeGroupData} />
              : groups.slice(0, 4).map((g) => <GroupTable key={g.name} group={g} />)
            }
          </aside>
        )}
      </div>

      {/* Pick bottom sheet */}
      {globalCanPick && selectedTeamId && selectedTeam && (
        <>
          {/* Backdrop — stops above the bottom nav so nav buttons stay tappable */}
          <div
            className="fixed inset-x-0 top-0 z-[60] bg-black/60"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
            onClick={() => setSelectedTeamId(null)}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-[#13151a] rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            {/* Team header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8">
              <img src={selectedTeam.logoUrl} alt={selectedTeam.name} className="w-10 h-10 object-contain shrink-0" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Tu pick</p>
                <p className="text-lg font-black text-white leading-tight">{selectedTeam.name}</p>
              </div>
              <button
                onClick={() => setSelectedTeamId(null)}
                className="ml-auto w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
              >
                ✕
              </button>
            </div>
            {/* Pick options */}
            <div className="px-6 pt-5 pb-2 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-white/30 text-center">¿Cómo va a quedar?</p>
              <button
                onClick={() => handlePick(selectedTeamId, 'WIN')}
                disabled={!!picking}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-base text-amber-400 bg-amber-500/12 border border-amber-500/35 active:scale-[0.98] disabled:opacity-40 transition-all"
              >
                <span className="text-xl">🏆</span>
                <span>{picking === `${selectedTeamId}-WIN` ? 'Guardando…' : 'Gana'}</span>
              </button>
              <button
                onClick={() => handlePick(selectedTeamId, 'WIN_OR_DRAW')}
                disabled={!!picking}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-base text-sky-400 bg-sky-500/10 border border-sky-500/30 active:scale-[0.98] disabled:opacity-40 transition-all"
              >
                <span className="text-xl">🤝</span>
                <span>{picking === `${selectedTeamId}-WIN_OR_DRAW` ? 'Guardando…' : 'Empata'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      <MobileBottomNav />
    </div>
  );
}

// ── ParticipantsList ───────────────────────────────────────────────────────

const PARTICIPANT_PICK_STATUS: Record<string, { label: string; cls: string }> = {
  SURVIVED:           { label: 'Sobrevivió', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  DRAW_ELIMINATED:    { label: 'Eliminado · empate', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  LOSS_ELIMINATED:    { label: 'Eliminado · derrota', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  NO_PICK_ELIMINATED: { label: 'Sin pick', cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  PENDING:            { label: 'Pendiente', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  POSTPONED_PENDING:  { label: 'Aplazado', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/25' },
};

function ParticipantsList({ participants, loading, phaseLabels }: {
  participants: Participant[];
  loading: boolean;
  phaseLabels: Record<string, string>;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/30 text-xs font-black tracking-widest uppercase">
        Cargando jugadores…
      </div>
    );
  }

  const alive = participants.filter((p) => p.status !== 'ELIMINATED');
  const eliminated = participants.filter((p) => p.status === 'ELIMINATED');

  const renderRow = (p: Participant, i: number) => {
    const pickSt = p.lastPick?.pickStatus ? PARTICIPANT_PICK_STATUS[p.lastPick.pickStatus] : null;
    return (
      <div
        key={p.alias}
        className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors
          ${p.status === 'ELIMINATED' ? 'opacity-50' : ''}`}
      >
        <span className="w-5 text-[11px] font-black text-white/20 shrink-0 text-right">{i + 1}</span>
        <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <span className="text-xs font-black text-amber-400">{p.alias[0]?.toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white/90 truncate block">{p.alias}</span>
          {p.status === 'ELIMINATED' && p.eliminatedAtPhase && (
            <span className="text-[10px] text-red-400/50">
              {phaseLabels[p.eliminatedAtPhase] ?? p.eliminatedAtPhase}
            </span>
          )}
        </div>
        {p.lastPick && (pickSt || p.lastPick.team) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {p.lastPick.team && (
              <img src={p.lastPick.team.logoUrl} alt={p.lastPick.team.name} className="w-5 h-5 object-contain" />
            )}
            {pickSt && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${pickSt.cls}`}>
                {pickSt.label}
              </span>
            )}
          </div>
        )}
        <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full border
          ${p.status === 'ELIMINATED'
            ? 'text-red-400/60 bg-red-500/8 border-red-500/20'
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}
        >
          {p.status === 'ELIMINATED' ? '✕' : '✓'}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {alive.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-transparent shrink-0" />
            <span className="text-xs font-black tracking-widest uppercase text-emerald-400">
              En pie · {alive.length}
            </span>
            <div className="flex-1 h-px bg-emerald-500/15" />
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            {alive.map((p, i) => renderRow(p, i))}
          </div>
        </div>
      )}
      {eliminated.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-red-400 to-transparent shrink-0" />
            <span className="text-xs font-black tracking-widest uppercase text-red-400/70">
              Eliminados · {eliminated.length}
            </span>
            <div className="flex-1 h-px bg-red-500/10" />
          </div>
          <div className="overflow-hidden rounded-xl border border-white/8">
            {eliminated.map((p, i) => renderRow(p, i))}
          </div>
        </div>
      )}
      {participants.length === 0 && (
        <div className="text-center py-10 text-white/25 text-sm">
          No hay jugadores en esta edición todavía.
        </div>
      )}
    </div>
  );
}

// ── EditionHistoryList ─────────────────────────────────────────────────────

const PICK_STATUS_COMPACT: Record<string, { label: string; cls: string }> = {
  SURVIVED:           { label: 'Sobrevivió', cls: 'text-emerald-400' },
  DRAW_ELIMINATED:    { label: 'Empate · elim.', cls: 'text-red-400' },
  LOSS_ELIMINATED:    { label: 'Derrota · elim.', cls: 'text-red-400' },
  NO_PICK_ELIMINATED: { label: 'Sin pick · elim.', cls: 'text-red-400/60' },
  PENDING:            { label: 'Pendiente', cls: 'text-amber-400' },
};

function EditionHistoryList({
  entries, loading, expandedId, onToggle, details, detailLoadingId,
}: {
  entries: EditionHistoryEntry[];
  loading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
  details: Record<string, EditionDetail>;
  detailLoadingId: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/30 text-xs font-black tracking-widest uppercase">
        Cargando historial…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-white/25 text-sm">
        Todavía no hay ediciones finalizadas en este campeonato.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-transparent shrink-0" />
        <span className="text-xs font-black tracking-widest uppercase text-amber-400">
          Historial de campeones
        </span>
        <div className="flex-1 h-px bg-amber-500/15" />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        {entries.map((e, i) => {
          const date = e.finishedAt
            ? new Date(e.finishedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
          const isFirst = i === 0;
          const isExpanded = expandedId === e.id;
          const detail = details[e.id];
          const isLoadingDetail = detailLoadingId === e.id;

          return (
            <div key={e.id} className="border-b border-white/5 last:border-0">
              {/* Header row — clickable */}
              <button
                onClick={() => onToggle(e.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors
                  ${isFirst ? 'bg-amber-500/5' : ''}
                  ${isExpanded ? 'bg-white/4' : 'hover:bg-white/3'}`}
              >
                {/* Position badge */}
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black
                  ${isFirst
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-white/5 text-white/20 border border-white/8'}`}
                >
                  {entries.length - i}
                </span>

                {/* Edition name */}
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-black uppercase tracking-widest
                    ${isFirst ? 'text-amber-300' : 'text-white/50'}`}
                  >
                    {e.name}
                  </span>
                  <div className="text-[10px] text-white/25 mt-0.5">
                    {e.participantCount} jugadores · {date}
                  </div>
                </div>

                {/* Winner */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {e.winnerAlias ? (
                    <>
                      <Trophy className={`w-3.5 h-3.5 shrink-0 ${isFirst ? 'text-amber-400' : 'text-white/30'}`} />
                      <span className={`text-xs font-bold ${isFirst ? 'text-amber-200' : 'text-white/60'}`}>
                        {e.winnerAlias}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-white/20 italic">Sin ganador</span>
                  )}
                </div>

                {/* Chevron */}
                <span className={`shrink-0 text-white/20 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {/* Detail accordion */}
              {isExpanded && (
                <div className="px-4 pb-4 bg-black/20 border-t border-white/5">
                  {isLoadingDetail && !detail && (
                    <div className="py-4 text-center text-white/25 text-xs">Cargando…</div>
                  )}
                  {detail && (
                    <div className="space-y-3 pt-3">
                      {detail.participants.map((p) => {
                        const isWinner = p.alias === detail.edition.winnerAlias;
                        return (
                          <div key={p.alias} className={`rounded-lg border ${isWinner ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/8 bg-white/3'}`}>
                            {/* Participant header */}
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
                              {isWinner && <Trophy className="w-3 h-3 text-amber-400 shrink-0" />}
                              <span className={`text-xs font-black uppercase tracking-wider flex-1 ${isWinner ? 'text-amber-300' : 'text-white/60'}`}>
                                {p.alias}
                              </span>
                              <span className={`text-[10px] ${p.status === 'ACTIVE' ? 'text-emerald-400' : 'text-white/25'}`}>
                                {p.status === 'ACTIVE' ? 'Activo' : 'Eliminado'}
                              </span>
                            </div>

                            {/* Picks per day */}
                            {p.picks.length === 0 ? (
                              <div className="px-3 py-2.5 text-[11px] text-white/25 italic">Sin picks registrados</div>
                            ) : (
                              <div>
                                {p.picks.map((pk) => {
                                  const cfg = PICK_STATUS_COMPACT[pk.pickStatus] ?? { label: pk.pickStatus, cls: 'text-white/40' };
                                  return (
                                    <div key={pk.matchdayNumber} className="flex items-center gap-2.5 px-3 py-2 border-b border-white/4 last:border-0">
                                      <span className="text-[10px] text-white/20 font-black w-8 shrink-0">D{pk.matchdayNumber}</span>
                                      {pk.team ? (
                                        <>
                                          <img src={pk.team.logoUrl} alt={pk.team.name} className="w-4 h-4 object-contain shrink-0" />
                                          <span className="flex-1 text-xs text-white/60 truncate">{pk.team.name}</span>
                                        </>
                                      ) : (
                                        <span className="flex-1 text-xs text-white/25 italic">Sin equipo</span>
                                      )}
                                      <span className={`text-[10px] font-semibold shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TeamSection ────────────────────────────────────────────────────────────

function TeamSection({
  team, used, isMyPick, myPickType, canPick,
  isSelected, isOtherSelected, onSelect,
  loadingWin, loadingDraw, onPickWin, onPickDraw, align,
}: {
  team: Team; used: boolean; isMyPick: boolean;
  myPickType?: 'WIN' | 'WIN_OR_DRAW'; canPick: boolean;
  isSelected: boolean; isOtherSelected: boolean; onSelect: () => void;
  loadingWin: boolean; loadingDraw: boolean;
  onPickWin: () => void; onPickDraw: () => void;
  align: 'left' | 'right';
}) {
  const isRight = align === 'right';
  const clickable = canPick && !used;
  const dimmed = (used && !isMyPick) || (isOtherSelected && !isSelected);

  return (
    <div className={`flex flex-col gap-2.5 min-w-0 transition-opacity ${dimmed ? 'opacity-35' : 'opacity-100'} ${isRight ? 'items-end' : 'items-start'}`}>

      {/* Logo + name — clickable to select when canPick */}
      <button
        type="button"
        disabled={!clickable}
        onClick={clickable ? onSelect : undefined}
        className={`flex items-center gap-2 sm:gap-2.5 rounded-xl transition-all
          ${isRight ? 'flex-row-reverse' : ''}
          ${clickable ? 'cursor-pointer active:scale-95' : 'cursor-default pointer-events-none'}`}
      >
        <div className={`relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all
          ${isMyPick
            ? 'bg-amber-500/15 shadow-[0_0_20px_rgba(251,191,36,0.35),inset_0_0_0_1.5px_rgba(251,191,36,0.5)]'
            : isSelected
              ? 'bg-sky-500/15 shadow-[0_0_18px_rgba(14,165,233,0.35),inset_0_0_0_1.5px_rgba(14,165,233,0.5)]'
              : used
                ? 'bg-white/3'
                : 'bg-white/5 hover:bg-white/10'}`}
        >
          <img
            src={team.logoUrl}
            alt={team.name}
            className={`w-8 h-8 sm:w-10 sm:h-10 object-contain transition-all ${used && !isMyPick ? 'grayscale' : ''}`}
          />
          {/* Tap-to-select hint ring */}
          {clickable && !isSelected && (
            <span className="absolute inset-0 rounded-xl ring-1 ring-white/10 group-hover:ring-amber-400/30 transition-all" />
          )}
        </div>
        <span className={`text-xs sm:text-sm font-bold leading-tight max-w-[72px] sm:max-w-[95px] break-words
          ${isRight ? 'text-right' : 'text-left'}
          ${used && !isMyPick ? 'text-white/20' : isSelected ? 'text-sky-200' : 'text-white/90'}`}
        >
          {team.name}
        </span>
      </button>

      {/* Status indicators (no pick-action buttons here — those live in the match-card panel) */}
      {isMyPick ? (
        <div className={`flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
          <span className="flex items-center gap-1 text-[11px] font-black text-amber-400">
            <Shield className="w-3 h-3" /> Tu pick
          </span>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold
            ${myPickType === 'WIN_OR_DRAW'
              ? 'text-sky-400 bg-sky-500/15'
              : 'text-amber-400 bg-amber-500/15'}`}
          >
            {myPickType === 'WIN_OR_DRAW' ? '🤝 Empata' : '🏆 Gana'}
          </span>
          {canPick && !isSelected && (
            <button
              onClick={onSelect}
              className="text-[10px] text-white/25 hover:text-amber-400/60 transition-colors mt-0.5 font-semibold"
            >
              Cambiar tipo
            </button>
          )}
        </div>
      ) : used ? (
        <span className="text-[10px] font-medium text-white/20">Usado</span>
      ) : canPick && !isSelected && !isOtherSelected ? (
        <span className="text-[10px] text-white/20 font-medium">Toca para elegir</span>
      ) : null}
    </div>
  );
}
