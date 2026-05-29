'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trophy, Clock, Shield, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Users } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Team = { id: string; name: string; logoUrl: string };

type WcMatch = {
  id: string;
  status: string;
  kickoffTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  wcGroup: string | null;
  tournamentPhase: string | null;
  homeTeam: Team;
  awayTeam: Team;
  homeUsed: boolean;
  awayUsed: boolean;
};

type MyPick = { id: string; status: string; team: Team | null };

type TodayContext = {
  matchday: {
    id: string;
    number: number;
    status: string;
    tournamentPhase: string | null;
    wcGroupDay: number | null;
    firstKickoff: string | null;
    deadlinePassed: boolean;
  } | null;
  matches: WcMatch[];
  myPick: MyPick | null;
  participant: { status: string; eliminatedAtPhase: string | null };
};

type GroupStanding = {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

type Group = { name: string; standings: GroupStanding[] };

// ── Helpers ────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  GROUP_STAGE:    'Fase de Grupos',
  ROUND_OF_32:   'Octavos de Final',
  ROUND_OF_16:   'Dieciseisavos',
  QUARTER_FINALS: 'Cuartos de Final',
  SEMI_FINALS:   'Semifinales',
  THIRD_PLACE:   'Tercer Puesto',
  FINAL:         'Final',
};

