'use client';

import { useRouter } from 'next/navigation';
import { Trophy, ChevronLeft, Globe, Shield, Zap, Users } from 'lucide-react';

const FEATURES = [
  {
    icon: <Globe className="w-5 h-5" />,
    title: '48 selecciones',
    desc: 'El torneo más grande de la historia. 12 grupos, 104 partidos.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Pick diario',
    desc: 'Un equipo por día. Deadline: el primer partido de cada jornada.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Gana o Empata',
    desc: 'Elige si tu equipo tiene que ganar, o apostás al empate.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Supervivencia grupal',
    desc: 'Compite con tus amigos. El último en pie gana el bote.',
  },
];

export default function WcLobbyPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-[#06090f] flex flex-col pt-[env(safe-area-inset-top,0px)]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-amber-500/10">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm font-medium text-white/35 hover:text-white/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </button>
        <span className="text-xs font-bold tracking-widest text-amber-400/60">
          World Cup 2026
        </span>
        <div className="w-20" />
      </nav>

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 text-center overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/30 via-transparent to-transparent pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, hsl(43,96%,56%) 0, hsl(43,96%,56%) 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          {/* Trophy */}
          <div className="flex justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Trophy
                className="w-14 h-14 sm:w-16 sm:h-16 text-amber-400"
                style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.45))' }}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-black text-amber-400"
              style={{ textShadow: '0 0 40px rgba(251,191,36,0.3), 0 2px 8px rgba(0,0,0,0.9)' }}
            >
              World Cup
            </h1>
            <p className="text-amber-200/45 text-sm sm:text-base tracking-[0.25em] font-semibold mt-2">
              USA · México · Canadá · 2026
            </p>
          </div>

          <p className="text-base sm:text-lg text-white/35 max-w-md mx-auto leading-relaxed">
            La versión más épica de Pick &amp; Survive. Picks diarios, grupos, eliminatorias y el Mundial entero en tus manos.
          </p>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mt-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 p-4 rounded-xl bg-[#0c1220] border border-white/[0.07] hover:border-amber-500/20 transition-colors"
              >
                <span className="text-amber-400 shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="font-bold text-sm text-white/85">{f.title}</p>
                  <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="pt-2 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Torneo en curso · 11 Jun – 19 Jul 2026
            </div>

            <p className="text-sm text-white/35">
              Pide a tu admin que cree un campeonato de tipo{' '}
              <strong className="text-white/60 font-bold">World Cup</strong> e invítate para empezar a jugar.
            </p>

            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400 font-bold hover:bg-amber-500/20 transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Volver al dashboard
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
