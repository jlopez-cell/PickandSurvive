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
    streakBonusEnabled: false,
    underdogBonusEnabled: false,
    socialPressureEnabled: false,
    wildcardCount: 0 as 0 | 1 | 2,
    ghostModeEnabled: false,
    doubleOrNothingEnabled: false,
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

            {!isWc && (
              <div className="border-t border-border pt-4 flex flex-col gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mecánicas opcionales
                </p>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.streakBonusEnabled}
                    onChange={(e) => setForm({ ...form, streakBonusEnabled: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-amber-500 rounded"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">Bonus por racha</span>
                    <span className="text-xs text-muted-foreground">+1 pt con 5 victorias seguidas, +3 con 8</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.underdogBonusEnabled}
                    onChange={(e) => setForm({ ...form, underdogBonusEnabled: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-amber-500 rounded"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">Bonus underdog</span>
                    <span className="text-xs text-muted-foreground">+1 pt si ganás con equipo en zona de descenso</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.socialPressureEnabled}
                    onChange={(e) => setForm({ ...form, socialPressureEnabled: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-amber-500 rounded"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">Presión social</span>
                    <span className="text-xs text-muted-foreground">Notificación cuando la mitad del grupo ya picó</span>
                  </div>
                </label>

                {form.mode === 'TOURNAMENT' && (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">Vidas extra por jugador</span>
                        <span className="text-xs text-muted-foreground">
                          Wildcards disponibles antes de ser eliminado
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {([0, 1, 2] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setForm({ ...form, wildcardCount: n })}
                            className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                              form.wildcardCount === n
                                ? 'bg-amber-500 text-black border-amber-500'
                                : 'bg-secondary text-muted-foreground border-border hover:border-amber-500/40'
                            }`}
                          >
                            {n === 0 ? 'Ninguna' : `${n}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.ghostModeEnabled}
                        onChange={(e) => setForm({ ...form, ghostModeEnabled: e.target.checked })}
                        className="mt-0.5 h-4 w-4 accent-amber-500 rounded"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">Modo fantasma</span>
                        <span className="text-xs text-muted-foreground">
                          Los eliminados siguen viendo y picando sin premio
                        </span>
                      </div>
                    </label>
                  </>
                )}

                {form.mode === 'LEAGUE' && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.doubleOrNothingEnabled}
                      onChange={(e) => setForm({ ...form, doubleOrNothingEnabled: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-amber-500 rounded"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">Doble o nada</span>
                      <span className="text-xs text-muted-foreground">
                        Una vez por edición podés arriesgar el doble de puntos (×2 si ganás, -3 si perdés)
                      </span>
                    </div>
                  </label>
                )}
              </div>
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
