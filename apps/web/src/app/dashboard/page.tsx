'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, Clock, Globe, LayoutGrid, Moon, Plus, Shield, Sun, Trophy, Users, X, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

// ── Types ──────────────────────────────────────────────────────────────────

type Edition = { id: string; status: string; startMatchday: number };
type Championship = {
  id: string;
  name: string;
  mode: 'TOURNAMENT' | 'LEAGUE' | 'WORLD_CUP';
  adminId: string;
  editions: Edition[];
};

type ActiveEdition = {
  editionId: string;
  championshipId: string;
  championshipName: string;
  mode: 'TOURNAMENT' | 'LEAGUE' | 'WORLD_CUP';
  adminId: string;
};

// WC types
type Team = { id: string; name: string; logoUrl: string };
type WcMatch = {
  id: string; status: string; kickoffTime: string | null;
  homeScore: number | null; awayScore: number | null;
  wcGroup: string | null; tournamentPhase: string | null;
  homeTeam: Team; awayTeam: Team;
  homeUsed: boolean; awayUsed: boolean;
};
type WcTodayCtx = {
  championshipName: string;
  matchday: {
    id: string; number: number; status: string;
    tournamentPhase: string | null; wcGroupDay: number | null;
    firstKickoff: string | null; deadlinePassed: boolean;
    prevNumber: number | null; nextNumber: number | null;
  } | null;
  matches: WcMatch[];
  myPick: { id: string; status: string; pickType: 'WIN' | 'WIN_OR_DRAW'; team: Team | null } | null;
  participant: { status: string; eliminatedAtPhase: string | null };
};

// League / Tournament types
type LeagueMatch = {
  id: string; status: string; kickoffTime: string | null;
  homeScore: number | null; awayScore: number | null;
  homeTeam: Team; awayTeam: Team;
};
type LeagueDeadline = {
  matchdayNumber: number | null;
  firstKickoff: string | null;
  matchdayStatus: string | null;
};
type LeaguePick = {
  status: string;
  team: { id: string; name: string; logoUrl: string } | null;
  participant: { user: { alias: string } };
  matchday: { number: number; status: string };
};

// Participants
type WcParticipant = {
  alias: string; status: string;
  eliminatedAtPhase: string | null;
  lastPick: { team: { name: string; logoUrl: string }; pickStatus: string } | null;
};
type LeagueStanding = {
  participantId: string; alias: string; status: string;
  eliminatedAtMatchday: number | null; totalPoints: number;
};

// History
type EditionHistoryEntry = {
  id: string; name: string; finishedAt: string | null;
  winnerAlias: string | null; participantCount: number;
};
type EditionPickDetail = {
  matchdayNumber: number;
  team: { name: string; logoUrl: string } | null;
  pickStatus: string;
};
type EditionDetail = {
  edition: { id: string; name: string; finishedAt: string | null; winnerAlias: string | null };
  participants: { alias: string; status: string; picks: EditionPickDetail[] }[];
};

// Calendar
type CalMatch = {
  id: string; status: string; kickoffTime: string | null;
  homeScore: number | null; awayScore: number | null;
  wcGroup: string | null; tournamentPhase: string | null;
  homeTeam: Team; awayTeam: Team;
};
type CalMatchday = {
  number: number; status: string;
  tournamentPhase: string | null; wcGroupDay: number | null;
  firstKickoff: string | null;
  matches: CalMatch[];
};

// Notifications
type NotifItem = { id: string; type: string; createdAt: string; read: boolean; payload?: Record<string, unknown> };

// ── Theme context ──────────────────────────────────────────────────────────

const IsLightCtx = createContext(false);
const useIsLight = () => useContext(IsLightCtx);

// ── Constants ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Fase de Grupos', ROUND_OF_32: 'Ronda de 32',
  ROUND_OF_16: 'Octavos', QUARTER_FINALS: 'Cuartos',
  SEMI_FINALS: 'Semifinales', THIRD_PLACE: 'Tercer Puesto', FINAL: 'Final',
};

