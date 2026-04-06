'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { MobileTopHeader } from '@/components/mobile/MobileTopHeader';

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
type Pick = {
  id: string;
  status: string;
  team: { id: string; name: string; logoUrl: string };
  participant: { user: { alias: string } };
  matchday: { number: number; status: string };
};

type PickBadge = 'muted' | 'success' | 'warning' | 'destructive' | 'default';
const PICK_STATUS_BADGE: Record<string, PickBadge> = {
  PENDING: 'muted',
  SURVIVED: 'success',
  DRAW_ELIMINATED: 'warning',
  LOSS_ELIMINATED: 'destructive',
  NO_PICK_ELIMINATED: 'destructive',
  POSTPONED_PENDING: 'default',
};

export default function EditionPage() {
  const { id: editionId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [editionStartMatchday, setEditionStartMatchday] = useState<number | null>(null);
  const [leagueSeason, setLeagueSeason] = useState<number | null>(null);

  const [currentMatchday, setCurrentMatchday] = useState<number>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myPick, setMyPick] = useState<Pick | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [participantEliminated, setParticipantEliminated] = useState(false);
  const [participantStatusLoading, setParticipantStatusLoading] = useState(false);
  const [matchdayFirstKickoff, setMatchdayFirstKickoff] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const deadlinePassed = useMemo(() => {
    if (!matchdayFirstKickoff) return false;
    const ts = new Date(matchdayFirstKickoff).getTime();
    if (Number.isNaN(ts)) return false;
    return nowTs >= ts;
  }, [matchdayFirstKickoff, nowTs]);

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

      setMatches(Array.isArray(matchesData) ? matchesData : []);
      if (Array.isArray(matchesData) && matchesData.length > 0) {
        const kickoffValues = matchesData
          .map((m: any) => m?.kickoffTime)
          .filter((k: any) => typeof k === 'string' && !Number.isNaN(new Date(k).getTime()))
          .map((k: string) => new Date(k).getTime());
        if (kickoffValues.length > 0) {
          const minTs = Math.min(...kickoffValues);
          setMatchdayFirstKickoff(new Date(minTs).toISOString());
        } else {
          setMatchdayFirstKickoff(null);
        }
      } else {
        setMatchdayFirstKickoff(null);
      }
      if (picksData && typeof picksData === 'object') {
        setMyPick(picksData.myPick ?? null);
      } else {
        setMyPick(null);
      }
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  useEffect(() => {
    if (authLoading) return;

    // Load edition meta first, so we start on the correct matchday (edition.startMatchday).
    setEditionStartMatchday(null);
    setLeagueSeason(null);
    setLoading(true);

    fetch(`/api/editions/${editionId}/meta`)
      .then((r) => r.json())
      .then(async (meta) => {
        const start = Number(meta.startMatchday);
        const startMd = Number.isFinite(start) ? start : 1;
        const endMd = meta.endMatchday != null ? Number(meta.endMatchday) : null;
        setEditionStartMatchday(startMd);
        setLeagueSeason(meta.season ?? null);

        let initialMd = startMd;
        try {
          const dRes = await fetch(`/api/editions/${editionId}/deadline`);
          const dData = await dRes.json();
          const current = Number(dData?.matchdayNumber);
          if (Number.isFinite(current)) {
            initialMd = current;
            if (endMd != null && Number.isFinite(endMd)) {
              initialMd = Math.min(Math.max(initialMd, startMd), endMd);
            } else {
              initialMd = Math.max(initialMd, startMd);
            }
          }
        } catch {
          /* mantener startMd */
        }
        setCurrentMatchday(initialMd);
      })
      .catch(() => {
        setError('Error al cargar la configuración de la edición');
        setEditionStartMatchday(1);
        setLeagueSeason(null);
        setCurrentMatchday(1);
        setLoading(false);
      });
  }, [authLoading, editionId]);

  useEffect(() => {
    if (authLoading) return;
    if (editionStartMatchday === null) return;
    loadData(currentMatchday);
  }, [authLoading, editionStartMatchday, currentMatchday, loadData]);

  useEffect(() => {
    const run = async () => {
      if (!user?.alias) {
        setParticipantEliminated(false);
        return;
      }
      setParticipantStatusLoading(true);
      try {
        const res = await fetch(`/api/editions/${editionId}/standings`);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        const me = rows.find((r: any) => r?.alias === user.alias);
        setParticipantEliminated(me?.status === 'ELIMINATED');
      } catch {
        setParticipantEliminated(false);
      } finally {
        setParticipantStatusLoading(false);
      }
    };

    if (!authLoading) run();
  }, [editionId, user?.alias, authLoading]);

  const handlePick = async (teamId: string) => {
    if (participantEliminated) {
      setError('Estás eliminado de esta edición y no puedes elegir picks.');
      return;
    }
    if (deadlinePassed) {
      setError('La deadline de esta jornada ya ha pasado. No puedes cambiar tu pick.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/editions/${editionId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, matchdayNumber: currentMatchday }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(msg || 'Error al registrar el pick');
        return;
      }
      setSuccess('¡Pick registrado!');
      await loadData(currentMatchday);
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileTopHeader />
      <main className="p-4 sm:p-6 pb-24">
      <div className="max-w-3xl mx-auto">
        {/* Top bar */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => router.back()}>
            ← Volver
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push(`/edition/${editionId}/standings`)}>
              Clasificación
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push(`/edition/${editionId}/history`)}>
              Historial
            </Button>
          </div>
        </div>

        {/* Matchday header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Jornada {currentMatchday}</h1>
            {leagueSeason !== null && (
              <p className="text-xs text-muted-foreground/60">
                Temporada: {leagueSeason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setCurrentMatchday((m) => Math.max(1, m - 1))}
              disabled={currentMatchday <= 1}
            >
              ‹
            </Button>
            <span className="text-sm text-muted-foreground w-6 text-center">J{currentMatchday}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setCurrentMatchday((m) => m + 1)}
            >
              ›
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {participantEliminated && !participantStatusLoading && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Estás eliminado en esta edición. No puedes elegir ni modificar picks hasta la siguiente edición.
            </AlertDescription>
          </Alert>
        )}
        {deadlinePassed && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              La deadline de esta jornada ya ha pasado. No puedes elegir ni modificar picks.
            </AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <section>
          {myPick && (
            <Card className="mb-6">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2">Tu pick</p>
                <div className="flex items-center gap-3">
                  {myPick.team.logoUrl && (
                    <img src={myPick.team.logoUrl} alt={myPick.team.name} className="w-12 h-12 object-contain" />
                  )}
                  <span className="font-semibold text-foreground flex-1">{myPick.team.name}</span>
                  <Badge variant={PICK_STATUS_BADGE[myPick.status] ?? 'muted'}>{myPick.status}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <h2 className="text-sm font-semibold text-foreground mb-4">
            {participantEliminated || deadlinePassed ? 'No disponible' : myPick ? 'Cambia tu pick' : 'Elige tu equipo'}
          </h2>

          {matches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay partidos disponibles.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {matches.map((match) => {
                const homeLocked = match.homeUsed && myPick?.team.id !== match.homeTeam.id;
                const awayLocked = match.awayUsed && myPick?.team.id !== match.awayTeam.id;
                return (
                <div
                  key={match.id}
                  className="flex items-stretch justify-between gap-4 bg-card border border-border rounded-xl px-4 py-3"
                >
                  <div
                    className={cn(
                      'flex flex-1 items-center justify-center flex-col rounded-lg px-1 py-1 transition-colors',
                      homeLocked &&
                        'bg-muted/50 ring-1 ring-border/80 ring-inset opacity-[0.88]',
                    )}
                  >
                    {homeLocked ? (
                      <span className="mb-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Ya usado
                      </span>
                    ) : null}
                    {match.homeTeam.logoUrl && (
                      <img
                        src={match.homeTeam.logoUrl}
                        alt={match.homeTeam.name}
                        className={cn(
                          'w-10 h-10 object-contain',
                          homeLocked && 'grayscale contrast-[1.12] opacity-90',
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'text-xs text-center',
                        homeLocked ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {match.homeTeam.name}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn('mt-2 w-full', homeLocked && 'opacity-60')}
                      disabled={
                        submitting ||
                        participantEliminated ||
                        deadlinePassed ||
                        homeLocked
                      }
                      onClick={() => handlePick(match.homeTeam.id)}
                    >
                      {myPick?.team.id === match.homeTeam.id
                        ? 'Tu pick'
                        : match.homeUsed
                          ? 'Usado'
                          : 'Elegir'}
                    </Button>
                  </div>

                  <div className="flex flex-col items-center justify-center w-10">
                    <span className="text-muted-foreground font-semibold">VS</span>
                    {match.homeScore !== null && match.awayScore !== null && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {match.homeScore}:{match.awayScore}
                      </span>
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex flex-1 items-center justify-center flex-col rounded-lg px-1 py-1 transition-colors',
                      awayLocked &&
                        'bg-muted/50 ring-1 ring-border/80 ring-inset opacity-[0.88]',
                    )}
                  >
                    {awayLocked ? (
                      <span className="mb-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Ya usado
                      </span>
                    ) : null}
                    {match.awayTeam.logoUrl && (
                      <img
                        src={match.awayTeam.logoUrl}
                        alt={match.awayTeam.name}
                        className={cn(
                          'w-10 h-10 object-contain',
                          awayLocked && 'grayscale contrast-[1.12] opacity-90',
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'text-xs text-center',
                        awayLocked ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {match.awayTeam.name}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn('mt-2 w-full', awayLocked && 'opacity-60')}
                      disabled={
                        submitting ||
                        participantEliminated ||
                        deadlinePassed ||
                        awayLocked
                      }
                      onClick={() => handlePick(match.awayTeam.id)}
                    >
                      {myPick?.team.id === match.awayTeam.id
                        ? 'Tu pick'
                        : match.awayUsed
                          ? 'Usado'
                          : 'Elegir'}
                    </Button>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </section>
      </div>
      <MobileBottomNav />
      </main>
    </div>
  );
}
