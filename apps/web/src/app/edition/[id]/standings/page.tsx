'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, AlertTriangle, Clock3, Users } from 'lucide-react';

const BG_IMAGE =
  "https://images.unsplash.com/photo-1508098682722-e99c43a1c5e8?auto=format&fit=crop&w=1600&q=80";

type StandingEntry = {
  participantId: string;
  alias: string;
  status?: string;
  eliminatedAtMatchday?: number | null;
  totalPoints?: number;
  latestPick?: { team: { name: string; logoUrl: string }; status: string } | null;
};

export default function StandingsPage() {
  const { id: editionId } = useParams<{ id: string }>();
  const router = useRouter();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [championshipName, setChampionshipName] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const [deadline, setDeadline] = useState<{ matchdayNumber: number | null; firstKickoff: string | null } | null>(null);
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

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
    const run = async () => {
      setMetaLoading(true);
      try {
        const res = await fetch(`/api/editions/${editionId}/meta`);
        const data = await res.json();
        setChampionshipName(typeof data?.championshipName === 'string' ? data.championshipName : null);
      } catch {
        setChampionshipName(null);
      } finally {
        setMetaLoading(false);
      }
    };

    if (editionId) run();
  }, [editionId]);

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

  return (
    <main className="relative min-h-screen text-white overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url('${BG_IMAGE}')` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/65 to-slate-950/95" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-6">
        <Button variant="ghost" size="sm" className="-ml-2 mb-6 text-white/70 hover:text-white" onClick={() => router.back()}>
          ← Volver
        </Button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight">
              Clasificación{' '}
              {metaLoading ? (
                <span className="text-white/60 text-sm font-semibold">—</span>
              ) : championshipName ? (
                <span className="ml-2 inline-flex items-center rounded-md border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-200">
                  {championshipName}
                </span>
              ) : null}
            </h1>

            <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
              <Trophy className="h-4 w-4 text-yellow-200" />
              {deadlineLoading ? 'Cargando jornada...' : `Jornada ${deadline?.matchdayNumber ?? '—'}`}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-white/70">Cargando...</p>
        ) : error ? (
          <p className="text-red-200">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs text-white/50 font-semibold tracking-wide">JORNADA ACTUAL</div>
                <div className="mt-2 text-3xl font-extrabold text-cyan-200">J{deadline?.matchdayNumber ?? '—'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs text-white/50 font-semibold tracking-wide">ACTIVOS</div>
                <div className="mt-2 text-3xl font-extrabold text-emerald-200">{summary.active ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs text-white/50 font-semibold tracking-wide">ELIMINADOS</div>
                <div className="mt-2 text-3xl font-extrabold text-red-200">{summary.eliminated ?? 0}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 mb-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-white/70" />
                    <div className="text-lg font-extrabold">Elige tu pick para esta jornada</div>
                  </div>
                  <div className="mt-2 text-sm text-white/60">
                    Cada equipo solo puede usarse una vez en toda la liga.
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-start lg:justify-end">
                  <div className="hidden md:block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-cyan-200" />
                      <span>
                        Cierre de picks:{' '}
                        <span className="font-semibold text-white">
                          {deadlineLoading ? 'Cargando...' : formatDeadline(deadline?.firstKickoff ?? null)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-white/50">
                      {deadlineLoading ? '' : `· ${formatCountdown(deadline?.firstKickoff ?? null)} antes del inicio`}
                    </div>
                  </div>

                  <Button
                    className="bg-white/10 hover:bg-white/15 border border-white/10 text-white px-6"
                    onClick={() => router.push(`/edition/${editionId}`)}
                  >
                    Elegir pick
                  </Button>
                </div>
              </div>

              <div className="mt-4 md:hidden flex items-center justify-between text-xs text-white/60">
                <span>
                  Cierre de picks: <span className="text-white font-semibold">{formatDeadline(deadline?.firstKickoff ?? null)}</span>
                </span>
                <span className="text-white/70">{formatCountdown(deadline?.firstKickoff ?? null)}</span>
              </div>
            </div>

            <Card className="rounded-2xl border border-white/10 bg-slate-950/35 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-xs uppercase tracking-wide text-white/50">#</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-white/50">Jugador</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-white/50">PTS / Estado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-white/50">Pick actual</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-white/50">Racha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((entry, idx) => {
                    const initial = (entry.alias?.[0] ?? '?').toUpperCase();
                    return (
                      <TableRow key={entry.participantId} className="border-white/10">
                        <TableCell className="text-white/60">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/80 font-extrabold">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white/90 truncate">@{entry.alias}</div>
                              {entry.status && (
                                <div className="mt-1">
                                  <Badge
                                    variant={entry.status === 'ACTIVE' ? 'success' : 'destructive'}
                                    className="bg-transparent text-white border-white/10"
                                  >
                                    {entry.status === 'ACTIVE' ? 'ACTIVO' : `ELIM. J${entry.eliminatedAtMatchday ?? '—'}`}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.totalPoints !== undefined ? (
                            <div className="font-extrabold text-white/90">{entry.totalPoints} pts</div>
                          ) : (
                            <div className="text-white/50">—</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.latestPick ? (
                            <div className="flex items-center gap-2">
                              {entry.latestPick.team.logoUrl && (
                                <img
                                  src={entry.latestPick.team.logoUrl}
                                  alt={entry.latestPick.team.name}
                                  className="w-6 h-6 object-contain rounded"
                                />
                              )}
                              <span className="text-white/70 text-sm">{entry.latestPick.team.name}</span>
                            </div>
                          ) : (
                            <div className="text-white/50">—</div>
                          )}
                        </TableCell>
                        <TableCell className="text-white/50">—</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
