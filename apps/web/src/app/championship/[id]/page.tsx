'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { MobileTopHeader } from '@/components/mobile/MobileTopHeader';
import { Trophy } from 'lucide-react';

type Edition = {
  id: string;
  status: string;
  startMatchday: number;
  endMatchday: number | null;
  potAmountCents: number;
  createdAt: string;
};

type Championship = {
  id: string;
  name: string;
  mode: 'TOURNAMENT' | 'LEAGUE' | 'WORLD_CUP';
  adminId: string;
  pickResetAtMidseason: boolean;
  footballLeague: { id: string; name: string; country: string };
  editions: Edition[];
  admin: { id: string; alias: string };
};

const MODE_LABEL: Record<string, string> = { TOURNAMENT: 'Torneo', LEAGUE: 'Liga', WORLD_CUP: 'World Cup' };
const EDITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', OPEN: 'Abierta', ACTIVE: 'Activa', FINISHED: 'Finalizada', CANCELLED: 'Cancelada',
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  OPEN: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  FINISHED: 'bg-secondary text-muted-foreground border-border',
  CANCELLED: 'bg-red-500/15 text-red-300 border-red-500/25',
};

function pickStandingsEdition(editions: Edition[]): Edition | null {
  const active = editions.find((e) => e.status === 'ACTIVE');
  if (active) return active;
  const open = editions.find((e) => e.status === 'OPEN');
  if (open) return open;
  const finished = [...editions]
    .filter((e) => e.status === 'FINISHED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return finished[0] ?? null;
}

type StandingRow = { status?: string };
type MyPickPreview = { team?: { name: string; logoUrl?: string | null } | null; status?: string | null } | null;

export default function ChampionshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [syncingMembers, setSyncingMembers] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'ediciones' | 'ajustes'>('ediciones');
  const [standingsRows, setStandingsRows] = useState<StandingRow[] | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState(false);
  const [myPickPreview, setMyPickPreview] = useState<MyPickPreview>(null);
  const [pickPreviewLoading, setPickPreviewLoading] = useState(false);
  /** Solo layout móvil (mismo corte que `md:hidden`: menos de 768px). */
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const fetchChampionship = () => {
    fetch(`/api/championships/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('No encontrado');
        return r.json();
      })
      .then(setChampionship)
      .catch((e) => setError(e.message))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (!authLoading) fetchChampionship();
  }, [id, authLoading]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const standingsEdition =
    championship && !fetching ? pickStandingsEdition(championship.editions) : null;
  const pickEdition =
    championship && !fetching
      ? (championship.editions.find((e) => e.status === 'ACTIVE') ??
        championship.editions.find((e) => e.status === 'OPEN') ??
        null)
      : null;

  useEffect(() => {
    if (!standingsEdition?.id || authLoading || fetching || !isMobileViewport) {
      return;
    }
    let cancelled = false;
    setStandingsLoading(true);
    setStandingsError(false);
    fetch(`/api/editions/${standingsEdition.id}/standings`)
      .then((r) => {
        if (!r.ok) throw new Error('standings');
        return r.json();
      })
      .then((data: StandingRow[]) => {
        if (!cancelled) setStandingsRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setStandingsError(true);
          setStandingsRows(null);
        }
      })
      .finally(() => {
        if (!cancelled) setStandingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [standingsEdition?.id, authLoading, fetching, isMobileViewport]);

  useEffect(() => {
    if (!pickEdition?.id || authLoading || fetching || !isMobileViewport) {
      setMyPickPreview(null);
      return;
    }
    let cancelled = false;
    setPickPreviewLoading(true);

    (async () => {
      try {
        const deadlineRes = await fetch(`/api/editions/${pickEdition.id}/deadline`);
        const deadlineData = await deadlineRes.json().catch(() => ({}));
        const matchday = Number(deadlineData?.matchdayNumber ?? pickEdition.startMatchday);

        const picksRes = await fetch(`/api/editions/${pickEdition.id}/picks?matchday=${matchday}`);
        const picksData = await picksRes.json().catch(() => ({}));

        if (!cancelled) {
          setMyPickPreview(picksData?.myPick ?? null);
        }
      } catch {
        if (!cancelled) setMyPickPreview(null);
      } finally {
        if (!cancelled) setPickPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pickEdition?.id, pickEdition?.startMatchday, authLoading, fetching, isMobileViewport]);

  const handlePublish = async (editionId: string) => {
    setPublishing(editionId);
    const res = await fetch(`/api/championships/${id}/editions/${editionId}/publish`, { method: 'PATCH' });
    if (res.ok) fetchChampionship();
    setPublishing(null);
  };

  const handleActivate = async (editionId: string) => {
    setActivating(editionId);
    const res = await fetch(`/api/championships/${id}/editions/${editionId}/activate`, { method: 'PATCH' });
    if (res.ok) fetchChampionship();
    setActivating(null);
  };

  const handleSyncMembers = async (editionId: string) => {
    setSyncingMembers(editionId);
    const res = await fetch(`/api/championships/${id}/editions/${editionId}/sync-members`, { method: 'POST' });
    if (res.ok) fetchChampionship();
    setSyncingMembers(null);
  };

  const handleDeleteChampionship = async () => {
    if (deleting) return;
    const ok = window.confirm('¿Seguro que quieres eliminar este campeonato? Esta acción no se puede deshacer.');
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/championships/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'No se pudo eliminar el campeonato');
      }
      router.push('/dashboard?tab=leagues');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo eliminar el campeonato');
      setDeleting(false);
    }
  };

  const isWcMode = championship?.mode === 'WORLD_CUP';

  const standingsStats = (() => {
    if (!standingsRows || standingsRows.length === 0) return null;
    const hasStatus = standingsRows.some((s) => typeof s.status === 'string');
    const total = standingsRows.length;
    if (!hasStatus) return { total, active: null as number | null, eliminated: null as number | null };
    const active = standingsRows.filter((s) => s.status === 'ACTIVE').length;
    return { total, active, eliminated: total - active };
  })();

  if (authLoading || fetching) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center text-muted-foreground">
          Cargando…
        </main>
      </div>
    );
  }

  if (error || !championship) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <p className="text-red-400 mb-4">{error || 'Campeonato no encontrado'}</p>
          <button
            className="bg-secondary border border-border text-muted-foreground rounded-xl px-4 py-2 text-sm"
            onClick={() => router.push('/dashboard')}
          >
            ← Volver al dashboard
          </button>
        </main>
      </div>
    );
  }

  const isAdmin = championship.adminId === user?.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileTopHeader />
      <main className="min-h-screen px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)] pt-3 sm:px-6 sm:pt-6">
        <div className="max-w-3xl mx-auto">
          <button
            className="mb-6 -ml-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={() => pickEdition ? router.push(`/edition/${pickEdition.id}`) : router.push('/dashboard')}
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <h1 className={`text-2xl font-bold break-words min-w-0 ${isWcMode ? 'text-amber-500' : 'text-foreground'}`}>
                  {championship.name}
                </h1>
                {isWcMode && (
                  <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-500">
                    WC 2026
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground break-words">
                {championship.footballLeague.name} · {championship.footballLeague.country} ·{' '}
                {MODE_LABEL[championship.mode]}
                {championship.pickResetAtMidseason && ' · Reset media vuelta'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Admin: @{championship.admin.alias}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <>
                  <button
                    className="w-full sm:w-auto bg-amber-500 text-black font-bold rounded-xl px-4 py-2 text-sm"
                    onClick={() => router.push(`/championship/${id}/invite`)}
                  >
                    Invitaciones
                  </button>
                  <button
                    className="w-full sm:w-auto bg-secondary border border-border text-muted-foreground rounded-xl px-4 py-2 text-sm"
                    onClick={() => router.push(`/championship/${id}/edition/new`)}
                  >
                    + Nueva edición
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Standings preview card - mobile only */}
          {standingsEdition && (
            <div className={`mb-8 rounded-2xl border p-4 sm:p-5 md:hidden ${isWcMode ? 'border-amber-500/20 bg-card' : 'border-border bg-card'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <div className="font-semibold text-foreground">Estado de la liga</div>
                  <div className="text-xs text-muted-foreground">
                    Participantes en la edición actual (
                    {EDITION_STATUS_LABEL[standingsEdition.status] ?? standingsEdition.status})
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-center sm:text-left">
                  <div className="text-xs font-medium text-muted-foreground">Activos</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-500">
                    {standingsLoading ? '…' : standingsError ? '—' : (standingsStats?.active ?? '—')}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-center sm:text-left">
                  <div className="text-xs font-medium text-muted-foreground">Eliminados</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-red-500">
                    {standingsLoading ? '…' : standingsError ? '—' : (standingsStats?.eliminated ?? '—')}
                  </div>
                </div>
              </div>
              {!standingsLoading && !standingsError && standingsStats && standingsStats.active === null && (
                <p className="text-xs text-muted-foreground mt-3">
                  Los contadores se mostrarán cuando el estado de cada jugador esté disponible en esta edición.
                </p>
              )}
            </div>
          )}

          {/* Pick preview card - mobile only */}
          {pickEdition && (
            <div className={`mb-6 rounded-2xl border p-4 md:hidden ${isWcMode ? 'border-amber-500/20 bg-card' : 'border-border bg-card'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Tu pick de la jornada</div>
                  <div className="text-xs text-muted-foreground">
                    {pickPreviewLoading
                      ? 'Comprobando pick...'
                      : myPickPreview?.team?.name
                        ? 'Ya tienes pick hecho'
                        : 'Aun no has hecho pick'}
                  </div>
                </div>
                {myPickPreview?.team?.name ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                    Pick hecho
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    Sin pick
                  </span>
                )}
              </div>

              {myPickPreview?.team?.name && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2">
                  {myPickPreview.team.logoUrl ? (
                    <img src={myPickPreview.team.logoUrl} alt={myPickPreview.team.name} className="h-5 w-5 object-contain" />
                  ) : null}
                  <span className="text-sm text-foreground">{myPickPreview.team.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            {([
              { key: 'ediciones' as const, label: 'Ediciones' },
              { key: 'ajustes' as const, label: 'Ajustes' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative pb-3 mr-6 text-sm font-medium transition-colors ${
                  activeTab === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
                }`}
              >
                {label}
                {activeTab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-amber-500" />
                )}
              </button>
            ))}
          </div>

          {/* Tab: Ediciones */}
          {activeTab === 'ediciones' && (
            <>
              {championship.editions.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-secondary/30">
                  <p className="text-muted-foreground mb-4">No hay ediciones todavía.</p>
                  {isAdmin && (
                    <button
                      className="bg-emerald-500 text-white font-bold rounded-xl px-4 py-2 text-sm"
                      onClick={() => router.push(`/championship/${id}/edition/new`)}
                    >
                      Crear primera edición
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {championship.editions.map((edition) => (
                    <div
                      key={edition.id}
                      className={`rounded-2xl border p-4 bg-card ${isWcMode ? 'border-amber-500/20' : 'border-border'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div className="min-w-0">
                          <span className="font-bold text-foreground text-sm">
                            Jornada {edition.startMatchday}
                            {edition.endMatchday ? ` → ${edition.endMatchday}` : ''}
                          </span>
                          {edition.potAmountCents > 0 && (
                            <span className="text-muted-foreground text-xs ml-2">
                              · Bote: {(edition.potAmountCents / 100).toFixed(2)} €/persona
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_BADGE_CLASS[edition.status] ?? 'bg-secondary text-muted-foreground border-border'}`}>
                            {EDITION_STATUS_LABEL[edition.status]}
                          </span>
                          {isAdmin && (edition.status === 'DRAFT' || edition.status === 'OPEN') && (
                            <button
                              className="bg-emerald-500 text-white font-bold rounded-xl px-3 py-1.5 text-xs disabled:opacity-50"
                              onClick={() => handleActivate(edition.id)}
                              disabled={activating === edition.id}
                            >
                              {activating === edition.id ? 'Activando...' : 'Activar'}
                            </button>
                          )}
                          {isAdmin &&
                            (edition.status === 'DRAFT' ||
                              edition.status === 'OPEN' ||
                              edition.status === 'ACTIVE') && (
                              <button
                                className="bg-secondary border border-border text-muted-foreground rounded-xl px-3 py-1.5 text-xs disabled:opacity-50"
                                title="Añade a la edición a los miembros aprobados y a quienes jugaron la última edición finalizada (sin nueva invitación)"
                                onClick={() => handleSyncMembers(edition.id)}
                                disabled={syncingMembers === edition.id}
                              >
                                {syncingMembers === edition.id ? 'Sincronizando…' : (
                                  <>
                                    <span className="sm:hidden">Sincronizar</span>
                                    <span className="hidden sm:inline">Sincronizar jugadores</span>
                                  </>
                                )}
                              </button>
                            )}
                          {(edition.status === 'ACTIVE' || edition.status === 'OPEN') && (
                            <button
                              className="bg-secondary border border-border text-muted-foreground rounded-xl px-3 py-1.5 text-xs"
                              onClick={() => router.push(
                                championship.mode === 'WORLD_CUP'
                                  ? `/world-cup/${edition.id}`
                                  : `/edition/${edition.id}`
                              )}
                            >
                              Ver →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Tab: Ajustes */}
          {activeTab === 'ajustes' && (
            <div className="flex flex-col gap-4">
              <div className={`rounded-2xl border p-4 bg-card ${isWcMode ? 'border-amber-500/20' : 'border-border'}`}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Información</div>
                <dl className="flex flex-col gap-3.5">
                  <div className="flex justify-between gap-3">
                    <dt className="text-sm text-muted-foreground shrink-0">Nombre</dt>
                    <dd className="text-sm text-foreground font-medium text-right break-words min-w-0">{championship.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sm text-muted-foreground shrink-0">Modo</dt>
                    <dd className="text-sm text-foreground font-medium text-right">{MODE_LABEL[championship.mode]}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sm text-muted-foreground shrink-0">Liga</dt>
                    <dd className="text-sm text-foreground font-medium text-right">{championship.footballLeague.name} · {championship.footballLeague.country}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sm text-muted-foreground shrink-0">Creado por</dt>
                    <dd className="text-sm text-foreground font-medium text-right">@{championship.admin.alias}</dd>
                  </div>
                  {standingsEdition && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-sm text-muted-foreground shrink-0">Jornada</dt>
                      <dd className="text-sm text-foreground font-medium text-right">
                        {standingsEdition.startMatchday}
                        {standingsEdition.endMatchday ? ` → ${standingsEdition.endMatchday}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {isAdmin && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-4">
                  <div className="text-xs font-medium text-red-400 uppercase tracking-wider mb-4">Zona de peligro</div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground">Eliminar campeonato</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Borra el campeonato y sus ediciones. Esta acción no se puede deshacer.
                      </div>
                    </div>
                    <button
                      className="bg-red-500 text-white font-bold rounded-xl px-3 py-1.5 text-sm disabled:opacity-50 shrink-0"
                      onClick={handleDeleteChampionship}
                      disabled={deleting}
                    >
                      {deleting ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