const PICK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SURVIVED:          { label: 'Sobreviviste', color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" /> },
  DRAW_ELIMINATED:   { label: 'Eliminado (empate)', color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
  LOSS_ELIMINATED:   { label: 'Eliminado (derrota)', color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
  NO_PICK_ELIMINATED:{ label: 'Sin pick (eliminado)', color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
  PENDING:           { label: 'Pendiente', color: 'text-amber-400', icon: <Clock className="w-4 h-4" /> },
  POSTPONED_PENDING: { label: 'Aplazado', color: 'text-blue-400', icon: <AlertCircle className="w-4 h-4" /> },
};

function formatKickoff(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(iso: string | null): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Cerrado';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WcPickPage() {
  const { editionId } = useParams<{ editionId: string }>();
  const router = useRouter();

  const [ctx, setCtx] = useState<TodayContext | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [todayRes, groupsRes] = await Promise.all([
      fetch(`/api/wc/editions/${editionId}/today`),
      fetch(`/api/wc/editions/${editionId}/groups`),
    ]);
    if (todayRes.ok) setCtx(await todayRes.json());
    if (groupsRes.ok) setGroups(await groupsRes.json());
    setLoading(false);
  }, [editionId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!ctx?.matchday?.firstKickoff) return;
    const interval = setInterval(() => {
      setCountdown(formatCountdown(ctx.matchday!.firstKickoff));
    }, 10000);
    setCountdown(formatCountdown(ctx.matchday.firstKickoff));
    return () => clearInterval(interval);
  }, [ctx?.matchday?.firstKickoff]);

  async function handlePick(teamId: string) {
    if (!ctx?.matchday || ctx.matchday.deadlinePassed) return;
    setPicking(teamId);
    try {
      const res = await fetch(`/api/editions/${editionId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, matchdayNumber: ctx.matchday.number }),
      });
      if (res.ok) await loadData();
    } finally {
      setPicking(null);
    }
  }

  // Grupos únicos con partidos de hoy
  const matchesByGroup = ctx?.matches.reduce<Record<string, WcMatch[]>>((acc, m) => {
    const key = m.wcGroup ?? m.tournamentPhase ?? 'knockout';
    (acc[key] ??= []).push(m);
    return acc;
  }, {}) ?? {};

  const isEliminated = ctx?.participant.status === 'ELIMINATED';
  const phase = ctx?.matchday?.tournamentPhase;
  const isGroupStage = phase === 'GROUP_STAGE';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <Trophy className="w-12 h-12 text-[hsl(var(--wc-gold))] mx-auto animate-pulse" />
          <p className="text-muted-foreground">Cargando Mundial 2026...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Trophy className="w-5 h-5 text-[hsl(var(--wc-gold))]" />
            <span className="font-bold text-sm tracking-wide">WORLD CUP 2026</span>
          </div>

          {phase && (
            <span className="text-xs font-medium px-2 py-1 rounded-full border border-[hsl(var(--wc-gold))]/30 text-[hsl(var(--wc-gold))]">
              {PHASE_LABELS[phase] ?? phase}
            </span>
          )}

          <button onClick={() => router.push(`/world-cup/${editionId}/participants`)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Users className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ── Main column ── */}
        <div className="space-y-6">

          {/* Estado del participante */}
          {isEliminated && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold text-red-300 text-sm">Estás eliminado</p>
                {ctx?.participant.eliminatedAtPhase && (
                  <p className="text-xs text-red-400/70">{PHASE_LABELS[ctx.participant.eliminatedAtPhase] ?? ctx.participant.eliminatedAtPhase}</p>
                )}
              </div>
            </div>
          )}

          {/* Sin partidos hoy */}
          {!ctx?.matchday && (
            <div className="text-center py-16 space-y-3">
              <Trophy className="w-10 h-10 text-[hsl(var(--wc-gold))]/40 mx-auto" />
              <p className="text-muted-foreground text-sm">No hay partidos programados para hoy.</p>
            </div>
          )}

          {/* Tu pick del día */}
          {ctx?.myPick && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest font-medium">Tu pick de hoy</p>
              <div className="flex items-center gap-4">
                {ctx.myPick.team ? (
                  <>
                    <img src={ctx.myPick.team.logoUrl} alt={ctx.myPick.team.name} className="w-12 h-12 object-contain" />
                    <div>
                      <p className="font-bold">{ctx.myPick.team.name}</p>
                      {(() => {
                        const cfg = PICK_STATUS_CONFIG[ctx.myPick!.status];
                        return cfg ? (
                          <span className={`flex items-center gap-1.5 text-sm ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Sin equipo asignado</p>
                )}
              </div>
            </div>
          )}

          {/* Deadline */}
          {ctx?.matchday && !ctx.matchday.deadlinePassed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-[hsl(var(--wc-gold))]" />
              <span>Deadline: primer partido a las <strong className="text-foreground">{formatKickoff(ctx.matchday.firstKickoff)}</strong></span>
              {countdown && (
                <span className="ml-auto font-mono text-[hsl(var(--wc-gold))] font-bold">{countdown}</span>
              )}
            </div>
          )}
          {ctx?.matchday?.deadlinePassed && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span>El plazo de hoy ya cerró</span>
            </div>
          )}

          {/* Partidos por grupo */}
          {Object.entries(matchesByGroup).map(([groupKey, gMatches]) => (
            <div key={groupKey} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--wc-gold))]">
                  {isGroupStage ? `Grupo ${groupKey}` : (PHASE_LABELS[groupKey] ?? groupKey)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {gMatches.map((m) => {
                const deadlinePassed = ctx?.matchday?.deadlinePassed ?? true;
                const canPick = !deadlinePassed && !isEliminated && ctx?.myPick == null;
                const isMyPickHome = ctx?.myPick?.team?.id === m.homeTeam.id;
                const isMyPickAway = ctx?.myPick?.team?.id === m.awayTeam.id;

                return (
                  <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">{formatKickoff(m.kickoffTime)}</span>
                      {m.status === 'LIVE' && (
                        <span className="text-xs font-bold text-emerald-400 animate-pulse">EN VIVO</span>
                      )}
                      {m.status === 'FINISHED' && (
                        <span className="text-xs text-muted-foreground">FIN</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      {/* Home team */}
                      <TeamPickCard
                        team={m.homeTeam}
                        used={m.homeUsed}
                        isMyPick={isMyPickHome}
                        canPick={canPick && !m.homeUsed}
                        loading={picking === m.homeTeam.id}
                        score={m.homeScore}
                        onPick={() => handlePick(m.homeTeam.id)}
                      />

                      {/* Score / VS */}
                      <div className="text-center shrink-0 w-14">
                        {m.status === 'FINISHED' || m.status === 'LIVE' ? (
                          <span className="text-lg font-bold font-mono">
                            {m.homeScore ?? 0} – {m.awayScore ?? 0}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm font-medium">VS</span>
                        )}
                      </div>

                      {/* Away team */}
                      <TeamPickCard
                        team={m.awayTeam}
                        used={m.awayUsed}
                        isMyPick={isMyPickAway}
                        canPick={canPick && !m.awayUsed}
                        loading={picking === m.awayTeam.id}
                        score={m.awayScore}
                        onPick={() => handlePick(m.awayTeam.id)}
                        align="right"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Sidebar: Group standings ── */}
        {isGroupStage && groups.length > 0 && (
          <aside className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Clasificación</p>

            {/* Group tabs */}
            <div className="flex flex-wrap gap-1">
              {groups.map((g) => (
                <button
                  key={g.name}
                  onClick={() => setActiveGroup(activeGroup === g.name ? null : g.name)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md border transition-colors
                    ${activeGroup === g.name
                      ? 'bg-[hsl(var(--wc-gold))] text-background border-[hsl(var(--wc-gold))]'
                      : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {g.name}
                </button>
              ))}
            </div>

            {/* Standing table */}
            {(activeGroup ? groups.filter((g) => g.name === activeGroup) : groups.slice(0, 3)).map((g) => (
              <div key={g.name} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-3 py-2 bg-card border-b border-border flex items-center gap-2">
                  <span className="text-xs font-bold text-[hsl(var(--wc-gold))]">Grupo {g.name}</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left px-3 py-1.5 font-medium">Equipo</th>
                      <th className="px-1.5 py-1.5 font-medium">J</th>
                      <th className="px-1.5 py-1.5 font-medium">G</th>
                      <th className="px-1.5 py-1.5 font-medium">E</th>
                      <th className="px-1.5 py-1.5 font-medium">P</th>
                      <th className="px-2 py-1.5 font-bold text-[hsl(var(--wc-gold))]">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.standings.map((s, i) => (
                      <tr key={s.team.id} className={`border-b border-border/50 ${i < 2 ? 'bg-emerald-500/5' : ''}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-3">{s.position}</span>
                            <img src={s.team.logoUrl} alt={s.team.name} className="w-4 h-4 object-contain" />
                            <span className="truncate max-w-[90px]">{s.team.name}</span>
                          </div>
                        </td>
                        <td className="text-center px-1.5 py-2 text-muted-foreground">{s.played}</td>
                        <td className="text-center px-1.5 py-2 text-muted-foreground">{s.won}</td>
                        <td className="text-center px-1.5 py-2 text-muted-foreground">{s.drawn}</td>
                        <td className="text-center px-1.5 py-2 text-muted-foreground">{s.lost}</td>
                        <td className="text-center px-2 py-2 font-bold text-[hsl(var(--wc-gold))]">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {g.standings.length > 0 && (
                  <p className="px-3 py-1.5 text-[10px] text-muted-foreground/60">
                    🟢 Clasifican los 2 primeros
                  </p>
                )}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

// ── TeamPickCard ───────────────────────────────────────────────────────────

function TeamPickCard({
  team,
  used,
  isMyPick,
  canPick,
  loading,
  onPick,
  align = 'left',
}: {
  team: Team;
  used: boolean;
  isMyPick: boolean;
  canPick: boolean;
  loading: boolean;
  score?: number | null;
  onPick: () => void;
  align?: 'left' | 'right';
}) {
  const isRight = align === 'right';

  return (
    <div className={`flex flex-col items-center gap-2 flex-1 ${isRight ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
        <img
          src={team.logoUrl}
          alt={team.name}
          className={`w-10 h-10 object-contain transition-all ${used && !isMyPick ? 'grayscale opacity-40' : ''}`}
        />
        <span className={`text-sm font-semibold text-center leading-tight max-w-[80px] ${isRight ? 'text-right' : 'text-left'}`}>
          {team.name}
        </span>
      </div>

      {isMyPick ? (
        <span className="flex items-center gap-1 text-xs font-bold text-[hsl(var(--wc-gold))]">
          <Shield className="w-3 h-3" /> Tu pick
        </span>
      ) : used ? (
        <span className="text-xs text-muted-foreground/50">Ya usado</span>
      ) : canPick ? (
        <button
          onClick={onPick}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-full bg-[hsl(var(--wc-gold))]/15 border border-[hsl(var(--wc-gold))]/30 text-[hsl(var(--wc-gold))] hover:bg-[hsl(var(--wc-gold))]/25 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Elegir'}
        </button>
      ) : null}
    </div>
  );
}
