'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { cn } from '@/lib/utils';

type PickRecord = {
  id: string;
  status: string;
  pointsAwarded: number | null;
  team: { name: string; logoUrl: string } | null;
  matchday: { number: number; status: string };
  participant: { user: { alias: string } };
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
    <main className="min-h-screen bg-[#06090f] pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#06090f]/95 backdrop-blur-sm border-b border-white/[0.07] flex items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.07] flex items-center justify-center text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-white/85 text-base">Historial de picks</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-white/35 text-sm text-center py-12">Cargando...</p>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-12">{error}</p>
        ) : matchdayNumbers.length === 0 ? (
          <p className="text-white/35 text-sm text-center py-12">No hay historial todavía.</p>
        ) : (
          matchdayNumbers.map((num) => (
            <section key={num} className="mb-8">
              <p className="text-[10px] font-bold tracking-widest uppercase text-white/35 mb-3">
                Jornada {num}
              </p>
              <div className="flex flex-col gap-2">
                {grouped[num].map((pick) => (
                  <div
                    key={pick.id}
                    className="flex justify-between items-center bg-[#0c1220] border border-white/[0.07] rounded-2xl px-4 py-3 gap-3"
                  >
                    <span className="text-white/35 text-sm min-w-[100px] font-medium">
                      @{pick.participant.user.alias}
                    </span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {pick.team?.logoUrl ? (
                        <img
                          src={pick.team.logoUrl}
                          alt={pick.team.name}
                          className="w-5 h-5 object-contain shrink-0"
                        />
                      ) : null}
                      <span className="text-white/85 text-sm font-medium truncate">
                        {pick.team?.name ?? 'Sin pick'}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0',
                        STATUS_STYLE[pick.status] ?? 'text-white/45 bg-white/5 border border-white/10',
                      )}
                    >
                      {STATUS_LABEL[pick.status] ?? pick.status}
                      {pick.pointsAwarded !== null && pick.pointsAwarded !== undefined
                        ? ` (+${pick.pointsAwarded})`
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
