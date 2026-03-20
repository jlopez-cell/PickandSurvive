'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type Team = { id: string; name: string; logoUrl: string };
type Match = {
  id: string;
  status: string;
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
  const { loading: authLoading } = useAuth();

  const [editionStartMatchday, setEditionStartMatchday] = useState<number | null>(null);
  const [leagueSeason, setLeagueSeason] = useState<number | null>(null);

  const [currentMatchday, setCurrentMatchday] = useState<number>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myPick, setMyPick] = useState<Pick | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      .then((meta) => {
        const start = Number(meta.startMatchday);
        setEditionStartMatchday(Number.isFinite(start) ? start : 1);
        setLeagueSeason(meta.season ?? null);
        setCurrentMatchday(Number.isFinite(start) ? start : 1);
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

  const handlePick = async (teamId: string) => {
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
    <main className="min-h-screen bg-background p-6">
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
            {myPick ? 'Cambia tu pick' : 'Elige tu equipo'}
          </h2>

          {matches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay partidos disponibles.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-stretch justify-between gap-4 bg-card border border-border rounded-xl px-4 py-3"
                >
                  <div className="flex flex-1 items-center justify-center flex-col">
                    {match.homeTeam.logoUrl && (
                      <img
                        src={match.homeTeam.logoUrl}
                        alt={match.homeTeam.name}
                        className="w-10 h-10 object-contain"
                      />
                    )}
                    <span className="text-xs text-foreground text-center">{match.homeTeam.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      disabled={submitting || (match.homeUsed && myPick?.team.id !== match.homeTeam.id)}
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

                  <div className="flex flex-1 items-center justify-center flex-col">
                    {match.awayTeam.logoUrl && (
                      <img
                        src={match.awayTeam.logoUrl}
                        alt={match.awayTeam.name}
                        className="w-10 h-10 object-contain"
                      />
                    )}
                    <span className="text-xs text-foreground text-center">{match.awayTeam.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      disabled={submitting || (match.awayUsed && myPick?.team.id !== match.awayTeam.id)}
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
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
