'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Clock3,
  LayoutDashboard,
  Mail,
  Settings2,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Championship = {
  id: string;
  name: string;
  mode: 'TOURNAMENT' | 'LEAGUE';
  adminId: string;
  footballLeague: { id: string; name: string; country: string };
  editions: { id: string; status: string; startMatchday: number }[];
  _count: { joinRequests: number };
};

type StandingsEntry = {
  participantId: string;
  alias: string;
  status?: string;
  eliminatedAtMatchday?: number | null;
  totalPoints?: number;
};

type Pick = {
  status: string;
  team: { id: string; name: string; logoUrl: string };
  participant: { user: { alias: string } };
  matchday: { number: number; status: string };
};

type MatchItem = {
  id: string;
  status: string;
  kickoffTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string; logoUrl: string };
  awayTeam: { id: string; name: string; logoUrl: string };
};

type EditionMeta = {
  startMatchday: number;
  endMatchday: number | null;
  status: string;
  season: number | null;
};

type EditionDeadline = {
  matchdayNumber: number | null;
  firstKickoff: string | null;
  matchdayStatus?: string | null;
};

type NotificationItem = {
  id: string;
  type: string;
  createdAt: string;
  read: boolean;
  payload?: Record<string, unknown>;
};

const BG_IMAGE =
  "https://images.unsplash.com/photo-1508098682722-e99c43a1c5e8?auto=format&fit=crop&w=1600&q=80";

const PICK_STATUS_BADGE: Record<string, 'muted' | 'success' | 'warning' | 'destructive' | 'default'> = {
  PENDING: 'muted',
  SURVIVED: 'success',
  DRAW_ELIMINATED: 'warning',
  LOSS_ELIMINATED: 'destructive',
  NO_PICK_ELIMINATED: 'destructive',
  POSTPONED_PENDING: 'default',
};

