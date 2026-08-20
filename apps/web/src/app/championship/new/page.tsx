'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type League = { id: string; name: string; country: string };

export default function NewChampionshipPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [form, setForm] = useState({
    name: '',
    footballLeagueId: '',
    mode: 'TOURNAMENT',
    pickResetAtMidseason: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/leagues')
      .then((r) => r.json())
      .then((data) => setLeagues(Array.isArray(data) ? data : []))
      .catch(() => setLeagues([]));
  }, []);

  const isWc = form.mode === 'WORLD_CUP';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || (!isWc && !form.footballLeagueId)) {
      setError(isWc ? 'El nombre es obligatorio.' : 'Nombre y liga son obligatorios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = isWc
        ? { name: form.name, mode: form.mode }
        : form;

      const res = await fetch('/api/championships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(msg || 'Error al crear el campeonato');
        return;
      }
      router.push(`/championship/${data.id}`);
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-start justify-center px-4 pb-6 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-lg pt-6">
        <button
          type="button"
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.back()}
        >
          ← Volver
        </button>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h1 className="text-xl font-bold text-foreground mb-6">Nuevo campeonato</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-muted-foreground">
                Nombre del campeonato
              </label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Liga de los Viernes"
                maxLength={80}
                className="bg-secondary border border-border text-foreground rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none w-full placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Modo de juego</label>
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value, footballLeagueId: '' })}
                className="bg-secondary border border-border text-foreground rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none w-full"
              >
                <option value="TOURNAMENT" className="bg-card">Torneo (supervivencia)</option>
                <option value="LEAGUE" className="bg-card">Liga (puntos)</option>
                <option value="WORLD_CUP" className="bg-card">🏆 World Cup 2026</option>
              </select>
            </div>

            {isWc && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                La liga del Mundial se asigna automáticamente. Solo tienes que ponerle nombre al campeonato.
              </div>
            )}

            {!isWc && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground">Liga de fútbol</label>
                <select
                  value={form.footballLeagueId}
                  onChange={(e) => setForm({ ...form, footballLeagueId: e.target.value })}
                  className="bg-secondary border border-border text-foreground rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none w-full"
                >
                  <option value="" className="bg-card">Selecciona una liga...</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id} className="bg-card">
                      {l.name} ({l.country})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isWc && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pickResetAtMidseason}
                  onChange={(e) => setForm({ ...form, pickResetAtMidseason: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-amber-500 rounded"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">Reiniciar picks a media vuelta</span>
                  <span className="text-xs text-muted-foreground">
                    Permite volver a elegir equipos usados en la primera vuelta
                  </span>
                </div>
              </label>
            )}

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
              {loading ? 'Creando...' : 'Crear campeonato'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
