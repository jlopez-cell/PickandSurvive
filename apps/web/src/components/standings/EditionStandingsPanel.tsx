'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MobileTopHeader } from '@/components/mobile/MobileTopHeader';
import { Trophy, Clock3, Users, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StandingEntry = {
  participantId: string;
  alias: string;
  status?: string;
  eliminatedAtMatchday?: number | null;
  totalPoints?: number;
  survivedPickCount?: number;
  survivalStreak?: number;
  latestPick?: { team: { name: string; logoUrl: string }; status: string } | null;
};

export type EditionStandingsPanelProps = {
  editionId: string;
  championshipName?: string | null;
  variant: 'page' | 'embedded';
  showFullPageLink?: boolean;
};

function PageLeaderRow({
  entry,
  rank,
  ptsCell,
}: {
  entry: StandingEntry;
  rank: number;
  ptsCell: ReactNode;
}) {
  const initial = (entry.alias?.[0] ?? '?').toUpperCase();
  return (
    <div className="group rounded-xl border border-white/10 bg-gradient-to-br from-slate-950/55 via-slate-900/35 to-slate-950/50 p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/15">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-white/90 ring-1 ring-white/10">
            {rank}
          </span>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-black text-white/85">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white text-sm">@{entry.alias}</p>
            <div className="mt-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:hidden">
              {entry.latestPick && (
                <span className="flex items-center gap-1.5 text-[11px] text-white/55">
                  {entry.latestPick.team.logoUrl ? (
                    <img src={entry.latestPick.team.logoUrl} alt="" className="h-4 w-4 object-contain" />
                  ) : null}
                  {entry.latestPick.team.name}
                </span>
              )}
              {entry.survivedPickCount != null && (
                <span className="text-[11px] text-amber-200/80">
                  {entry.survivedPickCount}{' '}
                  {entry.survivedPickCount === 1 ? 'acierto' : 'aciertos'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 sm:pr-2">
          <div className="min-w-[4.5rem]">{ptsCell}</div>
          <div className="hidden min-w-0 max-w-[9rem] sm:block">
            {entry.latestPick ? (
              <div className="flex items-center gap-2">
                {entry.latestPick.team.logoUrl && (
                  <img
                    src={entry.latestPick.team.logoUrl}
                    alt=""
                    className="h-5 w-5 shrink-0 object-contain"
                  />
                )}
                <span className="truncate text-sm text-white/65">{entry.latestPick.team.name}</span>
              </div>
            ) : (
              <span className="text-sm text-white/35">—</span>
            )}
          </div>
          <div className="hidden w-24 text-right md:block">
            {entry.survivedPickCount != null ? (
              <span className="text-sm font-semibold tabular-nums text-amber-200/90">
                {entry.survivedPickCount}
                {(entry.survivalStreak ?? 0) >= 2 ? (
                  <span className="block text-[10px] font-normal text-white/45">{entry.survivalStreak} seguidos</span>
                ) : null}
              </span>
            ) : (
              <span className="text-sm text-white/35">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditionStandingsPanel({
  editionId,
  championshipName,
  variant,
  showFullPageLink = false,
}: EditionStandingsPanelProps) {
  const router = useRouter();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metaLoading, setMetaLoading] = useState(false);
  const [championshipNameMeta, setChampionshipNameMeta] = useState<string | null>(championshipName ?? null);

  const [deadline, setDeadline] = useState<{ matchdayNumber: number | null; firstKickoff: string | null } | null>(
    null,
  );
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const isEmbedded = variant === 'embedded';

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const summary = useMemo(() => {
    const total = standings.length;
    const hasStatus = standings.some((s) => typeof s.status === 'string');
    if (!hasStatus) return { total, active: null as number | null, eliminated: null as number | null };
    const active = standings.filter((s) => s.status === 'ACTIVE').length;
    return { total, active, eliminated: total - active };
  }, [standings]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/editions/${editionId}/standings`)
      .then((r) => {
        if (!r.ok) throw new Error('Sin acceso');
        return r.json();
      })
      .then(setStandings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [editionId]);

  useEffect(() => {
    if (championshipName !== undefined && championshipName !== null) {
      setChampionshipNameMeta(championshipName);
      return;
    }
    const run = async () => {
      setMetaLoading(true);
      try {
        const res = await fetch(`/api/editions/${editionId}/meta`);
        const data = await res.json();
        setChampionshipNameMeta(typeof data?.championshipName === 'string' ? data.championshipName : null);
      } catch {
        setChampionshipNameMeta(null);
      } finally {
        setMetaLoading(false);
      }
    };
    if (editionId) run();
  }, [editionId, championshipName]);

  useEffect(() => {
    const run = async () => {
      if (!editionId) return;
      setDeadlineLoading(true);
      try {
        const res = await fetch(`/api/editions/${editionId}/deadline`);
        const data = await res.json();
        setDeadline({
          matchdayNumber: data?.matchdayNumber ?? null,
          firstKickoff: data?.firstKickoff ?? null,
        });
      } catch {
        setDeadline(null);
      } finally {
        setDeadlineLoading(false);
      }
    };
    if (editionId) run();
  }, [editionId]);

  const formatDeadline = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  const ptsEstadoCell = (entry: StandingEntry, light = true) => {
    const ptsLine =
      entry.totalPoints !== undefined ? (
        <div className={cn('font-extrabold tabular-nums', light ? 'text-white/95' : 'text-foreground')}>
          {entry.totalPoints} pts
        </div>
      ) : null;

    const statusLine =
      entry.status != null && entry.status !== '' ? (
        <div
          className={cn(
            'text-sm font-semibold',
            entry.status === 'ACTIVE'
            ? light
              ? 'text-emerald-300'
              : 'text-emerald-600 dark:text-emerald-300'
            : light
              ? 'text-red-300'
              : 'text-red-600 dark:text-red-400',
          )}
        >
          {entry.status === 'ACTIVE' ? 'ACTIVO' : `ELIM. J${entry.eliminatedAtMatchday ?? '—'}`}
        </div>
      ) : null;

    if (!ptsLine && !statusLine) {
      return <div className={light ? 'text-white/45' : 'text-muted-foreground'}>—</div>;
    }

    return (
      <div className="flex flex-col gap-0.5">
        {ptsLine}
        {statusLine}
      </div>
    );
  };

  const statCardClass = isEmbedded
    ? 'rounded-xl border border-border bg-card/80 p-4 shadow-sm'
    : 'rounded-xl border border-white/10 bg-slate-950/35 p-3 backdrop-blur-sm';

  const statLabelClass = isEmbedded
    ? 'text-xs text-muted-foreground font-semibold tracking-wide'
    : 'text-[11px] text-white/55 font-semibold tracking-wide';

  /* ─── Vista página (rediseño) ─── */
  const innerPage = (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Clasificación
        </h1>
        {metaLoading ? (
          <p className="mt-1 text-sm text-white/50">…</p>
        ) : championshipNameMeta ? (
          <p className="mt-1 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-100">
            <Trophy className="h-4 w-4 text-amber-300" />
            {championshipNameMeta}
          </p>
        ) : null}
        <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-cyan-200">
            J{deadline?.matchdayNumber ?? '—'}
          </span>
          Jornada actual
        </p>
      </div>

      {loading ? (
        <p className="text-white/60">Cargando clasificación…</p>
      ) : error ? (
        <p className="text-red-300">{error}</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
            <div className={statCardClass}>
              <div className={statLabelClass}>JORNADA</div>
              <div className="mt-1.5 text-2xl font-black tabular-nums text-cyan-200">J{deadline?.matchdayNumber ?? '—'}</div>
            </div>
            <div className={statCardClass}>
              <div className={statLabelClass}>ACTIVOS</div>
              <div className="mt-1.5 text-2xl font-black tabular-nums text-emerald-300">{summary.active ?? 0}</div>
            </div>
            <div className={statCardClass}>
              <div className={statLabelClass}>ELIMINADOS</div>
              <div className="mt-1.5 text-2xl font-black tabular-nums text-red-300">{summary.eliminated ?? 0}</div>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-950/30 via-slate-950/45 to-emerald-950/20 p-3.5 backdrop-blur-md">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-start gap-3">
                <div className="rounded-xl bg-white/10 p-2">
                  <Users className="h-5 w-5 text-cyan-200" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">Tu pick cuenta esta jornada</p>
                  <p className="mt-0.5 text-[13px] text-white/55">Un equipo por jugador y solo una vez por liga.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-white/70">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 shrink-0 text-cyan-300" />
                    <span>
                      Cierre:{' '}
                      <span className="font-semibold text-white">
                        {deadlineLoading ? '…' : formatDeadline(deadline?.firstKickoff ?? null)}
                      </span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">
                    {deadlineLoading ? '' : formatCountdown(deadline?.firstKickoff ?? null)}
                  </p>
                </div>
                <Button
                  className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 font-semibold text-white shadow-lg shadow-emerald-900/40 hover:from-emerald-500 hover:to-emerald-600"
                  onClick={() => router.push(`/edition/${editionId}`)}
                >
                  Elegir pick
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <h2 className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/55">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
            Clasificación
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
          </h2>

          <div className="hidden lg:block pb-4">
            <Card className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="w-12 text-[11px] uppercase tracking-wide text-white/55">#</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-white/55">Jugador</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-white/55">PTS / Estado</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-white/55">Pick</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-white/55 text-right">Aciertos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((entry, idx) => {
                            const initial = (entry.alias?.[0] ?? '?').toUpperCase();
                            return (
                              <TableRow
                                key={entry.participantId}
                                className={cn(
                                  'border-white/10 hover:bg-white/[0.03]',
                                  idx < 3 && 'bg-white/[0.03]',
                                )}
                              >
                                <TableCell className="font-semibold text-white/65">{idx + 1}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-extrabold text-white/85">
                                      {initial}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate font-semibold text-white">@{entry.alias}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>{ptsEstadoCell(entry, true)}</TableCell>
                                <TableCell>
                                  {entry.latestPick ? (
                                    <div className="flex items-center gap-2">
                                      {entry.latestPick.team.logoUrl && (
                                        <img
                                          src={entry.latestPick.team.logoUrl}
                                          alt=""
                                          className="h-6 w-6 object-contain"
                                        />
                                      )}
                                      <span className="text-sm text-white/75">{entry.latestPick.team.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-white/35">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {entry.survivedPickCount != null ? (
                                    <span className="font-semibold tabular-nums text-amber-200">
                                      {entry.survivedPickCount}
                                    </span>
                                  ) : (
                                    <span className="text-white/35">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-2 pb-4 lg:hidden">
            {standings.map((entry, idx) => (
              <PageLeaderRow
                key={entry.participantId}
                entry={entry}
                rank={idx + 1}
                ptsCell={ptsEstadoCell(entry, true)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );

  /* ─── Vista embebida (tabla compacta) ─── */
  const innerEmbedded = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Trophy className="h-5 w-5 text-amber-500" />
            Clasificación
          </h2>
          {championshipNameMeta ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{championshipNameMeta}</p>
          ) : metaLoading ? (
            <p className="mt-0.5 text-sm text-muted-foreground">…</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Jornada {deadlineLoading ? '…' : deadline?.matchdayNumber ?? '—'}
          </p>
        </div>
        {showFullPageLink && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => router.push(`/edition/${editionId}/standings`)}>
            Pantalla completa
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={statCardClass}>
              <div className={statLabelClass}>JORNADA</div>
              <div className="mt-2 text-2xl font-extrabold text-primary">J{deadline?.matchdayNumber ?? '—'}</div>
            </div>
            <div className={statCardClass}>
              <div className={statLabelClass}>ACTIVOS</div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{summary.active ?? 0}</div>
            </div>
            <div className={statCardClass}>
              <div className={statLabelClass}>ELIMINADOS</div>
              <div className="mt-2 text-2xl font-extrabold text-red-600 dark:text-red-400">{summary.eliminated ?? 0}</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-muted-foreground">Elige tu pick antes del cierre de jornada.</p>
              <Button size="sm" onClick={() => router.push(`/edition/${editionId}`)}>
                Elegir pick
              </Button>
            </div>
          </div>

          <Card className="mt-5 overflow-hidden rounded-xl border border-border shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-xs uppercase text-muted-foreground">#</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Jugador</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">PTS / Estado</TableHead>
                    <TableHead className="hidden sm:table-cell text-xs uppercase text-muted-foreground">Pick</TableHead>
                    <TableHead className="hidden md:table-cell text-xs uppercase text-muted-foreground">Racha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((entry, idx) => {
                    const initial = (entry.alias?.[0] ?? '?').toUpperCase();
                    return (
                      <TableRow key={entry.participantId}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-sm font-extrabold">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold">@{entry.alias}</div>
                              <div className="mt-1 space-y-1 text-[11px] text-muted-foreground sm:hidden">
                                {entry.latestPick && (
                                  <div className="flex items-center gap-1">
                                    {entry.latestPick.team.logoUrl && (
                                      <img src={entry.latestPick.team.logoUrl} alt="" className="h-4 w-4 object-contain" />
                                    )}
                                    <span>{entry.latestPick.team.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{ptsEstadoCell(entry, false)}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {entry.latestPick ? (
                            <div className="flex items-center gap-2">
                              {entry.latestPick.team.logoUrl && (
                                <img src={entry.latestPick.team.logoUrl} alt="" className="h-6 w-6 object-contain rounded" />
                              )}
                              <span className="text-sm text-muted-foreground">{entry.latestPick.team.name}</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {entry.survivedPickCount != null ? (
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-200">
                              {entry.survivedPickCount}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </>
  );

  if (isEmbedded) {
    return <section className="mb-8 rounded-2xl border border-border bg-card/50 p-4 sm:p-5">{innerEmbedded}</section>;
  }

  return (
    <main className="relative min-h-screen overflow-hidden pb-24 text-white bg-background">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/95 via-slate-950/75 to-slate-950/95" />
      <MobileTopHeader />

      <div className="relative z-10 mx-auto max-w-6xl px-3.5 py-5 sm:px-5 sm:py-7 lg:px-8 pt-[max(1.0rem,env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-white/75 hover:bg-white/10 hover:text-white"
          onClick={() => router.back()}
        >
          ← Volver
        </Button>
        {innerPage}
      </div>
    </main>
  );
}
