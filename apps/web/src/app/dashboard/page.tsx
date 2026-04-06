'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Menu,
  Settings2,
  Trash2,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

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

  const [mobileTab, setMobileTab] = useState<'home' | 'leagues' | 'notifications' | 'profile'>('home');

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
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
        const [metaRes, standingsRes] = await Promise.all([
          fetch(`/api/editions/${candidate.editionId}/meta`),
          fetch(`/api/editions/${candidate.editionId}/standings`),
        ]);

        const meta: EditionMeta = await metaRes.json();
        setLeagueSeason(meta.season ?? null);
        setActiveEditionMatchday(meta.startMatchday ?? candidate.startMatchday);

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
    for (const c of championships) {
      const e = c.editions?.[0];
      if (e?.id && typeof e.startMatchday === 'number') next[e.id] = e.startMatchday;
    }
    return next;
  }, [championships]);

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

      const editionIds = championships
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
  }, [user?.id, championships]);

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
        if (typeof data?.matchdayNumber === 'number') {
          setActiveEditionMatchday(data.matchdayNumber);
        }
      } catch {
        setNextDeadline(null);
      } finally {
        setNextDeadlineLoading(false);
      }
    };

    if (loading || fetching) return;
    run();
    const intervalId = setInterval(run, 30 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [activeEditionId, loading, fetching]);

  const fetchSidebarMatches = useCallback(async () => {
    if (loading || fetching || nextDeadlineLoading) return;
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
  }, [
    activeEditionId,
    activeEditionMatchday,
    nextDeadline?.matchdayNumber,
    loading,
    fetching,
    nextDeadlineLoading,
  ]);

  useEffect(() => {
    fetchSidebarMatches();
    // Misma cadencia aproximada que el sync de resultados en API (solo lectura de BD).
    const intervalId = setInterval(fetchSidebarMatches, 30 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchSidebarMatches]);

  useEffect(() => {
    const run = async () => {
      if (!activeEditionId) {
        setMyPick(null);
        return;
      }

      const md = nextDeadline?.matchdayNumber ?? activeEditionMatchday;
      if (!md) {
        setMyPick(null);
        return;
      }

      try {
        const res = await fetch(`/api/editions/${activeEditionId}/picks?matchday=${md}`);
        const data = await res.json();
        setMyPick(data?.myPick ?? null);
      } catch {
        setMyPick(null);
      }
    };

    if (loading || fetching || nextDeadlineLoading) return;
    run();
  }, [
    activeEditionId,
    activeEditionMatchday,
    nextDeadline?.matchdayNumber,
    loading,
    fetching,
    nextDeadlineLoading,
  ]);

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

  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20');
      const data = await res.json();
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markNotificationAsRead = useCallback(async (id: string) => {
    setMarkingNotificationId(id);
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setRecentActivity((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } finally {
      setMarkingNotificationId(null);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setDeletingNotificationId(id);
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setRecentActivity((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setDeletingNotificationId(null);
    }
  }, []);

  const getNotificationPrimaryAction = useCallback(
    (n: NotificationItem): { label: string; action: () => void } | null => {
      const payload = n.payload as Record<string, unknown> | undefined;
      const championshipId = typeof payload?.championshipId === 'string' ? payload.championshipId : null;
      const editionId = typeof payload?.editionId === 'string' ? payload.editionId : null;
      const inviteToken =
        typeof payload?.token === 'string'
          ? payload.token
          : typeof payload?.inviteToken === 'string'
            ? payload.inviteToken
            : typeof payload?.invitationToken === 'string'
              ? payload.invitationToken
              : null;

      if (n.type === 'NEW_JOIN_REQUEST' && championshipId) {
        return {
          label: 'Ver y aprobar',
          action: () => {
            router.push(`/championship/${championshipId}/invite`);
            setNotificationsOpen(false);
          },
        };
      }
      if (n.type === 'INVITATION' && championshipId) {
        return {
          label: 'Ver invitación',
          action: () => {
            if (inviteToken) {
              router.push(`/join/${inviteToken}`);
            } else {
              router.push(`/championship/${championshipId}`);
            }
            setNotificationsOpen(false);
          },
        };
      }
      if (n.type === 'PICK_REMINDER' && editionId) {
        return {
          label: 'Ir a elegir pick',
          action: () => {
            router.push(`/edition/${editionId}`);
            setNotificationsOpen(false);
          },
        };
      }
      return null;
    },
    [router],
  );

  const unreadNotificationsCount = useMemo(() => {
    const source = notifications.length > 0 ? notifications : recentActivity;
    return source.filter((n) => !n.read).length;
  }, [notifications, recentActivity]);

  useEffect(() => {
    if (!notificationsOpen || !user?.id) return;
    void fetchNotifications();
  }, [notificationsOpen, user?.id, fetchNotifications]);

  useEffect(() => {
    if (mobileTab !== 'notifications' || !user?.id) return;
    void fetchNotifications();
  }, [mobileTab, user?.id, fetchNotifications]);

  const SyncTabFromUrl = ({ onTab }: { onTab: (tab: 'home' | 'leagues' | 'notifications' | 'profile') => void }) => {
    const sp = useSearchParams();
    useEffect(() => {
      const raw = (sp.get('tab') || '').toLowerCase();
      if (raw === 'notifications' || raw === 'leagues' || raw === 'profile' || raw === 'home') {
        onTab(raw as any);
      }
    }, [sp, onTab]);
    return null;
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
      <Suspense fallback={null}>
        <SyncTabFromUrl onTab={setMobileTab} />
      </Suspense>
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
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden text-white/90 hover:text-white hover:bg-white/10"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-white/80 hover:text-white"
            onClick={() => setNotificationsOpen(true)}
            aria-label="Abrir notificaciones"
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
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

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-[1px]">
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm bg-slate-950 border-l border-white/10 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-slate-100">Menú</div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push('/championship/new');
                }}
              >
                <Trophy className="h-4 w-4" /> + Nuevo campeonato
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleViewLeague();
                }}
              >
                <LayoutDashboard className="h-4 w-4" /> Ver Liga
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push('/profile');
                }}
              >
                <UserRound className="h-4 w-4" /> Mi Perfil
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-white/85 hover:text-white hover:bg-white/5"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleManageLeague();
                }}
              >
                <Settings2 className="h-4 w-4" /> Gestionar Liga
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-red-200 hover:text-red-100 hover:bg-red-500/10"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
              >
                <UserRound className="h-4 w-4" /> Cerrar sesión
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="text-sm font-semibold text-slate-100 mb-2">Resumen de campeonatos</div>
              {createdChampionships.length === 0 ? (
                <div className="text-xs text-slate-400">Aún no has creado ninguno.</div>
              ) : (
                <div className="space-y-2">
                  {createdChampionships.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        const latestEdition = c.editions?.[0];
                        if (latestEdition?.id) router.push(`/edition/${latestEdition.id}/standings`);
                        else router.push(`/championship/${c.id}`);
                      }}
                    >
                      <div className="text-xs font-semibold text-slate-100 truncate">{c.name}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {c.footballLeague.name} · {MODE_LABEL[c.mode] ?? c.mode}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-100">
                  Calendario actual (J{nextDeadline?.matchdayNumber ?? activeEditionMatchday})
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => void fetchSidebarMatches()}
                  disabled={sidebarMatchesLoading}
                >
                  {sidebarMatchesLoading ? '…' : 'Actualizar'}
                </Button>
              </div>
              <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                {sidebarMatchesLoading ? (
                  <div className="text-xs text-slate-400">Cargando partidos...</div>
                ) : sidebarMatches.length === 0 ? (
                  <div className="text-xs text-slate-400">Sin partidos para mostrar.</div>
                ) : (
                  sidebarMatches.slice(0, 8).map((m) => (
                    <div key={m.id} className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-cyan-200 font-semibold">{formatMatchKickoff(m.kickoffTime)}</span>
                        <span className="text-[11px] text-slate-400">{m.status}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <img src={m.homeTeam.logoUrl} alt={m.homeTeam.name} className="w-5 h-5 object-contain" />
                        <span className="text-[11px] text-slate-300">vs</span>
                        <img src={m.awayTeam.logoUrl} alt={m.awayTeam.name} className="w-5 h-5 object-contain" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[1px]">
          <div className="absolute right-0 top-0 h-full w-[92%] max-w-md bg-slate-950 border-l border-white/10 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Notificaciones</div>
                <div className="text-xs text-slate-400">Revisa recordatorios y solicitudes</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setNotificationsOpen(false)}
                aria-label="Cerrar notificaciones"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mb-3">
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void fetchNotifications()}
                disabled={notificationsLoading}
              >
                {notificationsLoading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>

            <div className="space-y-3">
              {notificationsLoading ? (
                <div className="text-sm text-slate-400">Cargando notificaciones...</div>
              ) : notifications.length === 0 ? (
                <div className="text-sm text-slate-400">No tienes notificaciones por ahora.</div>
              ) : (
                notifications.map((n) => {
                  const primaryAction = getNotificationPrimaryAction(n);
                  return (
                    <div key={n.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-100">{formatNotificationLabel(n)}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {new Date(n.createdAt).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        {!n.read && <Badge variant="destructive">Nueva</Badge>}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {primaryAction && (
                          <Button
                            size="sm"
                            className="h-8 bg-cyan-500/85 hover:bg-cyan-500 text-slate-950"
                            onClick={() => {
                              if (!n.read) void markNotificationAsRead(n.id);
                              primaryAction.action();
                            }}
                          >
                            {primaryAction.label}
                          </Button>
                        )}
                        {!n.read && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={() => void markNotificationAsRead(n.id)}
                            disabled={markingNotificationId === n.id}
                          >
                            {markingNotificationId === n.id ? 'Marcando...' : 'Marcar como leída'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => void deleteNotification(n.id)}
                          disabled={deletingNotificationId === n.id}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deletingNotificationId === n.id ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 lg:hidden px-4 pt-4 pb-24">
        <div className="rounded-3xl border border-white/10 bg-slate-950/35 shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="text-xs text-slate-300">Hola,</div>
            <div className="text-lg font-extrabold text-slate-50">@{user?.alias ?? 'usuario'}</div>
            <div className="text-xs text-slate-400 mt-1">Elige una liga o revisa tus notificaciones.</div>
          </div>

          <div className="p-4">
            {mobileTab === 'home' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/25 overflow-hidden">
                  <img
                    src="/dashboard-hero.jpeg"
                    alt="Pick & Survive"
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-3">
                    <div className="text-sm font-semibold text-slate-100">Próxima deadline</div>
                    <div className="text-xs text-slate-300 mt-1">
                      {nextDeadlineLoading
                        ? 'Cargando...'
                        : nextDeadline?.matchdayNumber
                          ? `J${nextDeadline.matchdayNumber} · ${formatDeadline(nextDeadline.firstKickoff)}`
                          : formatDeadline(nextDeadline?.firstKickoff ?? null)}
                    </div>
                    <div className="text-xs text-emerald-200 mt-1">
                      {nextDeadlineLoading ? '—' : formatCountdown(nextDeadline?.firstKickoff ?? null)}
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-base font-extrabold bg-emerald-500 hover:bg-emerald-500/90 text-slate-950"
                  onClick={() => router.push('/dashboard?tab=leagues')}
                >
                  Elegir pick
                </Button>

                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-100">Resumen de campeonatos</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => router.push('/dashboard?tab=leagues')}
                    >
                      Ver todos
                    </Button>
                  </div>

                  {championships.length === 0 ? (
                    <div className="mt-3 text-xs text-slate-400">Aún no tienes ligas.</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {championships.slice(0, 4).map((c) => {
                        const e = c.editions?.[0];
                        const status = e?.status ?? '—';
                        const joinReq = c._count?.joinRequests ?? 0;
                        return (
                          <button
                            key={c.id}
                            className="text-left rounded-xl border border-white/10 bg-slate-950/25 hover:bg-slate-950/35 transition px-3 py-2"
                            onClick={() => router.push(`/championship/${c.id}`)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-50 truncate">{c.name}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                  {c.mode === 'LEAGUE' ? 'Liga' : 'Torneo'} · {c.footballLeague?.name ?? '—'}
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                <Badge variant="secondary">{status}</Badge>
                                {joinReq > 0 && <div className="text-[10px] text-cyan-200">{joinReq} solicitud(es)</div>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-100">
                      Calendario (J{nextDeadline?.matchdayNumber ?? activeEditionMatchday})
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => void fetchSidebarMatches()}
                      disabled={sidebarMatchesLoading}
                    >
                      {sidebarMatchesLoading ? '…' : 'Actualizar'}
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {sidebarMatchesLoading ? (
                      <div className="text-xs text-slate-400">Cargando partidos...</div>
                    ) : sidebarMatches.length === 0 ? (
                      <div className="text-xs text-slate-400">Sin partidos para mostrar.</div>
                    ) : (
                      sidebarMatches.slice(0, 8).map((m) => {
                        const st = (m.status || '').toUpperCase();
                        const finished = st === 'FINISHED' || st === 'FT' || st === 'AET' || st === 'PEN';
                        return (
                          <div key={m.id} className="rounded-xl border border-white/10 bg-slate-950/25 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-cyan-200 font-semibold">
                                {formatMatchKickoff(m.kickoffTime)}
                              </span>
                              <span className="text-[11px] text-slate-400">{finished ? 'Final' : m.status}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-2">
                              <img src={m.homeTeam.logoUrl} alt={m.homeTeam.name} className="w-5 h-5 object-contain" />
                              {finished ? (
                                <span className="text-sm font-extrabold text-emerald-200 tabular-nums min-w-[3.5rem] text-center">
                                  {m.homeScore ?? '—'} – {m.awayScore ?? '—'}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-300">vs</span>
                              )}
                              <img src={m.awayTeam.logoUrl} alt={m.awayTeam.name} className="w-5 h-5 object-contain" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {mobileTab === 'leagues' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-100">Mis ligas</div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => router.push('/join-code')}
                    >
                      Unirme por código
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => router.push('/championship/new')}
                    >
                      + Nueva
                    </Button>
                  </div>
                </div>

                {championships.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    Aún no tienes ligas. Crea una para empezar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {championships.map((c) => {
                      const e = c.editions?.[0];
                      const status = e?.status ?? '—';
                      const md = e?.startMatchday ?? null;
                      const joinReq = c._count?.joinRequests ?? 0;
                      const editionId = e?.id ?? null;
                      const pick = editionId ? championshipMyPicks[editionId] : null;
                      const hasPick = Boolean(pick?.team?.logoUrl);
                      const deadlineMd =
                        editionId ? (editionDeadlines[editionId]?.matchdayNumber ?? null) : null;
                      const shouldWarnNoPick = editionId && deadlineMd !== null && !pick && !myPicksLoading;
                      return (
                        <button
                          key={c.id}
                          className="text-left rounded-2xl border border-white/10 bg-slate-950/30 hover:bg-slate-950/40 transition px-4 py-3"
                          onClick={() => {
                            router.push(`/championship/${c.id}`);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-50 truncate">{c.name}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {c.mode === 'LEAGUE' ? 'Liga' : 'Torneo'} · {c.footballLeague?.name ?? '—'}
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <Badge variant="secondary">{status}</Badge>
                              {joinReq > 0 && (
                                <div className="text-[11px] text-cyan-200">{joinReq} solicitud(es)</div>
                              )}
                              {myPicksLoading ? (
                                <div className="text-[11px] text-slate-400">Pick…</div>
                              ) : hasPick ? (
                                <div className="flex items-center gap-1 text-[11px] text-emerald-200">
                                  <img
                                    src={pick!.team.logoUrl}
                                    alt={pick!.team.name}
                                    title={pick!.team.name}
                                    className="w-4 h-4 object-contain"
                                  />
                                  Pick
                                </div>
                              ) : shouldWarnNoPick ? (
                                <div className="flex items-center gap-1 text-[11px] text-amber-200">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Sin pick
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {md !== null && (
                            <div className="mt-2 text-xs text-slate-300">
                              Inicio: jornada {md}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {mobileTab === 'notifications' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-100">Notificaciones</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => void fetchNotifications()}
                    disabled={notificationsLoading}
                  >
                    {notificationsLoading ? 'Actualizando...' : 'Actualizar'}
                  </Button>
                </div>

                {notificationsLoading ? (
                  <div className="text-sm text-slate-400">Cargando notificaciones...</div>
                ) : notifications.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    No tienes notificaciones por ahora.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((n) => {
                      const primaryAction = getNotificationPrimaryAction(n);
                      return (
                        <div key={n.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-100">{formatNotificationLabel(n)}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {new Date(n.createdAt).toLocaleString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                            {!n.read && <Badge variant="destructive">Nueva</Badge>}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {primaryAction && (
                              <Button
                                size="sm"
                                className="h-8 bg-cyan-500/85 hover:bg-cyan-500 text-slate-950"
                                onClick={() => {
                                  if (!n.read) void markNotificationAsRead(n.id);
                                  primaryAction.action();
                                }}
                              >
                                {primaryAction.label}
                              </Button>
                            )}
                            {!n.read && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                                onClick={() => void markNotificationAsRead(n.id)}
                                disabled={markingNotificationId === n.id}
                              >
                                {markingNotificationId === n.id ? 'Marcando...' : 'Marcar como leída'}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                              onClick={() => void deleteNotification(n.id)}
                              disabled={deletingNotificationId === n.id}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deletingNotificationId === n.id ? 'Eliminando...' : 'Eliminar'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {mobileTab === 'profile' ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-100">Perfil</div>
                <Button
                  variant="outline"
                  className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => router.push('/profile')}
                >
                  Ver mi perfil
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={logout}
                >
                  Cerrar sesión
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <MobileBottomNav unreadCount={unreadNotificationsCount} />
      </div>

      <div className="relative z-10 hidden lg:flex gap-6 px-6 pt-6 pb-10">
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
              onClick={() => router.push('/join-code')}
            >
              <UserPlus className="h-4 w-4" /> Unirme por código
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
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">
                Partidos jornada {nextDeadline?.matchdayNumber ?? activeEditionMatchday}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void fetchSidebarMatches()}
                disabled={sidebarMatchesLoading}
              >
                {sidebarMatchesLoading ? '…' : 'Actualizar'}
              </Button>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Marcadores al finalizar: vienen de tu BD (el servidor sincroniza con la API externa, p. ej. cada 30–90 min).
            </div>
            <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
              {sidebarMatchesLoading ? (
                <div className="text-xs text-slate-400">Cargando partidos...</div>
              ) : sidebarMatches.length === 0 ? (
                <div className="text-xs text-slate-400">Sin partidos para mostrar.</div>
              ) : (
                sidebarMatches.map((m) => {
                  const st = (m.status || '').toUpperCase();
                  const finished =
                    st === 'FINISHED' ||
                    st === 'FT' ||
                    st === 'AET' ||
                    st === 'PEN';
                  return (
                    <div key={m.id} className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-cyan-200 font-semibold">
                          {formatMatchKickoff(m.kickoffTime)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {finished ? 'Final' : m.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <img
                          src={m.homeTeam.logoUrl}
                          alt={m.homeTeam.name}
                          title={m.homeTeam.name}
                          className="w-5 h-5 object-contain"
                        />
                        {finished ? (
                          <span className="text-sm font-extrabold text-emerald-200 tabular-nums min-w-[3.5rem] text-center">
                            {m.homeScore ?? '—'} – {m.awayScore ?? '—'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">vs</span>
                        )}
                        <img
                          src={m.awayTeam.logoUrl}
                          alt={m.awayTeam.name}
                          title={m.awayTeam.name}
                          className="w-5 h-5 object-contain"
                        />
                      </div>
                    </div>
                  );
                })
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg font-semibold text-slate-200">Resumen de campeonatos</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {championships.length > 0 ? `${championships.length} en los que participas` : 'Aún no participas en ninguno.'}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => router.push('/join-code')}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Unirme por código
                </Button>
              </div>

              {championships.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200/80">
                  Crea tu primer campeonato desde el botón <span className="font-semibold">+ Nuevo campeonato</span>.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {championships.map((c) => {
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
