'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { cn } from '@/lib/utils';

type EveryonePickRow = {
  id: string;
  pickStatus: string;
  pointsAwarded: number | null;
  matchdayNumber: number;
  matchdayStatus: string;
  alias: string;
  team: { id: string; name: string; logoUrl: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  SURVIVED:           'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25',
  DRAW_ELIMINATED:    'text-amber-400 bg-amber-500/10 border border-amber-500/25',
  LOSS_ELIMINATED:    'text-red-400 bg-red-500/10 border border-red-500/25',
  NO_PICK_ELIMINATED: 'text-red-400 bg-red-500/10 border border-red-500/25',
  POSTPONED_PENDING:  'text-sky-400 bg-sky-500/10 border border-sky-500/25',
  PENDING:            'text-white/45 bg-white/5 border border-white/10',
};

const STATUS_LABEL: Record<string, string> = {
  SURVIVED:           'Sobrevive',
  DRAW_ELIMINATED:    'Eliminado (empate)',
  LOSS_ELIMINATED:    'Eliminado (derrota)',
  NO_PICK_ELIMINATED: 'Eliminado (sin pick)',
  POSTPONED_PENDING:  'Aplazado',
  PENDING:            'Pendiente',
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
    <main className="min-h-screen bg-[#06090f] pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#06090f]/95 backdrop-blur-sm border-b border-white/[0.07] flex items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.07] flex items-center justify-center text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-white/85 text-base">Picks de todos</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-sm text-white/35 font-medium mb-6">
          Equipo elegido por jornada. En la jornada en curso, los picks del resto se muestran cuando
          ha pasado el cierre (misma regla que la clasificación).
        </p>

        {loading ? (
          <p className="text-white/35 text-sm text-center py-12">Cargando…</p>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-12">{error}</p>
        ) : matchdayNumbers.length === 0 ? (
          <p className="text-white/35 text-sm text-center py-12">No hay picks registrados en esta edición.</p>
        ) : (
          matchdayNumbers.map((num) => (
            <section key={num} className="mb-8">
              <p className="text-[10px] font-bold tracking-widest uppercase text-white/35 mb-3">
                Jornada {num}
              </p>
              <div className="flex flex-col gap-2">
                {grouped[num].map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap justify-between items-center gap-2 bg-[#0c1220] border border-white/[0.07] rounded-2xl px-4 py-3"
                  >
                    <span className="text-white/35 text-sm min-w-[7rem] font-medium">@{row.alias}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {row.team?.logoUrl ? (
                        <img src={row.team.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                      ) : null}
                      <span className="text-white/85 text-sm font-medium truncate">
                        {row.team?.name ?? 'Sin pick (eliminado)'}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0',
                        STATUS_STYLE[row.pickStatus] ?? 'text-white/45 bg-white/5 border border-white/10',
                      )}
                    >
                      {STATUS_LABEL[row.pickStatus] ?? row.pickStatus}
                      {row.pointsAwarded !== null && row.pointsAwarded !== undefined
                        ? ` (+${row.pointsAwarded})`
                        : ''}
                    </span>
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
