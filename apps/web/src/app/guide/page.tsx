'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SCORING = [
  { result: '🟢 Victoria', base: '+3', double: '+6', baseClass: 'text-emerald-400', doubleClass: 'text-emerald-400' },
  { result: '🟡 Empate',   base: '0',  double: '+1', baseClass: 'text-muted-foreground', doubleClass: 'text-amber-400' },
  { result: '🔴 Derrota',  base: '0 / eliminado', double: '−3', baseClass: 'text-muted-foreground', doubleClass: 'text-red-400' },
];

const TOKENS = [
  {
    icon: '🔒',
    name: 'Bloqueo',
    color: 'border-red-500/30 bg-red-500/10',
    iconColor: 'text-red-400',
    desc: 'Bloqueás a un rival por una jornada. Aunque su equipo gane, no suma ningún punto. El bloqueado no sabe nada hasta que pasa el kickoff.',
    chips: [
      { label: '👁 Visible tras el kickoff', cls: 'bg-card border-border text-muted-foreground' },
      { label: '🔥 Siempre se consume', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    ],
  },
  {
    icon: '🚫',
    name: 'Veto',
    color: 'border-purple-500/30 bg-purple-500/10',
    iconColor: 'text-purple-400',
    desc: 'Vetás un equipo del pick de un rival. Si ya lo eligió, su pick se borra y tiene que volver a elegir. Tiene que hacerse con más de 48 h antes del partido.',
    chips: [
      { label: '👁 Visible antes del kickoff', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
      { label: '🔥 Siempre se consume', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    ],
  },
  {
    icon: '⚔️',
    name: 'Reto',
    color: 'border-orange-500/30 bg-orange-500/10',
    iconColor: 'text-orange-400',
    desc: 'Retás a un rival. Al terminar la jornada, el que tenga peor resultado pierde 1 punto. Si empatan técnicamente, el retador recupera el token.',
    chips: [
      { label: '👁 Visible antes del kickoff', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
      { label: '♻️ Token recuperado en empate', cls: 'bg-sky-500/10 border-sky-500/30 text-sky-400' },
    ],
  },
  {
    icon: '🎲',
    name: 'Doble o nada',
    color: 'border-amber-500/30 bg-amber-500/10',
    iconColor: 'text-amber-400',
    desc: 'Activás tu pick de alto riesgo antes de hacer tu elección. Los resultados cambian drásticamente. El token se consume siempre, ganes o pierdas.',
    chips: [
      { label: '👁 Visible tras el kickoff', cls: 'bg-card border-border text-muted-foreground' },
      { label: '🔥 Siempre se consume', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    ],
    hasTable: true,
  },
];

const NOTIFS = [
  {
    dot: 'bg-emerald-400',
    timing: 'Inmediato',
    text: '🚫 Ale te vetó al Real Madrid. Cambiá tu pick.',
  },
  {
    dot: 'bg-emerald-400',
    timing: 'Inmediato',
    text: '⚔️ JOSH te retó en la jornada 5. El que peor resultado tenga pierde 1 punto.',
  },
  {
    dot: 'bg-amber-400',
    timing: 'Tras el kickoff',
    text: '🔒 Lopera te bloqueó en la jornada 5. Tu pick no sumó puntos.',
  },
];

export default function GuidePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="h-14 flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cómo jugar</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col gap-8">

        {/* Hero */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">Pick &amp; Survive</p>
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">Guía del juego</h1>
          <p className="text-sm text-muted-foreground">
            Todo lo que necesitás saber para jugar, usar tus tokens y entender cada mecánica.
          </p>
        </div>

        {/* El pick */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="El pick" />
          <p className="text-sm text-muted-foreground">
            Cada jornada elegís <strong className="text-foreground">un equipo</strong>. Si gana, seguís. Si empata o pierde (según el modo), perdés una vida o quedás eliminado.
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              { n: '1', title: 'Elegí un equipo', desc: 'Solo podés elegir equipos que no hayas usado antes en esta edición.' },
              { n: '2', title: 'Respetá el deadline', desc: 'El plazo cierra antes del primer partido del fin de semana. Después no podés cambiar.' },
              { n: '3', title: 'Esperá el resultado', desc: 'Los puntos o la eliminación se calculan automáticamente cuando termina el partido.' },
            ].map((s) => (
              <div key={s.n} className="flex gap-3 items-start bg-card border border-border rounded-xl p-3.5">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">{s.n}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tokens */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="Tokens sociales" />
          <p className="text-sm text-muted-foreground">
            Cada token se configura al crear la liga. Cuando se gastan, se gastan — no se recargan salvo excepciones indicadas.
          </p>
          {TOKENS.map((t) => (
            <div key={t.name} className={`border rounded-2xl p-4 ${t.color}`}>
              <div className="flex gap-3 items-start">
                <span className="text-xl mt-0.5">{t.icon}</span>
                <div className="flex-1">
                  <p className={`text-sm font-bold mb-1 ${t.iconColor}`}>{t.name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{t.desc}</p>
                  {t.hasTable && (
                    <div className="bg-background/40 rounded-xl overflow-hidden mb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Resultado</th>
                            <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Sin token</th>
                            <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Con 🎲</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SCORING.map((row) => (
                            <tr key={row.result} className="border-b border-border/30 last:border-0">
                              <td className="px-3 py-2 text-foreground">{row.result}</td>
                              <td className={`px-3 py-2 text-right font-bold tabular-nums ${row.baseClass}`}>{row.base}</td>
                              <td className={`px-3 py-2 text-right font-bold tabular-nums ${row.doubleClass}`}>{row.double}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {t.chips.map((c) => (
                      <span key={c.label} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${c.cls}`}>{c.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Badges */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="Clasificación" />
          <p className="text-sm text-muted-foreground">
            En la tabla de clasificación aparecen badges junto al nombre de cada jugador indicando tokens activos en esa jornada.
          </p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {[
              {
                initial: 'A',
                name: 'Ale',
                color: 'bg-emerald-500/15 text-emerald-400',
                badges: [
                  { label: '🚫 Athletic', cls: 'bg-purple-500/15 border-purple-500/30 text-purple-400' },
                  { label: '⚔️ JOSH',    cls: 'bg-orange-500/15 border-orange-500/30 text-orange-400' },
                ],
                pts: '24 pts',
              },
              {
                initial: 'J',
                name: 'JOSH',
                color: 'bg-red-500/10 text-red-400',
                badges: [
                  { label: '🔒 Lopera',      cls: 'bg-red-500/15 border-red-500/30 text-red-400' },
                  { label: '🎲 doble o nada', cls: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
                ],
                pts: '19 pts',
              },
            ].map((p, i, arr) => (
              <div key={p.name} className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-border/40' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${p.color}`}>{p.initial}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {p.badges.map((b) => (
                      <span key={b.label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${b.cls}`}>{b.label}</span>
                    ))}
                  </div>
                </div>
                <span className="text-sm font-black text-amber-400 tabular-nums shrink-0">{p.pts}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Los badges de 🚫 veto y ⚔️ reto se ven <strong className="text-foreground">antes del kickoff</strong>. Los de 🔒 bloqueo y 🎲 doble o nada solo aparecen <strong className="text-foreground">después del kickoff</strong>.
          </p>
        </section>

        {/* Notificaciones */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="Notificaciones" />
          <p className="text-sm text-muted-foreground">
            Recibís avisos automáticos cuando alguien usa un token contra vos. Las urgentes llegan al instante; las que deben ser secretas, cuando pasa el kickoff.
          </p>
          <div className="flex flex-col gap-2">
            {NOTIFS.map((n, i) => (
              <div key={i} className="flex gap-3 items-start bg-card border border-border rounded-xl px-4 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.dot}`} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{n.timing}</p>
                  <p className="text-sm text-foreground">{n.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-foreground leading-relaxed">
            <strong className="text-amber-400">Tip:</strong> Si recibís un veto y ya habías elegido ese equipo, el pick se borra automáticamente y llega un recordatorio para que elijas otro.
          </div>
        </section>

        {/* Ventanas */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="Ventanas de jornada" badge="Próximamente" />
          <p className="text-sm text-muted-foreground">
            A veces el fútbol real hace que dos jornadas oficiales se solapen. El sistema agrupará los partidos por <strong className="text-foreground">ventana viernes–lunes</strong> para que nunca haya confusión con el deadline.
          </p>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1.5">
            {[
              { day: 'VIE', content: '🚩 Deadline — primer partido', active: true },
              { day: 'SÁB', content: 'Partidos J5 + J6',             active: true },
              { day: 'DOM', content: 'Partidos J5 + J6',             active: true },
              { day: 'LUN', content: 'Partido J5 tardío',            active: false },
              { day: 'MIÉ', content: 'Aplazado J4 — no crea ventana', active: false },
            ].map((row) => (
              <div key={row.day} className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-8 shrink-0">{row.day}</span>
                <div className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  row.active
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                    : 'bg-secondary border border-border text-muted-foreground'
                }`}>
                  {row.content}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2 pt-3 border-t border-border/50">
              Si J5 y J6 solapan, el deadline es el primer partido del viernes y los equipos de ambas jornadas están disponibles. Los aplazados de mitad de semana se resuelven con el pick ya hecho, sin crear una ventana nueva.
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-foreground leading-relaxed">
            <strong className="text-amber-400">Regla de uso de equipos:</strong> Si elegís un equipo en una ventana de fin de semana, queda "usado" para esa ventana completa — aunque la liga lo asigne a dos jornadas distintas.
          </div>
        </section>

      </div>
    </main>
  );
}

function SectionLabel({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">{label}</p>
      {badge && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 uppercase tracking-wide">{badge}</span>
      )}
    </div>
  );
}