const PICK_STATUS_COMPACT: Record<string, { label: string; cls: string; icon?: React.ReactNode }> = {
  SURVIVED:           { label: 'Sobrevivió', cls: 'text-emerald-400', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  DRAW_ELIMINATED:    { label: 'Empate · elim.', cls: 'text-red-400', icon: <XCircle className="w-3.5 h-3.5" /> },
  LOSS_ELIMINATED:    { label: 'Derrota · elim.', cls: 'text-red-400', icon: <XCircle className="w-3.5 h-3.5" /> },
  NO_PICK_ELIMINATED: { label: 'Sin pick', cls: 'text-red-400/70', icon: <XCircle className="w-3.5 h-3.5" /> },
  PENDING:            { label: 'Pendiente', cls: 'text-amber-400', icon: <Clock className="w-3.5 h-3.5" /> },
  POSTPONED_PENDING:  { label: 'Aplazado', cls: 'text-sky-400', icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Cerrado';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatKickoff(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Editions
  const [activeEditions, setActiveEditions] = useState<ActiveEdition[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<ActiveEdition | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [fetchingEditions, setFetchingEditions] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'pick' | 'jugadores' | 'historial' | 'calendario'>('pick');

  // WC pick tab
  const [wcCtx, setWcCtx] = useState<WcTodayCtx | null>(null);
  const [wcLoading, setWcLoading] = useState(false);
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');

  // League/Tournament pick tab
  const [leagueDeadline, setLeagueDeadline] = useState<LeagueDeadline | null>(null);
  const [leagueMatches, setLeagueMatches] = useState<LeagueMatch[]>([]);
  const [leagueMyPick, setLeagueMyPick] = useState<LeaguePick | null>(null);
  const [leaguePickLoading, setLeaguePickLoading] = useState(false);
  const [leaguePickingTeamId, setLeaguePickingTeamId] = useState<string | null>(null);
  const [leagueSelectedTeamId, setLeagueSelectedTeamId] = useState<string | null>(null);

  // Players tab
  const [wcParticipants, setWcParticipants] = useState<WcParticipant[]>([]);
  const [leagueStandings, setLeagueStandings] = useState<LeagueStanding[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsFetched, setParticipantsFetched] = useState(false);

  // Calendar tab
  const [calendar, setCalendar] = useState<CalMatchday[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarFetched, setCalendarFetched] = useState(false);

  // History tab
  const [history, setHistory] = useState<EditionHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [editionDetails, setEditionDetails] = useState<Record<string, EditionDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  // Notifications
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [deletingNotifId, setDeletingNotifId] = useState<string | null>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  // Theme
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    if (localStorage.getItem('ps-theme') === 'light') setIsLight(true);
  }, []);
  function toggleTheme() {
    setIsLight((prev) => {
      const next = !prev;
      localStorage.setItem('ps-theme', next ? 'light' : 'dark');
      return next;
    });
  }

  // ── Load active editions ──────────────────────────────────────────────────

  useEffect(() => {
    if (loading || !user) return;
    fetch('/api/championships')
      .then((r) => r.json())
      .then((data: Championship[]) => {
        if (!Array.isArray(data)) return;
        const active: ActiveEdition[] = [];
        for (const c of data) {
          const e = c.editions?.find((e) => e.status === 'ACTIVE');
          if (e) active.push({ editionId: e.id, championshipId: c.id, championshipName: c.name, mode: c.mode, adminId: c.adminId });
        }
        setActiveEditions(active);
        // Auto-enter if only one active edition
        if (active.length === 1) setSelectedEdition(active[0]);
      })
      .catch(() => {})
      .finally(() => setFetchingEditions(false));
  }, [loading, user]);

  const selected = selectedEdition;
  const isWc = selected?.mode === 'WORLD_CUP';
  const isLeague = selected?.mode === 'LEAGUE' || selected?.mode === 'TOURNAMENT';

  // ── WC pick data ──────────────────────────────────────────────────────────

  const loadWcData = useCallback(async (editionId: string, matchdayNum?: number) => {
    setWcLoading(true);
    const q = matchdayNum ? `?matchday=${matchdayNum}` : '';
    try {
      const res = await fetch(`/api/wc/editions/${editionId}/today${q}`);
      if (res.ok) setWcCtx(await res.json());
    } finally { setWcLoading(false); }
  }, []);

  // Reset and reload when selected edition changes
  useEffect(() => {
    if (!selected) return;
    setActiveTab('pick');
    setParticipantsFetched(false);
    setHistoryFetched(false);
    setHistory([]);
    setCalendarFetched(false);
    setCalendar([]);
    setWcCtx(null);
    setLeagueDeadline(null);
    setLeagueMatches([]);
    setLeagueMyPick(null);
    setSelectedMatchday(null);
    setSelectedTeamId(null);
    setLeagueSelectedTeamId(null);

    if (isWc) {
      loadWcData(selected.editionId);
    } else {
      loadLeaguePickTab(selected.editionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.editionId]);

  // ── League pick data ──────────────────────────────────────────────────────

  async function loadLeaguePickTab(editionId: string) {
    setLeaguePickLoading(true);
    try {
      const deadlineRes = await fetch(`/api/editions/${editionId}/deadline`);
      const deadline: LeagueDeadline = await deadlineRes.json();
      setLeagueDeadline(deadline);
      const md = deadline.matchdayNumber;
      if (!md) return;
      const [matchesRes, pickRes] = await Promise.all([
        fetch(`/api/editions/${editionId}/matches?matchday=${md}`),
        fetch(`/api/editions/${editionId}/picks?matchday=${md}`),
      ]);
      if (matchesRes.ok) setLeagueMatches(await matchesRes.json());
      if (pickRes.ok) { const d = await pickRes.json(); setLeagueMyPick(d?.myPick ?? null); }
    } catch { /* ignore */ }
    finally { setLeaguePickLoading(false); }
  }

  // ── WC countdown ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!wcCtx?.matchday?.firstKickoff) return;
    const kickoff = wcCtx.matchday.firstKickoff;
    setCountdown(formatCountdown(kickoff));
    const id = setInterval(() => setCountdown(formatCountdown(kickoff)), 1000);
    return () => clearInterval(id);
  }, [wcCtx?.matchday?.firstKickoff]);

  // ── Players tab ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selected || activeTab !== 'jugadores' || participantsFetched) return;
    setParticipantsLoading(true);
    const url = isWc
      ? `/api/wc/editions/${selected.editionId}/participants`
      : `/api/editions/${selected.editionId}/standings`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (isWc) setWcParticipants(Array.isArray(data) ? data : []);
        else setLeagueStandings(Array.isArray(data) ? data : []);
        setParticipantsFetched(true);
      })
      .catch(() => setParticipantsFetched(true))
      .finally(() => setParticipantsLoading(false));
  }, [activeTab, selected, isWc, participantsFetched]);

  // ── Calendar tab ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selected || activeTab !== 'calendario' || calendarFetched || !isWc) return;
    setCalendarLoading(true);
    fetch(`/api/wc/editions/${selected.editionId}/calendar`)
      .then((r) => r.json())
      .then((data) => { setCalendar(Array.isArray(data) ? data : []); setCalendarFetched(true); })
      .catch(() => setCalendarFetched(true))
      .finally(() => setCalendarLoading(false));
  }, [activeTab, selected, isWc, calendarFetched]);

  // ── History tab ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selected || activeTab !== 'historial' || historyFetched) return;
    if (!isWc) return;
    setHistoryLoading(true);
    fetch(`/api/wc/editions/${selected.editionId}/history`)
      .then((r) => r.json())
      .then((data) => { setHistory(Array.isArray(data) ? data : []); setHistoryFetched(true); })
      .catch(() => setHistoryFetched(true))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, selected, isWc, historyFetched]);

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

  // ── WC pick handlers ──────────────────────────────────────────────────────

  async function handleWcPick(teamId: string, pickType: 'WIN' | 'WIN_OR_DRAW') {
    if (!wcCtx?.matchday || wcCtx.matchday.deadlinePassed || !selected) return;
    setPicking(`${teamId}-${pickType}`);
    try {
      const res = await fetch(`/api/editions/${selected.editionId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, matchdayNumber: wcCtx.matchday.number, pickType }),
      });
      if (res.ok) {
        setSelectedTeamId(null);
        await loadWcData(selected.editionId, selectedMatchday ?? undefined);
      }
    } finally { setPicking(null); }
  }

  function handleWcNav(dir: 'prev' | 'next') {
    const target = dir === 'prev' ? wcCtx?.matchday?.prevNumber : wcCtx?.matchday?.nextNumber;
    if (!target || !selected) return;
    setSelectedMatchday(target);
    setSelectedTeamId(null);
    loadWcData(selected.editionId, target);
  }

  // ── League pick handler ───────────────────────────────────────────────────

  async function handleLeaguePick(teamId: string) {
    if (!selected || !leagueDeadline?.matchdayNumber) return;
    const firstKickoff = leagueDeadline.firstKickoff;
    if (firstKickoff && new Date(firstKickoff).getTime() <= Date.now()) return;
    setLeaguePickingTeamId(teamId);
    try {
      const res = await fetch(`/api/editions/${selected.editionId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, matchdayNumber: leagueDeadline.matchdayNumber }),
      });
      if (res.ok) {
        setLeagueSelectedTeamId(null);
        await loadLeaguePickTab(selected.editionId);
      }
    } finally { setLeaguePickingTeamId(null); }
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => setNotifs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  async function openNotifications() {
    setNotifsOpen(true);
    setNotifsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) setNotifs(await res.json());
    } finally { setNotifsLoading(false); }
    // mark all read
    fetch('/api/notifications/mark-all-read', { method: 'POST' }).then(() => {
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    }).catch(() => {});
  }

  async function deleteNotif(id: string) {
    setDeletingNotifId(id);
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } finally { setDeletingNotifId(null); }
  }

  const unreadCount = notifs.filter((n) => !n.read).length;

  // ── Auth redirect ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // ── Loading ───────────────────────────────────────────────────────────────

  // Derived: team name for the fixed pick confirmation panel
  const selectedWcTeamName = selectedTeamId && wcCtx?.matches
    ? (wcCtx.matches.find(m => m.homeTeam.id === selectedTeamId)?.homeTeam.name
       ?? wcCtx.matches.find(m => m.awayTeam.id === selectedTeamId)?.awayTeam.name ?? '')
    : '';
  const selectedLeagueTeamName = leagueSelectedTeamId
    ? (leagueMatches.find(m => m.homeTeam.id === leagueSelectedTeamId)?.homeTeam.name
       ?? leagueMatches.find(m => m.awayTeam.id === leagueSelectedTeamId)?.awayTeam.name ?? '')
    : '';

  if (loading || fetchingEditions) {
    return (
      <IsLightCtx.Provider value={isLight}>
        <div className={`flex items-center justify-center min-h-screen ${isLight ? 'bg-slate-100' : 'bg-[#06090f]'}`}>
          <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
        </div>
      </IsLightCtx.Provider>
    );
  }

  // ── Welcome (no selected edition) ─────────────────────────────────────────

  if (!selectedEdition) {
    return (
      <IsLightCtx.Provider value={isLight}>
        <WelcomeScreen
          editions={activeEditions}
          onSelect={setSelectedEdition}
          user={user}
          onLogout={() => { logout(); router.replace('/login'); }}
          toggleTheme={toggleTheme}
        />
      </IsLightCtx.Provider>
    );
  }

  // ── Competition view ──────────────────────────────────────────────────────

  const isAdminViewer = isWc && wcCtx?.participant?.status === 'ADMIN_VIEW';
  const isEliminated = isWc
    ? wcCtx?.participant?.status === 'ELIMINATED'
    : false;

  return (
    <IsLightCtx.Provider value={isLight}>
    <div className={`h-[100dvh] flex flex-col overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#06090f]'}`}>

      {/* ══ STICKY HEADER ══════════════════════════════════════════════════ */}
      <header className={`sticky top-0 z-30 backdrop-blur-xl border-b ${isLight ? 'bg-white/96 border-slate-200' : 'bg-[#06090f]/97 border-white/[0.06]'}`}>
        <div className="pt-[env(safe-area-inset-top,0px)]">

          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 h-13 py-2.5">
            {/* Selector de campeonato */}
            {activeEditions.length > 1 ? (
              <button
                onClick={() => setShowSwitcher(true)}
                className={`flex items-center gap-2 min-w-0 flex-1 text-left ${isLight ? '' : ''}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isLight ? 'bg-slate-100' : 'bg-white/8'}`}>
                  {selected?.mode === 'WORLD_CUP'
                    ? <Globe className="w-3.5 h-3.5 text-amber-400" />
                    : <Trophy className={`w-3.5 h-3.5 ${isLight ? 'text-slate-400' : 'text-amber-500/60'}`} />}
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] font-medium leading-none mb-0.5 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Competición activa</p>
                  <p className={`text-sm font-bold truncate leading-tight ${isLight ? 'text-slate-800' : 'text-white/85'}`}>{selected?.championshipName}</p>
                </div>
                <LayoutGrid className={`w-3.5 h-3.5 shrink-0 ml-1 ${isLight ? 'text-slate-300' : 'text-white/20'}`} />
              </button>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isLight ? 'bg-slate-100' : 'bg-amber-500/10'}`}>
                  {selected?.mode === 'WORLD_CUP'
                    ? <Globe className="w-3.5 h-3.5 text-amber-400" />
                    : <Trophy className="w-3.5 h-3.5 text-amber-500/70" />}
                </div>
                <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white/85'}`}>{selected?.championshipName}</p>
              </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Invite - solo para admin */}
              {selected?.adminId === user?.id && (
                <button
                  onClick={() => router.push(`/championship/${selected!.championshipId}/invite`)}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl ${isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/10 text-amber-400/80'}`}
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={`w-8 h-8 flex items-center justify-center rounded-xl ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-white/35'}`}
              >
                {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              </button>
              {/* Avatar */}
              <button
                onClick={() => router.push('/profile')}
                className={`w-8 h-8 flex items-center justify-center rounded-xl ${isLight ? 'bg-slate-100' : 'bg-white/8'}`}
              >
                <span className={`text-[10px] font-black uppercase ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                  {user?.alias?.slice(0, 2) ?? 'P'}
                </span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className={`flex border-t ${isLight ? 'border-slate-100' : 'border-white/[0.05]'}`}>
            {(isWc
              ? ['pick', 'jugadores', 'historial', 'calendario'] as const
              : ['pick', 'jugadores', 'historial'] as const
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-all relative ${
                  activeTab === tab
                    ? isLight ? 'text-amber-600' : 'text-amber-400'
                    : isLight ? 'text-slate-400' : 'text-white/28'
                }`}
              >
                {tab === 'pick' ? 'Pick' : tab === 'jugadores' ? 'Jugadores' : tab === 'historial' ? 'Historial' : 'Calendario'}
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all ${
                  activeTab === tab ? 'w-8 bg-amber-400' : 'w-0 bg-transparent'
                }`} />
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ CONTENT ════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto overscroll-contain">

        {/* PICK TAB */}
        {activeTab === 'pick' && isWc && (
          <WcPickTab
            ctx={wcCtx}
            loading={wcLoading}
            selectedTeamId={selectedTeamId}
            picking={picking}
            countdown={countdown}
            isEliminated={isEliminated}
            isAdminViewer={isAdminViewer}
            onSelectTeam={(id) => setSelectedTeamId((p) => (p === id ? null : id))}
            onPick={handleWcPick}
            onNav={handleWcNav}
          />
        )}
        {activeTab === 'pick' && isLeague && (
          <LeaguePickTab
            deadline={leagueDeadline}
            matches={leagueMatches}
            myPick={leagueMyPick}
            loading={leaguePickLoading}
            selectedTeamId={leagueSelectedTeamId}
            pickingTeamId={leaguePickingTeamId}
            onSelectTeam={(id) => setLeagueSelectedTeamId((p) => (p === id ? null : id))}
            onPick={handleLeaguePick}
          />
        )}

        {/* JUGADORES TAB */}
        {activeTab === 'jugadores' && (
          <PlayersTab
            isWc={isWc}
            wcParticipants={wcParticipants}
            leagueStandings={leagueStandings}
            loading={participantsLoading}
            isAdmin={selected?.adminId === user?.id}
            championshipId={selected?.championshipId}
          />
        )}

        {/* CALENDARIO TAB */}
        {activeTab === 'calendario' && (
          <CalendarioTab
            matchdays={calendar}
            loading={calendarLoading}
          />
        )}

        {/* HISTORIAL TAB */}
        {activeTab === 'historial' && (
          <HistorialTab
            isWc={isWc}
            entries={history}
            loading={historyLoading}
            expandedId={expandedHistoryId}
            onToggle={handleHistoryToggle}
            details={editionDetails}
            detailLoadingId={detailLoadingId}
          />
        )}
      </main>

      {/* ══ NOTIFICATIONS PANEL ════════════════════════════════════════════ */}
      {notifsOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setNotifsOpen(false); }}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setNotifsOpen(false)} />
          <div ref={notifPanelRef} className={`relative mt-auto rounded-t-3xl border-t max-h-[70vh] flex flex-col ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/10'}`}>
            <div className={`px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-3 flex items-center gap-3 border-b ${isLight ? 'border-slate-200' : 'border-white/8'}`}>
              <button onClick={() => setNotifsOpen(false)} className={isLight ? 'text-slate-400' : 'text-white/40'}>
                <X className="w-5 h-5" />
              </button>
              <span className={`text-sm font-black uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Notificaciones</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {notifsLoading && <div className={`py-8 text-center text-xs ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Cargando…</div>}
              {!notifsLoading && notifs.length === 0 && (
                <div className={`py-10 text-center text-sm ${isLight ? 'text-slate-300' : 'text-white/20'}`}>Sin notificaciones</div>
              )}
              {notifs.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3.5 border-b ${isLight ? 'border-slate-100' : 'border-white/5'} ${!n.read ? 'bg-amber-500/5' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${isLight ? 'text-slate-600' : 'text-white/70'}`}>{(n.payload as any)?.message ?? n.type}</p>
                    <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
                      {new Date(n.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNotif(n.id)}
                    disabled={deletingNotifId === n.id}
                    className={`shrink-0 transition-colors ${isLight ? 'text-slate-300 hover:text-slate-500' : 'text-white/20 hover:text-white/50'}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ EDITION SWITCHER SHEET ═════════════════════════════════════════ */}
      {showSwitcher && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setShowSwitcher(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className={`relative mt-auto rounded-t-3xl border-t ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/10'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-4 pt-5 pb-3 flex items-center gap-3 border-b ${isLight ? 'border-slate-200' : 'border-white/8'}`}>
              <button onClick={() => setShowSwitcher(false)} className={isLight ? 'text-slate-400' : 'text-white/40'}>
                <X className="w-5 h-5" />
              </button>
              <span className={`text-sm font-black uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-white/60'}`}>Mis competiciones</span>
            </div>
            <div className="px-4 py-3 space-y-2 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
              {activeEditions.map((e) => (
                <button
                  key={e.editionId}
                  onClick={() => { setSelectedEdition(e); setShowSwitcher(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    e.editionId === selected?.editionId
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/3 border-white/8'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    e.mode === 'WORLD_CUP' ? 'bg-amber-500/15' : (isLight ? 'bg-slate-100' : 'bg-white/8')
                  }`}>
                    {e.mode === 'WORLD_CUP'
                      ? <Globe className="w-5 h-5 text-amber-400" />
                      : <Trophy className={`w-5 h-5 ${isLight ? 'text-slate-400' : 'text-white/40'}`} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black uppercase tracking-wider truncate ${
                      e.mode === 'WORLD_CUP' ? (isLight ? 'text-amber-700' : 'text-amber-200') : (isLight ? 'text-slate-700' : 'text-white/80')
                    }`}>{e.championshipName}</p>
                    <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
                      {e.mode === 'WORLD_CUP' ? 'Mundial 2026' : e.mode === 'LEAGUE' ? 'Liga' : 'Torneo'} · Activo
                    </p>
                  </div>
                  {e.editionId === selected?.editionId && (
                    <span className={`text-[10px] font-black uppercase tracking-wider shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400/70'}`}>Actual</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ PICK BOTTOM SHEET — WC ═════════════════════════════════════════ */}
      {isWc && selectedTeamId && wcCtx && !wcCtx.matchday?.deadlinePassed && (() => {
        const selTeam = wcCtx.matches?.find(m => m.homeTeam.id === selectedTeamId)?.homeTeam
          ?? wcCtx.matches?.find(m => m.awayTeam.id === selectedTeamId)?.awayTeam ?? null;
        return (
          <>
            <div className="fixed inset-x-0 top-0 z-[60] bg-black/60"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
              onClick={() => setSelectedTeamId(null)} />
            <div className="fixed bottom-0 left-0 right-0 z-[70] bg-[#0b1120] rounded-t-3xl shadow-2xl"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8">
                {selTeam?.logoUrl && <img src={selTeam.logoUrl} alt={selTeam.name} className="w-10 h-10 object-contain shrink-0" />}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Tu pick</p>
                  <p className="text-lg font-black text-white leading-tight">{selectedWcTeamName}</p>
                </div>
                <button onClick={() => setSelectedTeamId(null)}
                  className="ml-auto w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/40">✕</button>
              </div>
              <div className="px-6 pt-5 pb-2 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-white/30 text-center">¿Cómo va a quedar?</p>
                <button onClick={() => handleWcPick(selectedTeamId, 'WIN')} disabled={!!picking}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-base text-amber-400 bg-amber-500/12 border border-amber-500/35 active:scale-[0.98] disabled:opacity-40 transition-all">
                  <span className="text-xl">🏆</span>
                  <span>{picking === `${selectedTeamId}-WIN` ? 'Guardando…' : 'Gana'}</span>
                </button>
                <button onClick={() => handleWcPick(selectedTeamId, 'WIN_OR_DRAW')} disabled={!!picking}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-base text-sky-400 bg-sky-500/10 border border-sky-500/30 active:scale-[0.98] disabled:opacity-40 transition-all">
                  <span className="text-xl">🤝</span>
                  <span>{picking === `${selectedTeamId}-WIN_OR_DRAW` ? 'Guardando…' : 'Empata'}</span>
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ══ PICK BOTTOM SHEET — LEAGUE ══════════════════════════════════════ */}
      {isLeague && leagueSelectedTeamId && leagueDeadline?.firstKickoff
        && new Date(leagueDeadline.firstKickoff).getTime() > Date.now() && (
        <>
          <div className="fixed inset-x-0 top-0 z-[60] bg-black/60"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
            onClick={() => setLeagueSelectedTeamId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-[#0b1120] rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
          >
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            <div className="px-6 pb-3">
              <button
                onClick={() => handleLeaguePick(leagueSelectedTeamId)}
                disabled={!!leaguePickingTeamId}
                className="w-full py-4 rounded-2xl bg-amber-500 text-black font-black text-base uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {leaguePickingTeamId ? 'Guardando…' : `Elegir ${selectedLeagueTeamName}`}
              </button>
            </div>
          </div>
        </>
      )}

      <MobileBottomNav />
    </div>
    </IsLightCtx.Provider>
  );
}

// ── WcPickTab ──────────────────────────────────────────────────────────────

function WcPickTab({
  ctx, loading, selectedTeamId, picking, countdown, isEliminated, isAdminViewer,
  onSelectTeam, onPick, onNav,
}: {
  ctx: WcTodayCtx | null;
  loading: boolean;
  selectedTeamId: string | null;
  picking: string | null;
  countdown: string;
  isEliminated: boolean;
  isAdminViewer?: boolean;
  onSelectTeam: (id: string) => void;
  onPick: (teamId: string, pickType: 'WIN' | 'WIN_OR_DRAW') => void;
  onNav: (dir: 'prev' | 'next') => void;
}) {
  const isLight = useIsLight();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
      </div>
    );
  }

  if (!ctx?.matchday) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 px-6">
        <Trophy className={`w-10 h-10 ${isLight ? 'text-amber-500' : 'text-amber-400/40'}`} />
        <p className={`text-sm text-center ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
          {ctx ? 'No hay partidos disponibles por ahora.' : 'No hay información de la jornada.'}
        </p>
      </div>
    );
  }

  const { matchday, matches, myPick, participant } = ctx;
  const isPicked = !!myPick?.team;
  const deadlinePassed = matchday.deadlinePassed;
  const eliminated = participant.status === 'ELIMINATED';
  const phase = matchday.tournamentPhase;

  // Group matches
  const groups = matches.reduce<Record<string, typeof matches>>((acc, m) => {
    const key = m.wcGroup ? `Grupo ${m.wcGroup}` : (phase ? (PHASE_LABELS[phase] ?? phase) : 'Partidos');
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="px-4 py-4 space-y-4 pb-[140px]">

      {/* Day header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNav('prev')}
          disabled={!matchday.prevNumber}
          className={`w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed ${isLight ? 'bg-slate-200' : 'bg-white/5'}`}
        >
          <ChevronLeft className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-white/60'}`} />
        </button>

        <div className="text-center">
          <p className={`text-xs font-black uppercase tracking-widest ${isLight ? 'text-amber-700' : 'text-amber-400/80'}`}>
            {phase ? PHASE_LABELS[phase] ?? phase : 'Mundial 2026'}
          </p>
          <p className={`text-lg font-black leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Día {matchday.number}</p>
          {matchday.firstKickoff && (
            <div className={`flex items-center justify-center gap-1 mt-0.5 ${deadlinePassed ? (isLight ? 'text-slate-400' : 'text-white/25') : (isLight ? 'text-amber-600' : 'text-amber-400/70')}`}>
              <Clock className="w-3 h-3" />
              <span className="text-[11px] font-semibold">
                {deadlinePassed ? 'Cerrado' : countdown}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => onNav('next')}
          disabled={!matchday.nextNumber}
          className={`w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed ${isLight ? 'bg-slate-200' : 'bg-white/5'}`}
        >
          <ChevronRight className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-white/60'}`} />
        </button>
      </div>

      {/* Current pick banner */}
      {isPicked && (
        <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${
          myPick!.status === 'SURVIVED'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : myPick!.status === 'PENDING'
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-red-500/10 border-red-500/25'
        }`}>
          <img src={myPick!.team!.logoUrl} alt={myPick!.team!.name} className="w-10 h-10 object-contain" />
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Tu pick</p>
            <p className={`text-base font-black truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{myPick!.team!.name}</p>
          </div>
          <div className={`flex items-center gap-1 ${PICK_STATUS_COMPACT[myPick!.status]?.cls ?? 'text-white/40'}`}>
            {PICK_STATUS_COMPACT[myPick!.status]?.icon}
            <span className="text-[11px] font-bold">{PICK_STATUS_COMPACT[myPick!.status]?.label ?? myPick!.status}</span>
          </div>
        </div>
      )}

      {/* Eliminated banner */}
      {eliminated && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400/60 shrink-0" />
          <p className="text-xs text-red-300/60">
            Eliminado
            {ctx.participant.eliminatedAtPhase ? ` · ${PHASE_LABELS[ctx.participant.eliminatedAtPhase] ?? ctx.participant.eliminatedAtPhase}` : ''}
          </p>
        </div>
      )}

      {/* Admin view banner */}
      {isAdminViewer && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400/60 shrink-0" />
          <p className="text-xs text-blue-300/60">Vista de administrador · solo lectura</p>
        </div>
      )}

      {/* Matches grouped */}
      {Object.entries(groups).map(([groupName, groupMatches]) => (
        <div key={groupName} className="space-y-2">
          {Object.keys(groups).length > 1 && (
            <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>{groupName}</p>
          )}
          {groupMatches.map((m) => {
            const isHomeMyPick = myPick?.team?.id === m.homeTeam.id;
            const isAwayMyPick = myPick?.team?.id === m.awayTeam.id;
            const isHomeSelected = selectedTeamId === m.homeTeam.id;
            const isAwaySelected = selectedTeamId === m.awayTeam.id;
            const canPick = !deadlinePassed && !eliminated && !isAdminViewer && m.status === 'SCHEDULED';
            const isFinished = m.status === 'FINISHED' || m.status === 'LIVE';

            return (
              <div key={m.id} className={`rounded-2xl border overflow-hidden transition-all ${
                isHomeMyPick || isAwayMyPick
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : isLight ? 'border-slate-200 bg-white' : 'border-white/8 bg-white/3'
              }`}>
                <div className="flex items-stretch min-h-[72px]">
                  {/* Local */}
                  <button
                    onClick={() => canPick && onSelectTeam(m.homeTeam.id)}
                    disabled={!canPick || (m.homeUsed && !isHomeMyPick)}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 transition-all ${
                      isHomeSelected ? 'bg-amber-500/20' :
                      isHomeMyPick ? 'bg-amber-500/10' :
                      canPick && !(m.homeUsed && !isHomeMyPick) ? 'active:bg-white/5' : ''
                    } ${(m.homeUsed && !isHomeMyPick && !isHomeSelected) ? 'opacity-30' : ''}`}
                  >
                    <img src={m.homeTeam.logoUrl} alt={m.homeTeam.name} className="w-10 h-10 object-contain shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-sm font-bold leading-tight line-clamp-2 text-left ${
                        isHomeMyPick || isHomeSelected ? 'text-amber-300' : (isLight ? 'text-slate-700' : 'text-white/80')
                      }`}>{m.homeTeam.name}</p>
                      {m.homeUsed && !isHomeMyPick && (
                        <p className="text-[9px] font-black text-red-400/60 uppercase tracking-wider">Usado</p>
                      )}
                    </div>
                  </button>

                  {/* Centro: marcador o hora */}
                  <div className={`w-16 shrink-0 flex flex-col items-center justify-center gap-0.5 border-x ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                    {(m.status === 'FINISHED' || m.status === 'LIVE') && m.homeScore !== null ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className={`text-base font-black ${isLight ? 'text-slate-700' : 'text-white/80'}`}>{m.homeScore}</span>
                          <span className={`text-sm font-black ${isLight ? 'text-slate-300' : 'text-white/20'}`}>-</span>
                          <span className={`text-base font-black ${isLight ? 'text-slate-700' : 'text-white/80'}`}>{m.awayScore}</span>
                        </div>
                        {m.status === 'LIVE' && (
                          <span className="text-[9px] font-black text-emerald-400 animate-pulse">EN VIVO</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-white/50'}`}>{formatKickoff(m.kickoffTime)}</span>
                        <span className={`text-[10px] font-black ${isLight ? 'text-slate-300' : 'text-white/20'}`}>vs</span>
                      </>
                    )}
                  </div>

                  {/* Visitante */}
                  <button
                    onClick={() => canPick && onSelectTeam(m.awayTeam.id)}
                    disabled={!canPick || (m.awayUsed && !isAwayMyPick)}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 flex-row-reverse transition-all ${
                      isAwaySelected ? 'bg-amber-500/20' :
                      isAwayMyPick ? 'bg-amber-500/10' :
                      canPick && !(m.awayUsed && !isAwayMyPick) ? 'active:bg-white/5' : ''
                    } ${(m.awayUsed && !isAwayMyPick && !isAwaySelected) ? 'opacity-30' : ''}`}
                  >
                    <img src={m.awayTeam.logoUrl} alt={m.awayTeam.name} className="w-10 h-10 object-contain shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-sm font-bold leading-tight line-clamp-2 text-right ${
                        isAwayMyPick || isAwaySelected ? 'text-amber-300' : (isLight ? 'text-slate-700' : 'text-white/80')
                      }`}>{m.awayTeam.name}</p>
                      {m.awayUsed && !isAwayMyPick && (
                        <p className="text-[9px] font-black text-red-400/60 uppercase tracking-wider text-right">Usado</p>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {matches.length === 0 && (
        <p className={`text-center text-sm py-8 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Sin partidos en este día.</p>
      )}
    </div>
  );
}

// ── LeaguePickTab ──────────────────────────────────────────────────────────

function LeaguePickTab({
  deadline, matches, myPick, loading, selectedTeamId, pickingTeamId, onSelectTeam, onPick,
}: {
  deadline: LeagueDeadline | null;
  matches: LeagueMatch[];
  myPick: LeaguePick | null;
  loading: boolean;
  selectedTeamId: string | null;
  pickingTeamId: string | null;
  onSelectTeam: (id: string) => void;
  onPick: (teamId: string) => void;
}) {
  const isLight = useIsLight();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-amber-500/25 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  if (!deadline?.matchdayNumber) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 px-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/4 border-white/8'}`}>
          <Trophy className={`w-8 h-8 ${isLight ? 'text-slate-300' : 'text-white/18'}`} />
        </div>
        <div className="text-center space-y-1.5">
          <p className={`text-sm font-semibold ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Sin datos de jornada</p>
          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-400' : 'text-white/22'}`}>El calendario de la temporada 26/27 aún no está sincronizado.</p>
        </div>
      </div>
    );
  }

  const deadlinePassed = deadline.firstKickoff
    ? new Date(deadline.firstKickoff).getTime() <= Date.now()
    : deadline.matchdayStatus === 'FINISHED';

  return (
    <div className="pb-[140px]">
      {/* ── Matchday header ── */}
      <div className={`px-5 pt-5 pb-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.05]'}`}>
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
              La Liga · {deadline.matchdayStatus === 'FINISHED' ? 'Temporada 25/26' : 'Temporada 26/27'}
            </p>
            <p className={`text-[34px] font-black leading-none tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              J{deadline.matchdayNumber}
            </p>
          </div>
          <div className={`mb-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
            !deadlinePassed && deadline.matchdayStatus !== 'FINISHED'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : isLight ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white/5 border-white/10 text-white/30'
          }`}>
            {!deadlinePassed && deadline.matchdayStatus !== 'FINISHED' && deadline.firstKickoff
              ? `Cierra ${formatKickoff(deadline.firstKickoff)}`
              : 'Cerrada'}
          </div>
        </div>
      </div>

      {/* ── My pick banner ── */}
      {myPick?.team && (
        <div className="px-4 pt-4">
          <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3.5 ${
            myPick.status === 'SURVIVED' ? 'bg-emerald-500/7 border-emerald-500/25' :
            myPick.status === 'PENDING'  ? 'bg-amber-500/7 border-amber-500/25' :
            'bg-red-500/7 border-red-500/20'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              myPick.status === 'SURVIVED' ? 'bg-emerald-500/12' :
              myPick.status === 'PENDING'  ? 'bg-amber-500/12' : 'bg-red-500/12'
            }`}>
              <img src={myPick.team.logoUrl} alt={myPick.team.name} className="w-7 h-7 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-medium uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Tu pick</p>
              <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white/85'}`}>{myPick.team.name}</p>
            </div>
            <div className={`flex items-center gap-1.5 ${PICK_STATUS_COMPACT[myPick.status]?.cls ?? 'text-white/40'}`}>
              {PICK_STATUS_COMPACT[myPick.status]?.icon}
              <span className="text-[10px] font-semibold">{PICK_STATUS_COMPACT[myPick.status]?.label ?? myPick.status}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Matches ── */}
      <div className="px-4 pt-4 space-y-3">
        {matches.map((m) => {
          const isHomeSelected = selectedTeamId === m.homeTeam.id;
          const isAwaySelected = selectedTeamId === m.awayTeam.id;
          const isHomeMyPick = myPick?.team?.id === m.homeTeam.id;
          const isAwayMyPick = myPick?.team?.id === m.awayTeam.id;
          const canPick = !deadlinePassed && m.status === 'SCHEDULED';
          const isFinished = m.status === 'FINISHED';
          const isLive = m.status === 'LIVE';
          const isMyPickMatch = isHomeMyPick || isAwayMyPick;
          return (
            <div
              key={m.id}
              className={`rounded-2xl overflow-hidden border transition-all ${
                isMyPickMatch
                  ? 'border-amber-500/35'
                  : isLight ? 'border-slate-200' : 'border-white/[0.07]'
              }`}
              style={{
                background: isMyPickMatch
                  ? (isLight ? '#fffbf0' : 'linear-gradient(160deg,rgba(245,158,11,0.07) 0%,#0a1020 55%)')
                  : (isLight ? '#fff' : '#0c1220'),
                boxShadow: isMyPickMatch && !isLight ? '0 0 24px rgba(245,158,11,0.06)' : undefined,
              }}
            >
              {/* Status strip */}
              <div className={`flex items-center justify-center px-4 py-1.5 border-b ${
                isLive
                  ? 'border-emerald-500/20 bg-emerald-500/8'
                  : isLight ? 'border-slate-100' : 'border-white/[0.05]'
              }`}>
                {isLive ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En Vivo
                  </span>
                ) : isFinished ? (
                  <span className={`text-[10px] font-medium uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
                    Finalizado
                  </span>
                ) : (
                  <span className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                    {formatKickoff(m.kickoffTime)}
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="flex items-stretch">
                {/* Home */}
                <button
                  onClick={() => canPick && onSelectTeam(m.homeTeam.id)}
                  disabled={!canPick}
                  className={`flex-1 flex flex-col items-center gap-2 px-3 py-5 transition-all ${
                    isHomeSelected ? 'bg-amber-500/15' :
                    isHomeMyPick ? 'bg-amber-500/8' :
                    canPick ? 'active:bg-white/5' : ''
                  }`}
                >
                  <img src={m.homeTeam.logoUrl} alt={m.homeTeam.name} className="w-12 h-12 object-contain drop-shadow-sm" />
                  <p className={`text-xs font-semibold text-center leading-snug line-clamp-2 px-1 ${
                    isHomeMyPick || isHomeSelected ? 'text-amber-400' : (isLight ? 'text-slate-700' : 'text-white/72')
                  }`}>{m.homeTeam.name}</p>
                  {isHomeSelected && (
                    <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-widest -mt-1">Seleccionado</span>
                  )}
                </button>

                {/* Score / VS */}
                <div className={`w-[68px] shrink-0 flex flex-col items-center justify-center border-x ${isLight ? 'border-slate-100' : 'border-white/[0.05]'}`}>
                  {(isFinished || isLive) && m.homeScore !== null ? (
                    <p className={`text-[22px] font-black tracking-tight leading-none ${isLight ? 'text-slate-800' : 'text-white/90'}`}>
                      {m.homeScore}<span className={`text-base mx-0.5 ${isLight ? 'text-slate-300' : 'text-white/20'}`}>–</span>{m.awayScore}
                    </p>
                  ) : (
                    <span className={`text-sm font-bold ${isLight ? 'text-slate-300' : 'text-white/22'}`}>vs</span>
                  )}
                </div>

                {/* Away */}
                <button
                  onClick={() => canPick && onSelectTeam(m.awayTeam.id)}
                  disabled={!canPick}
                  className={`flex-1 flex flex-col items-center gap-2 px-3 py-5 transition-all ${
                    isAwaySelected ? 'bg-amber-500/15' :
                    isAwayMyPick ? 'bg-amber-500/8' :
                    canPick ? 'active:bg-white/5' : ''
                  }`}
                >
                  <img src={m.awayTeam.logoUrl} alt={m.awayTeam.name} className="w-12 h-12 object-contain drop-shadow-sm" />
                  <p className={`text-xs font-semibold text-center leading-snug line-clamp-2 px-1 ${
                    isAwayMyPick || isAwaySelected ? 'text-amber-400' : (isLight ? 'text-slate-700' : 'text-white/72')
                  }`}>{m.awayTeam.name}</p>
                  {isAwaySelected && (
                    <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-widest -mt-1">Seleccionado</span>
                  )}
                </button>
              </div>

              {/* Pick footer */}
              {isMyPickMatch && (
                <div className={`flex items-center gap-2 px-4 py-2 border-t ${isLight ? 'border-amber-100' : 'border-amber-500/15'}`}>
                  <span className={`text-[10px] font-medium uppercase tracking-widest ${isLight ? 'text-amber-600/70' : 'text-amber-400/50'}`}>Tu pick</span>
                  <div className={`ml-auto flex items-center gap-1 ${PICK_STATUS_COMPACT[myPick!.status]?.cls ?? 'text-white/40'}`}>
                    {PICK_STATUS_COMPACT[myPick!.status]?.icon}
                    <span className="text-[10px] font-semibold">{PICK_STATUS_COMPACT[myPick!.status]?.label}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {matches.length === 0 && (
          <div className={`py-12 text-center text-sm ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
            Sin partidos en esta jornada.
          </div>
        )}
      </div>
    </div>
  );
}

// ── PlayersTab ─────────────────────────────────────────────────────────────

function PlayersTab({
  isWc, wcParticipants, leagueStandings, loading, isAdmin, championshipId,
}: {
  isWc: boolean;
  wcParticipants: WcParticipant[];
  leagueStandings: LeagueStanding[];
  loading: boolean;
  isAdmin?: boolean;
  championshipId?: string;
}) {
  const isLight = useIsLight();
  const router = useRouter();
  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" /></div>;

  if (isWc) {
    const active = wcParticipants.filter(p => p.status === 'ACTIVE');
    const eliminated = wcParticipants.filter(p => p.status !== 'ACTIVE');
    return (
      <div className="px-4 py-4 space-y-4 pb-[80px]">
        {isAdmin && championshipId && (
          <button
            onClick={() => router.push(`/championship/${championshipId}/invite`)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border font-black text-sm uppercase tracking-wider ${
              isLight ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <Users className="w-4 h-4" />
            Invitar jugadores
          </button>
        )}
        {active.length > 0 && (
          <div className="space-y-2">
            <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>En juego — {active.length}</p>
            <div className={`rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/8'}`}>
              {active.map((p, i) => <WcPlayerRow key={p.alias} p={p} i={i} total={active.length} />)}
            </div>
          </div>
        )}
        {eliminated.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400/40 px-1">Eliminados — {eliminated.length}</p>
            <div className={`rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
              {eliminated.map((p, i) => <WcPlayerRow key={p.alias} p={p} i={i} total={eliminated.length} />)}
            </div>
          </div>
        )}
        {wcParticipants.length === 0 && <p className={`text-center text-sm py-10 ${isLight ? 'text-slate-300' : 'text-white/20'}`}>Sin jugadores todavía.</p>}
      </div>
    );
  }

  return (
    <div className="px-4 py-5 pb-[80px] space-y-3">
      <div className={`flex items-center justify-between px-1 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
        <span className="text-[10px] font-medium uppercase tracking-widest">Clasificación</span>
        <span className="text-[10px] font-medium uppercase tracking-widest">{leagueStandings.filter(s => s.status === 'ACTIVE').length} activos</span>
      </div>
      <div className={`rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/[0.07]'}`}
        style={{ background: isLight ? '#fff' : '#0c1220' }}>
        {leagueStandings.map((s, i) => {
          const isActive = s.status === 'ACTIVE';
          const isTop = i === 0 && isActive;
          return (
            <div key={s.participantId} className={`flex items-center gap-3.5 px-4 py-3.5 border-b last:border-0 ${
              isLight ? 'border-slate-100' : 'border-white/[0.04]'
            } ${!isActive ? 'opacity-50' : ''}`}>
              {/* Position */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black ${
                isTop
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/25'
              }`}>{i + 1}</div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${
                  isTop
                    ? isLight ? 'text-amber-700' : 'text-amber-300/90'
                    : isLight ? 'text-slate-700' : 'text-white/75'
                }`}>{s.alias}</p>
                {s.eliminatedAtMatchday && (
                  <p className="text-[10px] text-red-400/50 font-medium">Elim. J{s.eliminatedAtMatchday}</p>
                )}
              </div>

              {/* Status / points */}
              {isActive ? (
                <span className={`text-sm font-bold tabular-nums ${isTop ? (isLight ? 'text-amber-600' : 'text-amber-400') : (isLight ? 'text-slate-600' : 'text-white/60')}`}>
                  {s.totalPoints} <span className="text-[10px] font-medium opacity-60">pts</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-red-400/50 uppercase tracking-wider">Eliminado</span>
              )}
            </div>
          );
        })}
        {leagueStandings.length === 0 && (
          <p className={`text-center text-sm py-10 ${isLight ? 'text-slate-300' : 'text-white/20'}`}>Sin datos.</p>
        )}
      </div>
    </div>
  );
}

function WcPlayerRow({ p, i, total }: { p: WcParticipant; i: number; total: number }) {
  const isLight = useIsLight();
  const cfg = p.lastPick ? (PICK_STATUS_COMPACT[p.lastPick.pickStatus] ?? null) : null;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b ${i === total - 1 ? 'border-0' : (isLight ? 'border-slate-100' : 'border-white/5')}`}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400/40'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-700' : 'text-white/80'}`}>{p.alias}</p>
        {p.eliminatedAtPhase && (
          <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-white/25'}`}>{PHASE_LABELS[p.eliminatedAtPhase] ?? p.eliminatedAtPhase}</p>
        )}
      </div>
      {p.lastPick && (
        <div className="shrink-0 flex items-center gap-1.5">
          {p.lastPick.team && (
            <img src={p.lastPick.team.logoUrl} alt={p.lastPick.team.name} className="w-5 h-5 object-contain" />
          )}
          {cfg && <span className={`${cfg.cls}`}>{cfg.icon}</span>}
        </div>
      )}
    </div>
  );
}

// ── HistorialTab ───────────────────────────────────────────────────────────

const PICK_STATUS_HIST: Record<string, { label: string; cls: string }> = {
  SURVIVED:           { label: 'Sobrevivió', cls: 'text-emerald-400' },
  DRAW_ELIMINATED:    { label: 'Empate · elim.', cls: 'text-red-400' },
  LOSS_ELIMINATED:    { label: 'Derrota · elim.', cls: 'text-red-400' },
  NO_PICK_ELIMINATED: { label: 'Sin pick · elim.', cls: 'text-red-400/60' },
  PENDING:            { label: 'Pendiente', cls: 'text-amber-400' },
};

function HistorialTab({
  isWc, entries, loading, expandedId, onToggle, details, detailLoadingId,
}: {
  isWc: boolean;
  entries: EditionHistoryEntry[];
  loading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
  details: Record<string, EditionDetail>;
  detailLoadingId: string | null;
}) {
  const isLight = useIsLight();
  if (!isWc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 px-6">
        <p className={`text-sm text-center ${isLight ? 'text-slate-300' : 'text-white/20'}`}>Historial disponible para ediciones World Cup.</p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" /></div>;
  if (entries.length === 0) return <div className={`py-16 text-center text-sm ${isLight ? 'text-slate-300' : 'text-white/20'}`}>Sin ediciones finalizadas.</div>;

  return (
    <div className="px-4 py-4 space-y-2 pb-[80px]">
      <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isLight ? 'text-amber-600' : 'text-amber-400/70'}`}>Historial de campeones</p>
      <div className={`rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
        {entries.map((e, i) => {
          const date = e.finishedAt
            ? new Date(e.finishedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
          const isFirst = i === 0;
          const isExpanded = expandedId === e.id;
          const detail = details[e.id];

          return (
            <div key={e.id} className={`border-b last:border-0 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
              <button
                onClick={() => onToggle(e.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isFirst ? 'bg-amber-500/5' : ''} ${isExpanded ? (isLight ? 'bg-slate-50' : 'bg-white/4') : (isLight ? 'hover:bg-slate-50' : 'hover:bg-white/3')}`}
              >
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${isFirst ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : (isLight ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-white/5 text-white/20 border border-white/8')}`}>
                  {entries.length - i}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black uppercase tracking-widest ${isFirst ? 'text-amber-300' : (isLight ? 'text-slate-500' : 'text-white/50')}`}>{e.name}</p>
                  <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>{e.participantCount} jugadores · {date}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {e.winnerAlias ? (
                    <>
                      <Trophy className={`w-3.5 h-3.5 ${isFirst ? 'text-amber-400' : (isLight ? 'text-slate-400' : 'text-white/30')}`} />
                      <span className={`text-xs font-bold ${isFirst ? 'text-amber-200' : (isLight ? 'text-slate-500' : 'text-white/60')}`}>{e.winnerAlias}</span>
                    </>
                  ) : (
                    <span className={`text-[10px] italic ${isLight ? 'text-slate-300' : 'text-white/20'}`}>Sin ganador</span>
                  )}
                </div>
                <span className={`shrink-0 text-xs transition-transform duration-200 ${isLight ? 'text-slate-300' : 'text-white/20'} ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isExpanded && (
                <div className={`px-4 pb-4 border-t ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/5'}`}>
                  {detailLoadingId === e.id && !detail && <div className={`py-4 text-center text-xs ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Cargando…</div>}
                  {detail && (
                    <div className="space-y-3 pt-3">
                      {detail.participants.map((p) => {
                        const isWinner = p.alias === detail.edition.winnerAlias;
                        return (
                          <div key={p.alias} className={`rounded-xl border ${isWinner ? 'border-amber-500/30 bg-amber-500/5' : (isLight ? 'border-slate-200 bg-white' : 'border-white/8 bg-white/3')}`}>
                            <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                              {isWinner && <Trophy className="w-3 h-3 text-amber-400 shrink-0" />}
                              <span className={`text-xs font-black uppercase tracking-wider flex-1 ${isWinner ? 'text-amber-300' : (isLight ? 'text-slate-500' : 'text-white/60')}`}>{p.alias}</span>
                              <span className={`text-[10px] ${p.status === 'ACTIVE' ? 'text-emerald-400' : (isLight ? 'text-slate-400' : 'text-white/25')}`}>{p.status === 'ACTIVE' ? 'Activo' : 'Eliminado'}</span>
                            </div>
                            {p.picks.length === 0
                              ? <p className={`px-3 py-2.5 text-[11px] italic ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Sin picks</p>
                              : p.picks.map((pk) => {
                                  const cfg = PICK_STATUS_HIST[pk.pickStatus] ?? { label: pk.pickStatus, cls: 'text-white/40' };
                                  return (
                                    <div key={pk.matchdayNumber} className={`flex items-center gap-2.5 px-3 py-2 border-b last:border-0 ${isLight ? 'border-slate-100' : 'border-white/4'}`}>
                                      <span className={`text-[10px] font-black w-8 shrink-0 ${isLight ? 'text-slate-300' : 'text-white/20'}`}>D{pk.matchdayNumber}</span>
                                      {pk.team ? (
                                        <>
                                          <img src={pk.team.logoUrl} alt={pk.team.name} className="w-4 h-4 object-contain shrink-0" />
                                          <span className={`flex-1 text-xs truncate ${isLight ? 'text-slate-500' : 'text-white/60'}`}>{pk.team.name}</span>
                                        </>
                                      ) : (
                                        <span className={`flex-1 text-xs italic ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Sin equipo</span>
                                      )}
                                      <span className={`text-[10px] font-semibold shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                                    </div>
                                  );
                                })
                            }
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

// ── CalendarioTab ──────────────────────────────────────────────────────────

function CalendarioTab({ matchdays, loading }: { matchdays: CalMatchday[]; loading: boolean }) {
  const isLight = useIsLight();
  const now = Date.now();

  const todayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
      </div>
    );
  }

  if (matchdays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 px-6">
        <p className={`text-sm text-center ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Sin partidos disponibles.</p>
      </div>
    );
  }

  // Encuentra el día "actual" (primer día con partidos futuros o el último día pasado)
  let todayIndex = matchdays.findIndex((md) =>
    md.matches.some((m) => m.kickoffTime && new Date(m.kickoffTime).getTime() > now),
  );
  if (todayIndex === -1) todayIndex = matchdays.length - 1;

  return (
    <div className="px-4 py-4 space-y-4 pb-[80px]">
      {matchdays.map((md, mdIdx) => {
        const isPast = md.status === 'FINISHED';
        const isToday = mdIdx === todayIndex;
        const phase = md.tournamentPhase;
        const phaseLabel = phase ? (PHASE_LABELS[phase] ?? phase) : 'Mundial 2026';
        const dayDate = md.firstKickoff
          ? new Date(md.firstKickoff).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
          : null;

        // Group matches by wcGroup
        const groups = md.matches.reduce<Record<string, CalMatch[]>>((acc, m) => {
          const key = m.wcGroup ? `Grupo ${m.wcGroup}` : phaseLabel;
          (acc[key] ??= []).push(m);
          return acc;
        }, {});

        return (
          <div key={md.number} ref={isToday ? todayRef : undefined}>
            {/* Day header */}
            <div className={`flex items-center gap-2 mb-2 ${isToday ? 'sticky top-0 z-10 py-1' : ''}`}>
              <div className={`flex-1 h-px ${isLight ? 'bg-slate-200' : 'bg-white/8'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 rounded-full shrink-0 ${
                isToday
                  ? (isLight ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40')
                  : isPast
                  ? (isLight ? 'text-slate-400' : 'text-white/25')
                  : (isLight ? 'text-slate-500' : 'text-white/40')
              }`}>
                Día {md.number}{dayDate ? ` · ${dayDate}` : ''}
              </span>
              <div className={`flex-1 h-px ${isLight ? 'bg-slate-200' : 'bg-white/8'}`} />
            </div>

            {/* Matches */}
            <div className="space-y-1.5">
              {Object.entries(groups).map(([groupName, groupMatches]) => (
                <div key={groupName}>
                  {Object.keys(groups).length > 1 && (
                    <p className={`text-[9px] font-black uppercase tracking-widest px-1 mb-1 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>{groupName}</p>
                  )}
                  {groupMatches.map((m) => {
                    const isFinished = m.status === 'FINISHED';
                    const isLive = m.status === 'LIVE';
                    return (
                      <div key={m.id} className={`rounded-xl border overflow-hidden ${
                        isLight ? 'border-slate-200 bg-white' : 'border-white/8 bg-white/3'
                      } ${isPast && !isLive ? 'opacity-70' : ''}`}>
                        <div className="flex items-stretch min-h-[60px]">
                          {/* Home */}
                          <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5">
                            <img src={m.homeTeam.logoUrl} alt={m.homeTeam.name} className="w-8 h-8 object-contain shrink-0" />
                            <p className={`text-sm font-bold leading-tight line-clamp-2 ${isLight ? 'text-slate-700' : 'text-white/80'}`}>{m.homeTeam.name}</p>
                          </div>

                          {/* Centro */}
                          <div className={`w-16 shrink-0 flex flex-col items-center justify-center border-x ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                            {isFinished || (isLive && m.homeScore !== null) ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className={`text-base font-black ${
                                    m.homeScore! > m.awayScore! ? 'text-amber-400' : (isLight ? 'text-slate-600' : 'text-white/60')
                                  }`}>{m.homeScore}</span>
                                  <span className={`text-sm font-black ${isLight ? 'text-slate-300' : 'text-white/20'}`}>-</span>
                                  <span className={`text-base font-black ${
                                    m.awayScore! > m.homeScore! ? 'text-amber-400' : (isLight ? 'text-slate-600' : 'text-white/60')
                                  }`}>{m.awayScore}</span>
                                </div>
                                {isLive && (
                                  <span className="text-[9px] font-black text-emerald-400 animate-pulse">EN VIVO</span>
                                )}
                                {isFinished && (
                                  <span className={`text-[9px] font-semibold ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Final</span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-white/50'}`}>{formatKickoff(m.kickoffTime)}</span>
                                <span className={`text-[10px] font-black ${isLight ? 'text-slate-300' : 'text-white/20'}`}>vs</span>
                              </>
                            )}
                          </div>

                          {/* Away */}
                          <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 flex-row-reverse">
                            <img src={m.awayTeam.logoUrl} alt={m.awayTeam.name} className="w-8 h-8 object-contain shrink-0" />
                            <p className={`text-sm font-bold leading-tight line-clamp-2 text-right ${isLight ? 'text-slate-700' : 'text-white/80'}`}>{m.awayTeam.name}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── WelcomeScreen ──────────────────────────────────────────────────────────

function WelcomeScreen({
  editions,
  onSelect,
  user,
  onLogout,
  toggleTheme,
}: {
  editions: ActiveEdition[];
  onSelect: (e: ActiveEdition) => void;
  user: { alias?: string } | null;
  onLogout: () => void;
  toggleTheme: () => void;
}) {
  const isLight = useIsLight();
  const router = useRouter();
  const wcEditions = editions.filter((e) => e.mode === 'WORLD_CUP');
  const otherEditions = editions.filter((e) => e.mode !== 'WORLD_CUP');
  const hasEditions = editions.length > 0;

  return (
    <div className={`h-[100dvh] flex flex-col overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#06090f]'}`}>
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top,0px)] px-4">
        <div className="h-14 flex items-center justify-between">
          <p className={`text-xs font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/20'}`}>Pick & Survive</p>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-white/5 border-white/8'}`}
            >
              {isLight ? <Moon className="w-4 h-4 text-slate-600" /> : <Sun className="w-4 h-4 text-amber-400/70" />}
            </button>
            <button
              onClick={() => router.push('/profile')}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-white/5 border-white/8'}`}
            >
              <span className={`text-[11px] font-black uppercase ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                {user?.alias?.slice(0, 2) ?? 'P'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* WC Hero */}
        {wcEditions.length > 0 && (
          <div className="w-full">
            <img
              src="/Logo_WorldCup.png"
              alt="Pick & Survive"
              className="w-full aspect-square object-cover"
            />
          </div>
        )}

        {/* Sin ediciones */}
        {!hasEditions && (
          <div className="flex flex-col items-center py-16 px-6 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center">
              <Trophy className={`w-10 h-10 ${isLight ? 'text-amber-500' : 'text-amber-400/50'}`} />
            </div>
            <div className="text-center space-y-1">
              <p className={`text-base font-black ${isLight ? 'text-slate-500' : 'text-white/50'}`}>Sin competiciones activas</p>
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-white/25'}`}>Únete a un campeonato o crea uno nuevo</p>
            </div>
          </div>
        )}

        <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+88px)] space-y-5">
          {/* Ediciones WC */}
          {wcEditions.length > 0 && (
            <div className="space-y-2.5">
              <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isLight ? 'text-amber-500' : 'text-amber-400/50'}`}>
                {wcEditions.length === 1 ? 'Tu edición activa' : 'Ediciones activas'}
              </p>
              {wcEditions.map((e) => (
                <WelcomeEditionCard key={e.editionId} edition={e} onSelect={onSelect} />
              ))}
            </div>
          )}

          {/* Otras ediciones */}
          {otherEditions.length > 0 && (
            <div className="space-y-2.5">
              <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
                Ligas y torneos
              </p>
              {otherEditions.map((e) => (
                <WelcomeEditionCard key={e.editionId} edition={e} onSelect={onSelect} />
              ))}
            </div>
          )}

          {/* CTAs */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => router.push('/join-code')}
              className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border font-semibold text-sm transition-all active:scale-[0.98] ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-600 active:bg-slate-50'
                  : 'bg-white/5 border-white/[0.08] text-white/50 active:bg-white/8'
              }`}
            >
              <Users className="w-4 h-4" />
              Unirse por código
            </button>
            <button
              onClick={() => router.push('/championship/new')}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all ${
                isLight ? 'text-slate-400' : 'text-white/25'
              }`}
            >
              <Plus className="w-4 h-4" />
              Crear campeonato
            </button>
            <button
              onClick={onLogout}
              className={`w-full py-2.5 text-xs font-medium ${isLight ? 'text-slate-300' : 'text-white/15'}`}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}

// ── WelcomeEditionCard ─────────────────────────────────────────────────────

function WelcomeEditionCard({ edition, onSelect }: { edition: ActiveEdition; onSelect: (e: ActiveEdition) => void }) {
  const isWc = edition.mode === 'WORLD_CUP';
  const isLight = useIsLight();
  const modeLabel = isWc ? 'Mundial 2026' : edition.mode === 'LEAGUE' ? 'Liga' : 'Torneo';

  return (
    <button
      onClick={() => onSelect(edition)}
      className="w-full text-left transition-all active:scale-[0.985] active:opacity-90"
    >
      <div
        className={`rounded-2xl border overflow-hidden ${
          isWc
            ? 'border-amber-500/30'
            : isLight ? 'border-slate-200' : 'border-white/[0.08]'
        }`}
        style={{
          background: isWc
            ? (isLight ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : 'linear-gradient(135deg,rgba(245,158,11,0.10),rgba(12,18,32,1) 60%)')
            : (isLight ? '#fff' : '#0c1220'),
        }}
      >
        <div className="flex items-center gap-4 px-4 py-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            isWc
              ? 'bg-amber-500/15 border-amber-500/25'
              : isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/8 border-white/10'
          }`}>
            {isWc
              ? <Globe className="w-6 h-6 text-amber-400" />
              : <Trophy className={`w-6 h-6 ${isLight ? 'text-slate-400' : 'text-white/35'}`} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                isWc
                  ? 'border-amber-500/30 text-amber-400/80 bg-amber-500/8'
                  : isLight ? 'border-slate-200 text-slate-400 bg-slate-50' : 'border-white/10 text-white/30 bg-white/5'
              }`}>{modeLabel}</span>
              <span className={`text-[9px] font-medium ${isLight ? 'text-emerald-600' : 'text-emerald-400/70'}`}>● Activo</span>
            </div>
            <p className={`text-sm font-bold truncate leading-tight ${
              isWc
                ? isLight ? 'text-amber-800' : 'text-amber-100/90'
                : isLight ? 'text-slate-800' : 'text-white/85'
            }`}>{edition.championshipName}</p>
          </div>

          <ChevronRight className={`w-4 h-4 shrink-0 ${
            isWc ? 'text-amber-400/60' : isLight ? 'text-slate-300' : 'text-white/25'
          }`} />
        </div>
      </div>
    </button>
  );
}
