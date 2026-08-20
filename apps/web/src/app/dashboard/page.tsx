'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Globe, Moon, Plus, Sun, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

// ── Types ──────────────────────────────────────────────────────────────────

type Edition = { id: string; status: string; startMatchday: number };
type Championship = {
  id: string;
  name: string;
  mode: 'TOURNAMENT' | 'LEAGUE' | 'WORLD_CUP';
  adminId: string;
  footballLeague: { id: string; name: string; country: string };
  editions: Edition[];
  admin: { id: string; alias: string };
};

// ── Constants ──────────────────────────────────────────────────────────────

const MODE_LABEL: Record<string, string> = {
  TOURNAMENT: 'Torneo',
  LEAGUE: 'Liga',
  WORLD_CUP: 'World Cup',
};

const EDITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  OPEN: 'Abierta',
  ACTIVE: 'Activa',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

function getRelevantEdition(editions: Edition[]): Edition | null {
  return (
    editions.find((e) => e.status === 'ACTIVE') ??
    editions.find((e) => e.status === 'OPEN') ??
    editions.find((e) => e.status === 'DRAFT') ??
    null
  );
}

function editionDot(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-500';
  if (status === 'OPEN') return 'bg-blue-400';
  if (status === 'DRAFT') return 'bg-amber-400';
  return 'bg-muted-foreground/30';
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [championships, setChampionships] = useState<Championship[]>([]);
  const [fetching, setFetching] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const t = localStorage.getItem('ps-theme');
    if (t === 'light') setTheme('light');
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ps-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    fetch('/api/championships')
      .then((r) => r.json())
      .then((data) => setChampionships(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [loading, user]);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="flex items-center flex-1 min-w-0">
            <img src="/logo.png" alt="Pick & Survive" className="h-9 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cambiar tema"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-secondary"
              aria-label="Perfil"
            >
              <span className="text-[10px] font-black uppercase text-muted-foreground">
                {user?.alias?.slice(0, 2) ?? 'P'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Banner Hero ── */}
      <div className="relative w-full overflow-hidden" style={{ maxHeight: '200px' }}>
        <img src="/banner.png" alt="Pick & Survive" className="w-full object-cover object-center" style={{ maxHeight: '200px' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      {/* ── Content ── */}
      <main className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)] pt-5 sm:px-6">
        <div className="max-w-3xl mx-auto">

          {/* Greeting */}
          <div className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Bienvenido</p>
            <h1 className="text-2xl font-black text-foreground mt-0.5">@{user?.alias}</h1>
          </div>

          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Mis ligas
            </span>
            <button
              onClick={() => router.push('/championship/new')}
              className="flex items-center gap-1 text-xs text-amber-500 font-semibold hover:text-amber-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </button>
          </div>

          {/* Championship list */}
          {championships.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-border bg-secondary/20">
              <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-5">No pertenecés a ninguna liga todavía.</p>
              <button
                className="bg-amber-500 text-black font-bold rounded-xl px-5 py-2.5 text-sm"
                onClick={() => router.push('/championship/new')}
              >
                Crear primera liga
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mb-7">
              {championships.map((c) => {
                const edition = getRelevantEdition(c.editions);
                const isWc = c.mode === 'WORLD_CUP';
                return (
                  <button
                    key={c.id}
                    className="w-full text-left rounded-2xl border border-border bg-card p-4 transition-all active:scale-[0.99] hover:border-border/60"
                    onClick={() => router.push(`/championship/${c.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        isWc
                          ? 'bg-amber-500/15 border border-amber-500/25'
                          : 'bg-secondary border border-border'
                      }`}>
                        {isWc
                          ? <Globe className="w-5 h-5 text-amber-500" />
                          : <Trophy className="w-5 h-5 text-muted-foreground" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${
                            isWc ? 'text-amber-500' : 'text-muted-foreground'
                          }`}>
                            {MODE_LABEL[c.mode]}
                          </span>
                          {edition && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                              <span className={`w-1.5 h-1.5 rounded-full inline-block ${editionDot(edition.status)}`} />
                              {EDITION_STATUS_LABEL[edition.status]}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-foreground text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {c.footballLeague.name} · {c.footballLeague.country}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push('/join-code')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-border bg-secondary text-foreground font-medium text-sm"
            >
              <Users className="w-4 h-4" />
              Unirse por código
            </button>
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              className="w-full py-2.5 text-xs font-medium text-muted-foreground/50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
