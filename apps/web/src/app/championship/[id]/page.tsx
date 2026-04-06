'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  mode: 'TOURNAMENT' | 'LEAGUE';
  adminId: string;
  pickResetAtMidseason: boolean;
  footballLeague: { id: string; name: string; country: string };
  editions: Edition[];
  admin: { id: string; alias: string };
};

const MODE_LABEL: Record<string, string> = { TOURNAMENT: 'Torneo', LEAGUE: 'Liga' };
const EDITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', OPEN: 'Abierta', ACTIVE: 'Activa', FINISHED: 'Finalizada', CANCELLED: 'Cancelada',
};
type BadgeVariant = 'muted' | 'default' | 'success' | 'warning' | 'destructive';
const STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: 'muted', OPEN: 'default', ACTIVE: 'success', FINISHED: 'muted', CANCELLED: 'destructive',
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
  const [deleting, setDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const shellBg = (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url('/dashboard-hero.jpeg')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/65 to-slate-950/95" />
    </>
  );

  if (authLoading || fetching) {
    return (
      <div className="relative min-h-screen text-white overflow-hidden">
        {shellBg}
        <main className="relative z-10 flex min-h-screen items-center justify-center text-white/70">
          Cargando…
        </main>
      </div>
    );
  }

  if (error || !championship) {
    return (
      <div className="relative min-h-screen text-white overflow-hidden">
        {shellBg}
        <main className="relative z-10 p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <p className="text-red-300 mb-4">{error || 'Campeonato no encontrado'}</p>
          <Button
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => router.push('/dashboard')}
          >
            ← Volver al dashboard
          </Button>
        </main>
      </div>
    );
  }

  const isAdmin = championship.adminId === user?.id;

  const standingsStats = (() => {
    if (!standingsRows || standingsRows.length === 0) return null;
    const hasStatus = standingsRows.some((s) => typeof s.status === 'string');
    const total = standingsRows.length;
    if (!hasStatus) return { total, active: null as number | null, eliminated: null as number | null };
    const active = standingsRows.filter((s) => s.status === 'ACTIVE').length;
    return { total, active, eliminated: total - active };
  })();

  const btnOutlineLight =
    'border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white';

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      {shellBg}
      <MobileTopHeader />
      <main className="relative z-10 min-h-screen px-4 sm:px-6 pb-24 pt-4 md:pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 -ml-2 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => router.push('/dashboard')}
          >
            ← Volver
          </Button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-50 mb-1">{championship.name}</h1>
              <p className="text-sm text-slate-300">
                {championship.footballLeague.name} · {championship.footballLeague.country} ·{' '}
                {MODE_LABEL[championship.mode]}
                {championship.pickResetAtMidseason && ' · Reset media vuelta'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Admin: @{championship.admin.alias}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {pickEdition && (
                <Button size="sm" variant="success" onClick={() => router.push(`/edition/${pickEdition.id}`)}>
                  Elegir pick
                </Button>
              )}
              {standingsEdition && (
                <Button
                  size="sm"
                  variant="outline"
                  className={`gap-1.5 md:hidden ${btnOutlineLight}`}
                  onClick={() => router.push(`/edition/${standingsEdition.id}/standings`)}
                >
                  <Trophy className="h-4 w-4" />
                  Clasificación
                </Button>
              )}
              {isAdmin && (
                <>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => router.push(`/championship/${id}/invite`)}
                  >
                    Invitaciones
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={btnOutlineLight}
                    onClick={() => router.push(`/championship/${id}/edition/new`)}
                  >
                    + Nueva edición
                  </Button>
                  <Button size="sm" variant="outline" className={btnOutlineLight} onClick={() => setSettingsOpen(true)}>
                    Ajustes
                  </Button>
                </>
              )}
            </div>
          </div>

          {standingsEdition && (
            <Card className="mb-8 rounded-2xl border-white/10 bg-slate-950/35 text-white md:hidden">
              <CardContent className="py-4 sm:py-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-50">Estado de la liga</div>
                    <div className="text-xs text-slate-400">
                      Participantes en la edición actual (
                      {EDITION_STATUS_LABEL[standingsEdition.status] ?? standingsEdition.status})
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center sm:text-left">
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Activos</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
                      {standingsLoading ? '…' : standingsError ? '—' : (standingsStats?.active ?? '—')}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center sm:text-left">
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Eliminados</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-red-300">
                      {standingsLoading ? '…' : standingsError ? '—' : (standingsStats?.eliminated ?? '—')}
                    </div>
                  </div>
                </div>
                {!standingsLoading && !standingsError && standingsStats && standingsStats.active === null && (
                  <p className="text-xs text-slate-400 mt-3">
                    Los contadores se mostrarán cuando el estado de cada jugador esté disponible en esta edición.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {pickEdition && (
            <Card className="mb-6 rounded-2xl border-white/10 bg-slate-950/35 text-white md:hidden">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Tu pick de la jornada</div>
                    <div className="text-xs text-slate-400">
                      {pickPreviewLoading
                        ? 'Comprobando pick...'
                        : myPickPreview?.team?.name
                          ? 'Ya tienes pick hecho'
                          : 'Aun no has hecho pick'}
                    </div>
                  </div>
                  {myPickPreview?.team?.name ? (
                    <Badge variant="success" className="border border-emerald-300/25 bg-emerald-500/15 text-emerald-200">
                      Pick hecho
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="border border-amber-300/25 bg-amber-500/15 text-amber-200">
                      Sin pick
                    </Badge>
                  )}
                </div>

                {myPickPreview?.team?.name && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    {myPickPreview.team.logoUrl ? (
                      <img src={myPickPreview.team.logoUrl} alt={myPickPreview.team.name} className="h-5 w-5 object-contain" />
                    ) : null}
                    <span className="text-sm text-slate-100">{myPickPreview.team.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <h2 className="text-base font-semibold text-slate-100 mb-4">Ediciones</h2>

          {championship.editions.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-white/20 bg-slate-950/25">
              <p className="text-slate-400 mb-4">No hay ediciones todavía.</p>
              {isAdmin && (
                <Button size="sm" variant="success" onClick={() => router.push(`/championship/${id}/edition/new`)}>
                  Crear primera edición
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {championship.editions.map((edition) => (
                <Card key={edition.id} className="rounded-2xl border-white/10 bg-slate-950/35 text-white">
                  <CardContent className="py-4 flex justify-between items-center gap-4">
                    <div>
                      <span className="font-semibold text-slate-50 text-sm">
                        Jornada {edition.startMatchday}
                        {edition.endMatchday ? ` → ${edition.endMatchday}` : ''}
                      </span>
                      {edition.potAmountCents > 0 && (
                        <span className="text-slate-400 text-xs ml-2">
                          · Bote: {(edition.potAmountCents / 100).toFixed(2)} €/persona
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={STATUS_BADGE[edition.status] ?? 'muted'}
                        className="border border-white/10 bg-white/5"
                      >
                        {EDITION_STATUS_LABEL[edition.status]}
                      </Badge>
                      {isAdmin && edition.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handlePublish(edition.id)}
                          disabled={publishing === edition.id}
                        >
                          {publishing === edition.id ? 'Publicando...' : 'Publicar'}
                        </Button>
                      )}
                      {isAdmin && edition.status === 'OPEN' && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleActivate(edition.id)}
                          disabled={activating === edition.id}
                        >
                          {activating === edition.id ? 'Activando...' : 'Activar'}
                        </Button>
                      )}
                      {(edition.status === 'ACTIVE' || edition.status === 'OPEN') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={btnOutlineLight}
                          onClick={() => router.push(`/edition/${edition.id}`)}
                        >
                          Ver →
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {isAdmin && settingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[1px]">
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.55)] p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Ajustes del campeonato</div>
                    <div className="text-xs text-slate-400">Acciones avanzadas</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => setSettingsOpen(false)}
                  >
                    Cerrar
                  </Button>
                </div>

                <Card className="border-white/10 bg-slate-950/35 text-white">
                  <CardContent className="py-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Eliminar campeonato</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Borra el campeonato y sus ediciones. Esta acción no se puede deshacer.
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteChampionship}
                      disabled={deleting}
                    >
                      {deleting ? 'Eliminando...' : 'Eliminar'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
