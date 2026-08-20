'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trophy } from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { MobileTopHeader } from '@/components/mobile/MobileTopHeader';

const MODE_LABEL: Record<string, string> = { TOURNAMENT: 'Torneo', LEAGUE: 'Liga', WORLD_CUP: 'World Cup' };
const MODE_BADGE_CLASS: Record<string, string> = {
  TOURNAMENT: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  LEAGUE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  WORLD_CUP: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};
const EDITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', OPEN: 'Abierta', ACTIVE: 'Activa', FINISHED: 'Finalizada', CANCELLED: 'Cancelada',
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  OPEN: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  FINISHED: 'bg-white/5 text-white/35 border-white/[0.07]',
  CANCELLED: 'bg-red-500/15 text-red-300 border-red-500/25',
};

type ChampionshipListItem = {
  id: string;
  name: string;
  mode: 'TOURNAMENT' | 'LEAGUE' | 'WORLD_CUP';
  footballLeague: { id: string; name: string; country: string };
  editions: { id: string; status: string }[];
  admin: { id: string; alias: string };
};

function getRelevantEdition(editions: { id: string; status: string }[]) {
  return (
    editions.find((e) => e.status === 'ACTIVE') ??
    editions.find((e) => e.status === 'OPEN') ??
    editions.find((e) => e.status === 'DRAFT') ??
    null
  );
}

export default function ChampionshipListPage() {
  const router = useRouter();
  const [championships, setChampionships] = useState<ChampionshipListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/championships')
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar las ligas');
        return r.json();
      })
      .then((data) => setChampionships(Array.isArray(data) ? data : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative min-h-screen bg-[#06090f] text-white">
      <MobileTopHeader title="Ligas" onBack={() => router.push('/dashboard')} />
      <main className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)] pt-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-white/85">Mis ligas</h1>
            <button
              className="flex items-center gap-1.5 bg-amber-500 text-black font-bold rounded-xl px-3 py-2 text-sm"
              onClick={() => router.push('/championship/new')}
            >
              <Plus className="h-4 w-4" />
              Nueva liga
            </button>
          </div>

          {loading && (
            <div className="py-12 text-center text-white/35 text-sm">Cargando…</div>
          )}

          {error && (
            <div className="py-12 text-center text-red-300 text-sm">{error}</div>
          )}

          {!loading && !error && championships.length === 0 && (
            <div className="py-16 text-center rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.02]">
              <Trophy className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/35 mb-5 text-sm">Todavía no pertenecés a ninguna liga.</p>
              <button
                className="bg-amber-500 text-black font-bold rounded-xl px-5 py-2.5 text-sm"
                onClick={() => router.push('/championship/new')}
              >
                Crear primera liga
              </button>
            </div>
          )}

          {!loading && !error && championships.length > 0 && (
            <div className="flex flex-col gap-3">
              {championships.map((c) => {
                const edition = getRelevantEdition(c.editions);
                return (
                  <button
                    key={c.id}
                    className="w-full text-left rounded-2xl border border-white/[0.07] bg-[#0c1220] p-4 hover:border-white/[0.13] transition-colors"
                    onClick={() => router.push(`/championship/${c.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-white/85 text-sm truncate">{c.name}</div>
                        <div className="text-xs text-white/35 mt-0.5">
                          {c.footballLeague.name} · {c.footballLeague.country}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${MODE_BADGE_CLASS[c.mode] ?? 'bg-white/5 text-white/35 border-white/[0.07]'}`}>
                          {MODE_LABEL[c.mode]}
                        </span>
                        {edition && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE_CLASS[edition.status] ?? 'bg-white/5 text-white/35 border-white/[0.07]'}`}>
                            {EDITION_STATUS_LABEL[edition.status]}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
