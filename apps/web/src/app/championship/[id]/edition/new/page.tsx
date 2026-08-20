'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';

type ChampionshipMeta = {
  mode: string;
  leagueCurrentMatchday: number | null;
};

export default function NewEditionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meta, setMeta] = useState<ChampionshipMeta | null>(null);
  const [form, setForm] = useState({ startMatchday: '', endMatchday: '', potAmountCents: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/championships/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const current = Number(data?.leagueCurrentMatchday);
        setMeta({
          mode: data.mode ?? 'TOURNAMENT',
          leagueCurrentMatchday: Number.isFinite(current) && current > 0 ? current : null,
        });
      })
      .catch(() => setMeta(null));
  }, [id]);

  const isWc = meta?.mode === 'WORLD_CUP';
  const leagueCurrentMatchday = meta?.leagueCurrentMatchday ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let start: number;
    if (isWc) {
      start = leagueCurrentMatchday ?? 1;
    } else {
      if (!form.startMatchday) {
        setError('La jornada de inicio es obligatoria.');
        return;
      }
      start = parseInt(form.startMatchday, 10);
      if (leagueCurrentMatchday !== null && start < leagueCurrentMatchday) {
        setError(`La jornada de inicio no puede ser menor que la jornada actual (J${leagueCurrentMatchday}).`);
        return;
      }
    }

    setLoading(true);
    setError('');

    const body: Record<string, number> = { startMatchday: start };
    if (!isWc && form.endMatchday) body.endMatchday = parseInt(form.endMatchday, 10);
    if (form.potAmountCents) body.potAmountCents = Math.round(parseFloat(form.potAmountCents) * 100);

    try {
      const res = await fetch(`/api/championships/${id}/editions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(msg || 'Error al crear la edición');
        return;
      }
      router.push(`/championship/${id}`);
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06090f] flex items-start justify-center px-4 pb-6 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-md pt-6">
        <button
          type="button"
          className="mb-6 flex items-center gap-1 text-sm text-white/35 hover:text-white/60 transition-colors"
          onClick={() => router.back()}
        >
          ← Volver
        </button>

        <div className="bg-[#0c1220] border border-white/[0.07] rounded-2xl p-6">
          <h1 className="flex items-center gap-2 text-xl font-bold text-white/85 mb-6">
            {isWc && <Trophy className="w-5 h-5 text-amber-400" />}
            Nueva edición
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {isWc ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 space-y-1">
                <p className="text-sm font-bold text-amber-400">World Cup 2026</p>
                <p className="text-xs text-amber-300/70">
                  La edición arranca desde el{' '}
                  <span className="font-bold">
                    {leagueCurrentMatchday && leagueCurrentMatchday > 1
                      ? `día ${leagueCurrentMatchday} del torneo (hoy)`
                      : 'día 1 — 11 Jun 2026'}
                  </span>.
                  El número de jornadas sigue el calendario del Mundial.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="start" className="text-sm font-medium text-white/35">
                    Jornada de inicio <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="start"
                    type="number"
                    min={leagueCurrentMatchday ?? 1}
                    value={form.startMatchday}
                    onChange={(e) => setForm({ ...form, startMatchday: e.target.value })}
                    placeholder={leagueCurrentMatchday ? `Desde J${leagueCurrentMatchday}` : 'Ej: 10'}
                    className="bg-white/5 border border-white/[0.08] text-white/80 rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none w-full placeholder:text-white/20"
                  />
                  {leagueCurrentMatchday !== null && (
                    <p className="text-xs text-white/35">
                      Jornada actual de la liga: <span className="font-bold text-white/60">J{leagueCurrentMatchday}</span>.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="end" className="text-sm font-medium text-white/35">
                    Jornada de fin{' '}
                    <span className="font-normal text-white/20">(solo modo Liga)</span>
                  </label>
                  <input
                    id="end"
                    type="number"
                    min={1}
                    value={form.endMatchday}
                    onChange={(e) => setForm({ ...form, endMatchday: e.target.value })}
                    placeholder="Ej: 38"
                    className="bg-white/5 border border-white/[0.08] text-white/80 rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none w-full placeholder:text-white/20"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pot" className="text-sm font-medium text-white/35">
                Bote por participante (€){' '}
                <span className="font-normal text-white/20">(opcional)</span>
              </label>
              <input
                id="pot"
                type="number"
                min={0}
                step={0.01}
                value={form.potAmountCents}
                onChange={(e) => setForm({ ...form, potAmountCents: e.target.value })}
                placeholder="Ej: 5.00"
                className="bg-white/5 border border-white/[0.08] text-white/80 rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none w-full placeholder:text-white/20"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-amber-500 text-black font-bold rounded-2xl py-3.5 w-full disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Creando...' : 'Crear edición'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
