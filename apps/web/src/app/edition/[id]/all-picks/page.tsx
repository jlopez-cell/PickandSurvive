'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

type EveryonePickRow = {
  id: string;
  pickStatus: string;
  pointsAwarded: number | null;
  matchdayNumber: number;
  matchdayStatus: string;
  alias: string;
  team: { id: string; name: string; logoUrl: string } | null;
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

export default function EveryonePicksHistoryPage() {
  const { id: editionId } = useParams<{ id: string }>();
  const router = useRouter();
  const [rows, setRows] = useState<EveryonePickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/editions/${editionId}/picks/everyone-history`)
      .then((r) => {
        if (!r.ok) throw new Error('Sin acceso');
        return r.json();
      })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [editionId]);

  const grouped = rows.reduce<Record<number, EveryonePickRow[]>>((acc, row) => {
    const n = row.matchdayNumber;
    if (!acc[n]) acc[n] = [];
    acc[n].push(row);
    return acc;
  }, {});

  const matchdayNumbers = Object.keys(grouped).map(Number).sort((a, b) => b - a);

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:p-6 sm:pt-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="-ml-2 mb-6 text-muted-foreground" onClick={() => router.back()}>
          ← Volver
        </Button>
        <h1 className="text-2xl font-bold text-foreground mb-2">Picks de todos los participantes</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Equipo elegido por jornada. En la jornada en curso, los picks del resto se muestran cuando ha pasado el cierre
          (misma regla que la clasificación).
        </p>

        {loading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : matchdayNumbers.length === 0 ? (
          <p className="text-muted-foreground">No hay picks registrados en esta edición.</p>
        ) : (
          matchdayNumbers.map((num) => (
            <section key={num} className="mb-8">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Jornada {num}
              </h2>
              <div className="flex flex-col gap-2">
                {grouped[num].map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap justify-between items-center gap-2 bg-card border border-border rounded-lg px-4 py-3"
                  >
                    <span className="text-muted-foreground text-sm min-w-[7rem]">@{row.alias}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {row.team?.logoUrl ? (
                        <img src={row.team.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                      ) : null}
                      <span className="text-foreground text-sm truncate">
                        {row.team?.name ?? 'Sin pick (eliminado)'}
                      </span>
                    </div>
                    <Badge variant={STATUS_BADGE[row.pickStatus] ?? 'muted'} className="text-xs shrink-0">
                      {STATUS_LABEL[row.pickStatus] ?? row.pickStatus}
                      {row.pointsAwarded !== null && row.pointsAwarded !== undefined
                        ? ` (+${row.pointsAwarded})`
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