const MODE_LABEL: Record<string, string> = { TOURNAMENT: 'Torneo', LEAGUE: 'Liga' };
const EDITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  OPEN: 'Abierta',
  ACTIVE: 'Activa',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [championships, setChampionships] = useState<Championship[]>([]);
  const [fetching, setFetching] = useState(true);

  const [activeEditionId, setActiveEditionId] = useState<string | null>(null);
  const [activeEditionMatchday, setActiveEditionMatchday] = useState<number>(1);
  const [activeEditionName, setActiveEditionName] = useState<string>('Mi Liga');
  const [leagueSeason, setLeagueSeason] = useState<number | null>(null);

  const [myPick, setMyPick] = useState<Pick | null>(null);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);

  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingChampionshipId, setDeletingChampionshipId] = useState<string | null>(null);

  const [editionDeadlines, setEditionDeadlines] = useState<Record<string, EditionDeadline>>({});
  const [deadlinesLoading, setDeadlinesLoading] = useState(false);
  const [championshipMyPicks, setChampionshipMyPicks] = useState<Record<string, Pick | null>>({});
  const [myPicksLoading, setMyPicksLoading] = useState(false);

  const [nextDeadline, setNextDeadline] = useState<EditionDeadline | null>(null);
  const [nextDeadlineLoading, setNextDeadlineLoading] = useState(false);
  const [sidebarMatches, setSidebarMatches] = useState<MatchItem[]>([]);
  const [sidebarMatchesLoading, setSidebarMatchesLoading] = useState(false);
  const [recentActivity, setRecentActivity] = useState<NotificationItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (!loading && user) {
      fetch('/api/championships')
        .then((r) => r.json())
        .then((data) => setChampionships(Array.isArray(data) ? data : []))
        .catch(() => setChampionships([]))
        .finally(() => setFetching(false));
    } else if (!loading) {
      setFetching(false);
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || fetching) return;
    if (!user) return;

    const run = async () => {
      setError('');
      try {
        if (championships.length === 0) return;

        // 1) Intentamos con la edición que ya viene en /api/championships (solo trae 1).
        let candidate:
          | { championshipName: string; editionId: string; startMatchday: number }
          | null = null;

        for (const c of championships) {
          const e = c.editions?.[0];
          if (e?.status === 'ACTIVE') {
            candidate = { championshipName: c.name, editionId: e.id, startMatchday: e.startMatchday };
            break;
          }
        }

        // 2) Si no hay ACTIVE ahí, pedimos el detalle de cada campeonato y buscamos la edición activa.
        if (!candidate) {
          const full = await Promise.all(
            championships.map(async (c) => {
              const r = await fetch(`/api/championships/${c.id}`);
              const data = await r.json();
              return { champ: c, data };
            }),
          );

          for (const item of full) {
            const active = (item.data?.editions ?? []).find((e: any) => e.status === 'ACTIVE');
            if (active?.id) {
              candidate = {
                championshipName: item.champ.name,
                editionId: active.id,
                startMatchday: active.startMatchday,
              };
              break;
            }
          }
        }

        // 3) Fallback: primera edición disponible.
        if (!candidate) {
          const fallback = championships[0];
          const e = fallback.editions?.[0];
          if (!e?.id) return;
          candidate = { championshipName: fallback.name, editionId: e.id, startMatchday: e.startMatchday };
        }

        setActiveEditionId(candidate.editionId);
        setActiveEditionName(candidate.championshipName);
        setActiveEditionMatchday(candidate.startMatchday);

        setSidebarLoading(true);
        const [metaRes, pickRes, standingsRes] = await Promise.all([
          fetch(`/api/editions/${candidate.editionId}/meta`),
          fetch(`/api/editions/${candidate.editionId}/picks?matchday=${candidate.startMatchday}`),
          fetch(`/api/editions/${candidate.editionId}/standings`),
        ]);

        const meta: EditionMeta = await metaRes.json();
        setLeagueSeason(meta.season ?? null);
        setActiveEditionMatchday(meta.startMatchday ?? candidate.startMatchday);

        const picksData = await pickRes.json();
        setMyPick(picksData?.myPick ?? null);

        const standingsData = await standingsRes.json();
        setStandings(Array.isArray(standingsData) ? standingsData : []);
      } catch {
        setError('Error al cargar tu dashboard');
      } finally {
        setSidebarLoading(false);
      }
    };

    run();
  }, [loading, fetching, user, championships]);

  const { activePlayers, eliminatedPlayers, topRank } = useMemo(() => {
    const active = standings.filter((s) => s.status === 'ACTIVE').length;
    const eliminated = Math.max(0, standings.length - active);
    return { activePlayers: active, eliminatedPlayers: eliminated, topRank: standings.slice(0, 5) };
  }, [standings]);

  const createdChampionships = useMemo(() => {
    if (!user?.id) return [];
    return championships.filter((c) => c.adminId === user.id);
  }, [championships, user?.id]);

  const editionStartMatchdayById = useMemo(() => {
    const next: Record<string, number> = {};
    for (const c of createdChampionships) {
      const e = c.editions?.[0];
      if (e?.id && typeof e.startMatchday === 'number') next[e.id] = e.startMatchday;
    }
    return next;
  }, [createdChampionships]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setEditionDeadlines({});
        return;
      }

      const editionIds = createdChampionships
        .map((c) => c.editions?.[0]?.id)
        .filter((id): id is string => Boolean(id));

      if (editionIds.length === 0) {
        setEditionDeadlines({});
        return;
      }

      setDeadlinesLoading(true);
      try {
        const results = await Promise.all(
          editionIds.map(async (editionId) => {
            try {
              const res = await fetch(`/api/editions/${editionId}/deadline`);
              const data = await res.json();
              return { editionId, data };
            } catch {
              return { editionId, data: null };
            }
          }),
        );

        const next: Record<string, EditionDeadline> = {};
        for (const r of results) {
          next[r.editionId] = {
            matchdayNumber: r.data?.matchdayNumber ?? null,
            firstKickoff: r.data?.firstKickoff ?? null,
            matchdayStatus: r.data?.matchdayStatus ?? null,
          };
        }
        setEditionDeadlines(next);
      } finally {
        setDeadlinesLoading(false);
      }
    };

    run();
  }, [user?.id, createdChampionships]);

  useEffect(() => {
    const run = async () => {
      if (!activeEditionId) {
        setNextDeadline(null);
        return;
      }

      setNextDeadlineLoading(true);
      try {
        const res = await fetch(`/api/editions/${activeEditionId}/deadline`);
        const data = await res.json();
        setNextDeadline({
          matchdayNumber: data?.matchdayNumber ?? null,
          firstKickoff: data?.firstKickoff ?? null,
          matchdayStatus: data?.matchdayStatus ?? null,
        });
      } catch {
        setNextDeadline(null);
      } finally {
        setNextDeadlineLoading(false);
      }
    };

    if (loading || fetching) return;
    run();
  }, [activeEditionId, loading, fetching]);

  useEffect(() => {
    const run = async () => {
      if (!activeEditionId) {
        setSidebarMatches([]);
        return;
      }
      const md = nextDeadline?.matchdayNumber ?? activeEditionMatchday;
      if (!md) {
        setSidebarMatches([]);
        return;
      }

      setSidebarMatchesLoading(true);
      try {
        const res = await fetch(`/api/editions/${activeEditionId}/matches?matchday=${md}`);
        const data = await res.json();
        setSidebarMatches(Array.isArray(data) ? data : []);
      } catch {
        setSidebarMatches([]);
      } finally {
        setSidebarMatchesLoading(false);
      }
    };

    if (!loading && !fetching && !nextDeadlineLoading) run();
  }, [activeEditionId, activeEditionMatchday, nextDeadline?.matchdayNumber, nextDeadlineLoading, loading, fetching]);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setChampionshipMyPicks({});
        return;
      }

      const editionIds = Object.keys(editionDeadlines);
      if (editionIds.length === 0) {
        setChampionshipMyPicks({});
        return;
      }

      setMyPicksLoading(true);
      try {
        const results = await Promise.all(
          editionIds.map(async (editionId) => {
            const md = editionDeadlines[editionId]?.matchdayNumber ?? editionStartMatchdayById[editionId];
            if (!md) return { editionId, myPick: null };

            try {
              const res = await fetch(`/api/editions/${editionId}/picks?matchday=${md}`);
              const data = await res.json();
              return { editionId, myPick: data?.myPick ?? null };
            } catch {
              return { editionId, myPick: null };
            }
          }),
        );

        const next: Record<string, Pick | null> = {};
        for (const r of results) next[r.editionId] = r.myPick;
        setChampionshipMyPicks(next);
      } finally {
        setMyPicksLoading(false);
      }
    };

    if (!deadlinesLoading) run();
  }, [user?.id, editionDeadlines, deadlinesLoading]);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setRecentActivity([]);
        return;
      }
      setActivityLoading(true);
      try {
        const res = await fetch('/api/notifications?limit=5');
        const data = await res.json();
        setRecentActivity(Array.isArray(data?.notifications) ? data.notifications : []);
      } catch {
        setRecentActivity([]);
      } finally {
        setActivityLoading(false);
      }
    };

    if (!loading && !fetching) run();
  }, [user?.id, loading, fetching]);

  const reloadChampionships = async () => {
    setError('');
    setFetching(true);
    try {
      const res = await fetch('/api/championships');
      const data = await res.json();
      setChampionships(Array.isArray(data) ? data : []);
    } catch {
      setChampionships([]);
      setError('Error al recargar los campeonatos');
    } finally {
      setFetching(false);
    }
  };

  const handleDeleteChampionship = async (championshipId: string) => {
    if (deletingChampionshipId) return;
    const ok = window.confirm('¿Seguro que quieres eliminar este campeonato? Esta acción no se puede deshacer.');
    if (!ok) return;

    setDeletingChampionshipId(championshipId);
    setError('');
    try {
      const res = await fetch(`/api/championships/${championshipId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'No se pudo eliminar el campeonato');
      }
      await reloadChampionships();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo eliminar el campeonato');
    } finally {
      setDeletingChampionshipId(null);
    }
  };

  const formatDeadline = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-ES', {
      weekday: undefined,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewLeague = () => {
    if (activeEditionId) {
      router.push(`/edition/${activeEditionId}/standings`);
      return;
    }
    if (championships[0]?.id) {
      router.push(`/championship/${championships[0].id}`);
      return;
    }
    setError('No tienes una liga disponible todavía.');
  };

  const handleManageLeague = () => {
    if (createdChampionships[0]?.id) {
      router.push(`/championship/${createdChampionships[0].id}`);
      return;
    }
    router.push('/championship/new');
  };

  const formatCountdown = (iso: string | null) => {
    if (!iso) return '—';
    const diffMs = new Date(iso).getTime() - nowTs;
    if (Number.isNaN(diffMs)) return '—';
    if (diffMs <= 0) return 'Cerrada';
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const formatMatchKickoff = (iso: string | null) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleString('es-ES', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNotificationLabel = (n: NotificationItem) => {
    switch (n.type) {
      case 'JOIN_APPROVED':
        return 'Tu solicitud fue aprobada';
      case 'JOIN_REJECTED':
        return 'Tu solicitud fue rechazada';
      case 'PICK_REMINDER':
        return 'Recordatorio de pick';
      case 'NEW_JOIN_REQUEST':
        return 'Nueva solicitud para un campeonato';
      case 'EDITION_FINISHED':
        return 'Una edición ha finalizado';
      case 'INVITATION':
        return 'Has recibido una invitación';
      default:
        return n.type;
    }
  };

  const pendingJoinRequests = useMemo(
    () => createdChampionships.reduce((sum, c) => sum + (c._count?.joinRequests ?? 0), 0),
    [createdChampionships],
  );

  const contextualAlerts = useMemo(() => {
    const alerts: { id: string; text: string; tone: 'warning' | 'info' }[] = [];
    if (activeEditionId && !myPick) {
      alerts.push({ id: 'no-pick', tone: 'warning', text: 'Todavía no has hecho tu pick para la jornada actual.' });
    }
    if (nextDeadline?.firstKickoff) {
      const diffMs = new Date(nextDeadline.firstKickoff).getTime() - nowTs;
      if (!Number.isNaN(diffMs) && diffMs > 0 && diffMs <= 1000 * 60 * 60 * 24) {
        alerts.push({
          id: 'deadline-close',
          tone: 'warning',
          text: `La deadline está cerca: ${formatCountdown(nextDeadline.firstKickoff)} restantes.`,
        });
      }
    }
    if (pendingJoinRequests > 0) {
      alerts.push({
        id: 'admin-pending',
        tone: 'info',
        text: `Tienes ${pendingJoinRequests} solicitud(es) pendiente(s) de aprobación.`,
      });
    }
    return alerts;
  }, [activeEditionId, myPick, nextDeadline?.firstKickoff, nowTs, pendingJoinRequests]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url('${BG_IMAGE}')` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/65 to-slate-950/95" />

      <header className="relative z-10 h-16 px-6 flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-black/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-b from-yellow-400/30 to-yellow-600/15 border border-yellow-300/30 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-yellow-200" />
          </div>
          <div className="font-extrabold tracking-wide">Pick &amp; Survive</div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white/80 hover:text-white">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-200/90">
            <UserRound className="h-4 w-4" />
            {user?.alias}
          </div>
          <Button
            variant="outline"
            className="hidden sm:inline-flex border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={logout}
          >
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="relative z-10 flex gap-6 px-6 pt-6 pb-10">
        <aside className="hidden lg:flex w-72 flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 shadow-[0_25px_70px_rgba(0,0,0,0.35)] p-4">
            <div className="text-xs text-slate-300 font-semibold">Mi Liga</div>
            <div className="text-base font-bold mt-1">{activeEditionName}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Jornada</span>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-300/20 text-emerald-200">
                {activeEditionMatchday}
              </span>
            </div>
            {leagueSeason !== null && <div className="text-xs text-slate-300 mt-3">Temporada: {leagueSeason}</div>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
              onClick={() => router.push('/championship/new')}
            >
              <Trophy className="h-4 w-4" /> + Nuevo campeonato
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
              onClick={handleViewLeague}
            >
              <LayoutDashboard className="h-4 w-4" /> Ver Liga
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
              onClick={() => router.push('/profile')}
            >
              <UserRound className="h-4 w-4" /> Mi Perfil
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
              onClick={handleManageLeague}
            >
              <Settings2 className="h-4 w-4" /> Gestionar Liga
            </Button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="h-4 w-4 text-emerald-200" />
              Próxima Deadline
            </div>
            <div className="text-xs text-slate-300 mt-2">
              {nextDeadlineLoading
                ? 'Cargando...'
                : nextDeadline?.matchdayNumber
                  ? `J${nextDeadline.matchdayNumber} · ${formatDeadline(nextDeadline.firstKickoff)}`
                  : formatDeadline(nextDeadline?.firstKickoff ?? null)}
            </div>
            <div className="mt-4 text-xs text-emerald-200/95 bg-emerald-500/10 border border-emerald-300/20 rounded-lg px-3 py-2">
              ¡Haz tu pick antes del primer partido!
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="text-sm font-semibold text-slate-100">
              Partidos jornada {nextDeadline?.matchdayNumber ?? activeEditionMatchday}
            </div>
            <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
              {sidebarMatchesLoading ? (
                <div className="text-xs text-slate-400">Cargando partidos...</div>
              ) : sidebarMatches.length === 0 ? (
                <div className="text-xs text-slate-400">Sin partidos para mostrar.</div>
              ) : (
                sidebarMatches.map((m) => (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-cyan-200 font-semibold">
                        {formatMatchKickoff(m.kickoffTime)}
                      </span>
                      <span className="text-[11px] text-slate-400">{m.status}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <img
                        src={m.homeTeam.logoUrl}
                        alt={m.homeTeam.name}
                        title={m.homeTeam.name}
                        className="w-5 h-5 object-contain"
                      />
                      <span className="text-[11px] text-slate-300">vs</span>
                      <img
                        src={m.awayTeam.logoUrl}
                        alt={m.awayTeam.name}
                        title={m.awayTeam.name}
                        className="w-5 h-5 object-contain"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950/55 to-slate-950/20 shadow-[0_30px_90px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-300 font-semibold">
                    Edición Activa: Jornada {activeEditionMatchday}
                  </div>
                  <h1 className="text-xl font-extrabold mt-1">Tu pick elegido</h1>
                  <div className="text-xs text-slate-400 mt-1">
                    {activeEditionId ? 'Aquí tienes la selección que ya registraste.' : 'No hay edición activa.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {error && (
                <Alert variant="destructive" className="mb-4 border border-red-400/20 bg-red-500/10 text-white">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Clock3 className="h-4 w-4 text-cyan-200" />
                  Cabecera de estado de temporada
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="text-xs text-slate-300">Temporada</div>
                    <div className="text-lg font-extrabold mt-1">{leagueSeason ?? '—'}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="text-xs text-slate-300">Jornada actual</div>
                    <div className="text-lg font-extrabold mt-1">
                      {nextDeadline?.matchdayNumber ?? activeEditionMatchday}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="text-xs text-slate-300">Próxima deadline</div>
                    <div className="text-sm font-semibold mt-1">
                      {nextDeadlineLoading ? 'Cargando...' : formatDeadline(nextDeadline?.firstKickoff ?? null)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="text-xs text-slate-300">Cuenta atrás</div>
                    <div className="text-sm font-semibold mt-1 text-emerald-200">
                      {nextDeadlineLoading ? 'Cargando...' : formatCountdown(nextDeadline?.firstKickoff ?? null)}
                    </div>
                  </div>
                </div>
              </div>

              {contextualAlerts.length > 0 && (
                <div className="space-y-2 mb-4">
                  {contextualAlerts.map((a) => (
                    <Alert
                      key={a.id}
                      className={
                        a.tone === 'warning'
                          ? 'border border-amber-300/30 bg-amber-500/10 text-amber-100'
                          : 'border border-cyan-300/20 bg-cyan-500/10 text-cyan-100'
                      }
                    >
                      <AlertDescription className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {a.text}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {!activeEditionId ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200/80">
                  Aún no tienes una edición activa.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="rounded-2xl border-white/10 bg-slate-950/35 text-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                    <CardHeader className="pb-2">
                      <div className="text-sm font-semibold text-slate-200">Tu pick</div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {sidebarLoading ? (
                        <div className="text-xs text-slate-300">Cargando...</div>
                      ) : myPick ? (
                        <div className="flex items-center gap-3">
                          {myPick.team.logoUrl && (
                            <img
                              src={myPick.team.logoUrl}
                              alt={myPick.team.name}
                              className="w-12 h-12 object-contain"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{myPick.team.name}</div>
                            <div className="text-xs text-slate-300 mt-1">Estado: {myPick.status}</div>
                          </div>
                          <div className="ml-auto">
                            <Badge
                              variant={PICK_STATUS_BADGE[myPick.status] ?? 'default'}
                              className="text-xs border-white/10 bg-white/10 text-white"
                            >
                              {myPick.status}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-200/85">
                          Todavía no has elegido tu pick para esta jornada.
                        </div>
                      )}

                      <div className="mt-4 flex gap-3">
                        <Button onClick={() => router.push(`/edition/${activeEditionId}/standings`)} className="flex-1">
                          Abrir edición
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/edition/${activeEditionId}/standings`)}
                        >
                          Clasificación
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-slate-200 mb-3">Estado rápido</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                        <div className="text-xs text-slate-300 flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-200" />
                          Jugadores activos
                        </div>
                        <div className="text-lg font-extrabold mt-2 text-emerald-200">{activePlayers}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                        <div className="text-xs text-slate-300 flex items-center gap-2">
                          <Users className="h-4 w-4 text-red-200" />
                          Eliminados
                        </div>
                        <div className="text-lg font-extrabold mt-2 text-red-200">{eliminatedPlayers}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 mt-4">
                      Consejo: si quieres cambiar tu elección, hazlo desde la edición.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-slate-100 mb-3">Tu estado en la edición</div>
                  {sidebarLoading ? (
                    <div className="text-xs text-slate-300">Cargando...</div>
                  ) : !activeEditionId ? (
                    <div className="text-xs text-slate-300">Sin edición activa.</div>
                  ) : myPick ? (
                    <div className="space-y-2 text-sm">
                      <div className="text-slate-200">
                        Pick actual: <span className="font-semibold text-white">{myPick.team.name}</span>
                      </div>
                      <div className="text-slate-300">
                        Estado: <span className="font-semibold text-white">{myPick.status}</span>
                      </div>
                      <div className="text-slate-300">
                        Jornada: <span className="font-semibold text-white">{myPick.matchday.number}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300">Aún no has seleccionado pick para esta jornada.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-slate-100 mb-3">Resumen de participantes</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                      <div className="text-[11px] text-slate-300">Total</div>
                      <div className="text-lg font-bold mt-1">{standings.length}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                      <div className="text-[11px] text-slate-300">Activos</div>
                      <div className="text-lg font-bold mt-1 text-emerald-200">{activePlayers}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                      <div className="text-[11px] text-slate-300">Eliminados</div>
                      <div className="text-lg font-bold mt-1 text-red-200">{eliminatedPlayers}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 mb-3">
                    <Activity className="h-4 w-4 text-cyan-200" />
                    Actividad reciente
                  </div>
                  {activityLoading ? (
                    <div className="text-xs text-slate-300">Cargando actividad...</div>
                  ) : recentActivity.length === 0 ? (
                    <div className="text-xs text-slate-300">Aún no hay actividad reciente.</div>
                  ) : (
                    <div className="space-y-2">
                      {recentActivity.slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                          <div className="text-xs text-slate-100">{formatNotificationLabel(item)}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {new Date(item.createdAt).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg font-semibold text-slate-200">Resumen de campeonatos</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {createdChampionships.length > 0 ? `${createdChampionships.length} creados por ti` : 'Aún no has creado ninguno.'}
                  </div>
                </div>
              </div>

              {createdChampionships.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200/80">
                  Crea tu primer campeonato desde el botón <span className="font-semibold">+ Nuevo campeonato</span>.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {createdChampionships.map((c) => {
                    const latestEdition = c.editions?.[0];
                    const deadline =
                      latestEdition?.id ? editionDeadlines[latestEdition.id] : undefined;
                    const myPick =
                      latestEdition?.id ? championshipMyPicks[latestEdition.id] : null;
                    return (
                      <Card
                        key={c.id}
                        className="rounded-2xl border border-white/10 bg-white/5 text-white cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() =>
                          latestEdition?.id ? router.push(`/edition/${latestEdition.id}/standings`) : router.push(`/championship/${c.id}`)
                        }
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{c.name}</div>
                              <div className="text-xs text-slate-300 mt-1">
                                {c.footballLeague.name} • {c.footballLeague.country}
                              </div>
                            </div>

                            {c.adminId === user?.id && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="shrink-0"
                                disabled={deletingChampionshipId === c.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChampionship(c.id);
                                }}
                              >
                                {deletingChampionshipId === c.id ? 'Eliminando...' : 'Eliminar'}
                              </Button>
                            )}

                            {c.adminId === user?.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/championship/${c.id}/invite`);
                                }}
                              >
                                Invitar amigos
                              </Button>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0 pb-4">
                          {latestEdition ? (
                            <div className="space-y-4">
                              <div>
                                <div className="text-xs text-slate-300 font-semibold">
                                  {EDITION_STATUS_LABEL[latestEdition.status] ?? latestEdition.status} • Jornada{' '}
                                  <span className="font-extrabold text-white">
                                    {deadline?.matchdayNumber ?? latestEdition.startMatchday}
                                  </span>
                                </div>
                                <div className="mt-2 text-xs text-slate-300">
                                  Deadline:{' '}
                                  <span className="font-semibold text-white">
                                    {deadlinesLoading ? 'Cargando...' : formatDeadline(deadline?.firstKickoff ?? null)}
                                  </span>
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="text-xs text-slate-300 font-semibold mb-2">Tu pick</div>
                                {myPicksLoading ? (
                                  <div className="text-xs text-slate-300">Cargando...</div>
                                ) : myPick ? (
                                  <div className="flex items-center gap-3">
                                    {myPick.team.logoUrl && (
                                      <img
                                        src={myPick.team.logoUrl}
                                        alt={myPick.team.name}
                                        className="w-10 h-10 object-contain"
                                      />
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-semibold truncate">{myPick.team.name}</div>
                                      <div className="text-xs text-slate-300 mt-1">Estado: {myPick.status}</div>
                                    </div>
                                    <div className="ml-auto">
                                      <Badge
                                        variant={PICK_STATUS_BADGE[myPick.status] ?? 'default'}
                                        className="text-xs border-white/10 bg-white/10 text-white"
                                      >
                                        {myPick.status}
                                      </Badge>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200/85">
                                    Todavía no has elegido tu pick para esta jornada.
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="bg-white/10 text-white">
                                  {MODE_LABEL[c.mode] ?? c.mode}
                                </Badge>
                                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                                  {EDITION_STATUS_LABEL[latestEdition.status] ?? latestEdition.status}
                                </Badge>
                              </div>

                              <div className="flex gap-3 pt-1">
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (latestEdition.id) router.push(`/edition/${latestEdition.id}/standings`);
                                  }}
                                >
                                  Abrir edición
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-300">Sin ediciones todavía.</div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="hidden xl:flex w-80 flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Ranking de la Liga</div>
              <Link
                href={activeEditionId ? `/edition/${activeEditionId}/standings` : '/dashboard'}
                className="text-slate-200/80 hover:text-white"
              >
                <BarChart3 className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {sidebarLoading ? (
                <div className="text-xs text-slate-400">Cargando...</div>
              ) : topRank.length === 0 ? (
                <div className="text-xs text-slate-400">Sin datos todavía.</div>
              ) : (
                topRank.map((entry, idx) => (
                  <div
                    key={entry.participantId}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-950/30 border border-white/10"
                  >
                    <span className="text-xs text-slate-400 w-6">#{idx + 1}</span>
                    <span className="text-xs text-slate-200 truncate">@{entry.alias}</span>
                    <span className="text-xs text-yellow-200 font-semibold">
                      {entry.totalPoints ?? '—'} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="text-sm font-semibold text-slate-100">Estadísticas rápidas</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/30 border border-white/10">
                <span className="text-xs text-slate-300">Jugadores activos</span>
                <span className="text-xs font-semibold text-emerald-200">{activePlayers}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/30 border border-white/10">
                <span className="text-xs text-slate-300">Eliminados</span>
                <span className="text-xs font-semibold text-red-200">{eliminatedPlayers}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
