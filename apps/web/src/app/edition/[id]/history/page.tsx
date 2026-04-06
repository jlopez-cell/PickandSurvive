'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

type PickRecord = {
  id: string;
  status: string;
  pointsAwarded: number | null;
  team: { name: string; logoUrl: string };
  matchday: { number: number; status: string };
  participant: { user: { alias: string } };
};

type BadgeVariant = 'muted' | 'success' | 'warning' | 'destructive' | 'default';
const STATUS_BADGE: Record<string, BadgeVariant> = {
  SURVIVED: 'success',
  DRAW_ELIMINATED: 'warning',
  LOSS_ELIMINATED: 'destructive',
  NO_PICK_ELIMINATED: 'destructive',
  POSTPONED_PENDING: 'default',
  PENDING: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  SURVIVED: 'Sobrevive',
  DRAW_ELIMINATED: 'Eliminado (empate)',
  LOSS_ELIMINATED: 'Eliminado (derrota)',
  NO_PICK_ELIMINATED: 'Eliminado (sin pick)',
  POSTPONED_PENDING: 'Aplazado',
  PENDING: 'Pendiente',
};

export default function HistoryPage() {
  const { id: editionId } = useParams<{ id: string }>();
  const router = useRouter();
  const [history, setHistory] = useState<PickRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/editions/${editionId}/picks/history`)
      .then((r) => {
        if (!r.ok) throw new Error('Sin acceso');
        return r.json();
      })
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [editionId]);

  const grouped = history.reduce<Record<number, PickRecord[]>>((acc, pick) => {
    const n = pick.matchday.number;
    if (!acc[n]) acc[n] = [];
    acc[n].push(pick);
    return acc;
  }, {});

  const matchdayNumbers = Object.keys(grouped).map(Number).sort((a, b) => b - a);

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 pb-24">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="-ml-2 mb-6 text-muted-foreground" onClick={() => router.back()}>
          ← Volver
        </Button>
        <h1 className="text-2xl font-bold text-foreground mb-6">Historial de picks</h1>

        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : matchdayNumbers.length === 0 ? (
          <p className="text-muted-foreground">No hay historial todavía.</p>
        ) : (
          matchdayNumbers.map((num) => (
            <section key={num} className="mb-8">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Jornada {num}
              </h2>
              <div className="flex flex-col gap-2">
                {grouped[num].map((pick) => (
                  <div key={pick.id} className="flex justify-between items-center bg-card border border-border rounded-lg px-4 py-3 gap-3">
                    <span className="text-muted-foreground text-sm min-w-[100px]">@{pick.participant.user.alias}</span>
                    <div className="flex items-center gap-2 flex-1">
                      {pick.team.logoUrl && (
                        <img src={pick.team.logoUrl} alt={pick.team.name} className="w-5 h-5 object-contain" />
                      )}
                      <span className="text-foreground text-sm">{pick.team.name}</span>
                    </div>
                    <Badge variant={STATUS_BADGE[pick.status] ?? 'muted'} className="text-xs shrink-0">
                      {STATUS_LABEL[pick.status] ?? pick.status}
                      {pick.pointsAwarded !== null && pick.pointsAwarded !== undefined
                        ? ` (+${pick.pointsAwarded})`
                        : ''}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      <MobileBottomNav />
    </main>
  );
}
