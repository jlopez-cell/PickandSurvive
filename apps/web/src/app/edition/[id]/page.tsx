'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Users, X, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

// ── Types ──────────────────────────────────────────────────────────────────

type Team = { id: string; name: string; logoUrl: string };

type Match = {
  id: string;
  status: string;
  kickoffTime?: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: Team;
  awayTeam: Team;
  homeUsed: boolean;
  awayUsed: boolean;
};

type MyPick = {
  id: string;
  status: string;
  pickType?: 'WIN' | 'WIN_OR_DRAW';
  team: Team | null;
  isDoubleOrNothing?: boolean;
};

type StandingRow = {
  participantId: string;
  alias: string;
  status: string;
  totalPoints?: number;
  eliminatedAtMatchday?: number | null;
  wildcardsRemaining?: number;
  blocksRemaining?: number;
  vetosRemaining?: number;
  challengesRemaining?: number;
  doubleOrNadaRemaining?: number;
  // Active tokens this matchday
  activeVeto?: { teamName: string; from: string } | null;
  activeChallenge?: { with: string } | null;
  isBlocked?: boolean;
  blockFrom?: string | null;
  doubleOrNadaActive?: boolean;
};

type SocialAction = 'BLOCK' | 'VETO' | 'CHALLENGE';
type SocialFlow = { action: SocialAction; step: 'rival' | 'team'; rivalId: string; rivalAlias: string } | null;

// ── Constants ──────────────────────────────────────────────────────────────

const PICK_STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  SURVIVED:           { label: 'Sobreviviste',        cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  DRAW_ELIMINATED:    { label: 'Eliminado · empate',  cls: 'text-red-400 bg-red-500/10 border-red-500/25',            icon: <XCircle className="w-3.5 h-3.5" />     },
  LOSS_ELIMINATED:    { label: 'Eliminado · derrota', cls: 'text-red-400 bg-red-500/10 border-red-500/25',            icon: <XCircle className="w-3.5 h-3.5" />     },
  NO_PICK_ELIMINATED: { label: 'Sin pick · eliminado',cls: 'text-red-400 bg-red-500/10 border-red-500/25',            icon: <XCircle className="w-3.5 h-3.5" />     },
  PENDING:            { label: 'Pendiente',           cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25',   icon: <Clock className="w-3.5 h-3.5" />       },
  POSTPONED_PENDING:  { label: 'Aplazado',            cls: 'text-sky-400 bg-sky-500/10 border-sky-500/25',            icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

function formatKickoff(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ── PickBottomSheet ────────────────────────────────────────────────────────

function PickBottomSheet({
  team,
  submitting,
  mode,
  onPick,
  onClose,
}: {
  team: Team;
  submitting: boolean;
  mode?: string;
  onPick: (pickType: 'WIN' | 'WIN_OR_DRAW') => void;
  onClose: () => void;
}) {
  const isTournament = mode === 'TOURNAMENT';
  return (
    <>
      <div
        className="fixed inset-x-0 top-0 bg-black/60 z-[60]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}
        onClick={onClose}
      />
      <div className="fixed bottom-[56px] inset-x-0 z-[70] bg-card border-t border-border rounded-t-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            {team.logoUrl && (
              <img src={team.logoUrl} alt={team.name} className="w-9 h-9 object-contain" />
            )}
            <span className="font-bold text-foreground text-base">{team.name}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3 pb-safe">
          <button
            disabled={submitting}
            onClick={() => onPick('WIN')}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 font-bold text-black text-base transition-colors"
          >
            🏆 Gana
          </button>
          {isTournament && (
            <button
              disabled={submitting}
              onClick={() => onPick('WIN_OR_DRAW')}
              className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-secondary hover:bg-secondary/80 border border-border disabled:opacity-50 font-bold text-foreground text-base transition-colors"
            >
              🤝 Empata
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── TeamButton ─────────────────────────────────────────────────────────────

function TeamButton({
  team,
  isUsed,
  isMyPick,
  isSelected,
  isOtherSelected,
  canPick,
  onSelect,
  align: _align,
}: {
  team: Team;
  isUsed: boolean;
  isMyPick: boolean;
  isSelected: boolean;
  isOtherSelected: boolean;
  canPick: boolean;
  onSelect: () => void;
  align: 'left' | 'right';
}) {
  const clickable = canPick && !isUsed;

  return (
    <button
      onClick={clickable ? onSelect : undefined}
      disabled={!clickable}
      className={cn(
        'flex-1 flex flex-col items-center gap-2 px-2 py-3 rounded-xl transition-all min-w-0',
        isMyPick && 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/30',
        isSelected && !isMyPick && 'bg-white/8 ring-1 ring-inset ring-white/20',
        isUsed && !isMyPick && 'opacity-35',
        isOtherSelected && !isMyPick && !isSelected && 'opacity-30',
        clickable && !isMyPick && !isSelected && 'hover:bg-white/[0.04] active:bg-white/8',
        !clickable && 'cursor-default',
      )}
    >
      <div className="relative shrink-0">
        <img
          src={team.logoUrl}
          alt={team.name}
          className={cn('w-14 h-14 object-contain', isUsed && !isMyPick && 'grayscale opacity-60')}
        />
        {isMyPick && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-black" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center min-w-0 w-full gap-0.5">
        <p className={cn(
          'text-[11px] font-semibold truncate leading-tight text-center w-full px-1',
          isMyPick ? 'text-amber-300' : isUsed ? 'text-muted-foreground/40' : 'text-foreground',
        )}>
          {team.name}
        </p>
        <p className="text-[10px] leading-none">
          {isMyPick
            ? <span className="text-amber-400/70 font-medium">Tu pick</span>
            : isUsed
            ? <span className="text-muted-foreground/50">Usado</span>
            : canPick && !isOtherSelected
            ? <span className="text-muted-foreground/50">Toca</span>
            : null}
        </p>
      </div>
    </button>
  );
}

// ── ParticipantsList ───────────────────────────────────────────────────────

function ParticipantsList({ editionId }: { editionId: string }) {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/editions/${editionId}/standings`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [editionId]);

  if (loading) {
    return <p className="text-center py-12 text-muted-foreground text-sm">Cargando jugadores...</p>;
  }

  const active = rows.filter((r) => r.status !== 'ELIMINATED');
  const eliminated = rows.filter((r) => r.status === 'ELIMINATED');

  return (
    <div className="space-y-6 py-2">
      {active.length > 0 && (
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-emerald-400/50 mb-3">
            Activos · {active.length}
          </p>
          {active.map((r) => (
            <div key={r.alias} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-emerald-400 uppercase">{r.alias[0]}</span>
              </div>
              <span className="text-sm text-foreground flex-1 font-medium">{r.alias}</span>
              {r.totalPoints != null && (
                <span className="text-xs font-bold text-amber-400 tabular-nums">{r.totalPoints} pts</span>
              )}
            </div>
          ))}
        </div>
      )}

      {eliminated.length > 0 && (
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-red-400/35 mb-3">
            Eliminados · {eliminated.length}
          </p>
          {eliminated.map((r) => (
            <div key={r.alias} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0 opacity-40">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-red-400 uppercase">{r.alias[0]}</span>
              </div>
              <span className="text-sm text-muted-foreground flex-1 font-medium">{r.alias}</span>
              <XCircle className="w-4 h-4 text-red-400/40" />
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Sin participantes</p>
      )}
    </div>
  );
}

// ── SocialBottomSheet ──────────────────────────────────────────────────────

function SocialBottomSheet({
  flow,
  rivals,
  teams,
  loading,
  error,
  onSelectRival,
  onSelectTeam,
  onBack,
  onClose,
}: {
  flow: NonNullable<SocialFlow>;
  rivals: { participantId: string; alias: string }[];
  teams: Team[];
  loading: boolean;
  error: string;
  onSelectRival: (id: string, alias: string) => void;
  onSelectTeam: (teamId: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const ACTION_LABEL: Record<SocialAction, string> = {
    BLOCK: '🔒 Bloquear a…',
    VETO: '🚫 Vetar equipo a…',
    CHALLENGE: '⚔️ Retar a…',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />

      {/* Centered modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl flex flex-col max-h-[70vh] shadow-2xl">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border shrink-0">
            {flow.step === 'team' && (
              <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <p className="flex-1 font-bold text-foreground text-sm">
              {flow.step === 'rival'
                ? ACTION_LABEL[flow.action]
                : `¿Qué equipo vetás a @${flow.rivalAlias}?`}
            </p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 px-4 py-2 shrink-0">{error}</p>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1 px-3 py-2">
            {flow.step === 'rival' ? (
              rivals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin rivales activos</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {rivals.map((r) => (
                    <button
                      key={r.participantId}
                      disabled={loading}
                      onClick={() => onSelectRival(r.participantId, r.alias)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary active:scale-[0.98] transition-all text-left w-full disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-sm font-black text-foreground/80 shrink-0">
                        {r.alias[0]?.toUpperCase()}
                      </div>
                      <span className="font-semibold text-foreground text-sm">@{r.alias}</span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              teams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin equipos disponibles</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      disabled={loading}
                      onClick={() => onSelectTeam(t.id)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary active:scale-[0.98] transition-all text-left w-full disabled:opacity-50"
                    >
                      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />}
                      <span className="font-semibold text-foreground text-sm">{t.name}</span>
                      {loading && <span className="ml-auto text-xs text-muted-foreground">Guardando…</span>}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── StandingsTab ───────────────────────────────────────────────────────────

function StandingsTab({ editionId, championshipMode }: { editionId: string; championshipMode: string }) {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isLeague = championshipMode === 'LEAGUE';

  useEffect(() => {
    fetch(`/api/editions/${editionId}/standings`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [editionId]);

  if (loading) {
    return <p className="text-center py-12 text-muted-foreground text-sm">Cargando clasificación…</p>;
  }

  const active = rows.filter((r) => r.status !== 'ELIMINATED');
  const eliminated = rows.filter((r) => r.status === 'ELIMINATED');

  return (
    <div className="py-2">
      {active.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-black tracking-widest uppercase text-emerald-400/60 mb-2 px-1">
            Activos · {active.length}
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {active.map((r, i) => (
              <div
                key={r.alias}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  i < active.length - 1 && 'border-b border-border/40',
                )}
              >
                <span className="w-5 text-[11px] font-black text-muted-foreground/40 tabular-nums text-center shrink-0">
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-emerald-400 uppercase">{r.alias[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate block">{r.alias}</span>
                  {(r.activeVeto || r.activeChallenge || r.isBlocked || r.doubleOrNadaActive) && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {r.activeVeto && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30"
                          title={`${r.activeVeto.from} vetó ${r.activeVeto.teamName}`}
                        >
                          🚫 {r.activeVeto.teamName}
                        </span>
                      )}
                      {r.activeChallenge && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30"
                          title={`Reto con ${r.activeChallenge.with}`}
                        >
                          ⚔️ {r.activeChallenge.with}
                        </span>
                      )}
                      {r.isBlocked && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/30"
                          title={`Bloqueado por ${r.blockFrom}`}
                        >
                          🔒 {r.blockFrom}
                        </span>
                      )}
                      {r.doubleOrNadaActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          🎲 doble o nada
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isLeague && r.totalPoints != null && (
                  <span className="text-sm font-black text-amber-400 tabular-nums shrink-0">{r.totalPoints} pts</span>
                )}
                {r.wildcardsRemaining != null && r.wildcardsRemaining > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">🛡️ {r.wildcardsRemaining}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {eliminated.length > 0 && (
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-red-400/40 mb-2 px-1">
            Eliminados · {eliminated.length}
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {eliminated.map((r, i) => (
              <div
                key={r.alias}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 opacity-45',
                  i < eliminated.length - 1 && 'border-b border-border/40',
                )}
              >
                <span className="w-5 text-[11px] font-black text-muted-foreground/40 tabular-nums text-center shrink-0">
                  {active.length + i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-red-400 uppercase">{r.alias[0]}</span>
                </div>
                <span className="flex-1 text-sm font-semibold text-muted-foreground truncate">{r.alias}</span>
                {r.eliminatedAtMatchday != null && (
                  <span className="text-[11px] text-muted-foreground/60">J{r.eliminatedAtMatchday}</span>
                )}
                <XCircle className="w-3.5 h-3.5 text-red-400/50 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Sin participantes</p>
      )}
    </div>
  );
}

// ── LogoImage ──────────────────────────────────────────────────────────────

function LaLigaLogo() {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) {
    return (
      <Shield className="relative w-16 h-16 sm:w-20 sm:h-20 text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
    );
  }
  return (
    <img
      src="/Logo_LaLiga.png"
      alt="La Liga"
      className="relative w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_20px_rgba(245,158,11,0.45)]"
      onError={() => setImgFailed(true)}
    />
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function EditionPage() {
  const { id: editionId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [editionStartMatchday, setEditionStartMatchday] = useState<number | null>(null);
  const [editionEndMatchday, setEditionEndMatchday] = useState<number | null>(null);
  const [leagueSeason, setLeagueSeason] = useState<number | null>(null);
  const [championshipName, setChampionshipName] = useState('');

  const [currentMatchday, setCurrentMatchday] = useState<number>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myPick, setMyPick] = useState<MyPick | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [participantEliminated, setParticipantEliminated] = useState(false);
  const [matchdayFirstKickoff, setMatchdayFirstKickoff] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'picks' | 'jugadores' | 'clasificacion'>('picks');

  const [championshipId, setChampionshipId] = useState('');
  const [championshipMode, setChampionshipMode] = useState('');
  const [doubleOrNothingEnabled, setDoubleOrNothingEnabled] = useState(false);
  const [wildcardCount, setWildcardCount] = useState(0);
  const [wildcardsRemaining, setWildcardsRemaining] = useState<number | null>(null);
  const [hasUsedDoubleOrNothing, setHasUsedDoubleOrNothing] = useState(false);
  const [doubleOrNothingActive, setDoubleOrNothingActive] = useState(false);

  const [blockCount, setBlockCount] = useState(0);
  const [vetoCount, setVetoCount] = useState(0);
  const [challengeCount, setChallengeCount] = useState(0);
  const [doubleOrNadaCount, setDoubleOrNadaCount] = useState(0);
  const [blocksRemaining, setBlocksRemaining] = useState<number | null>(null);
  const [vetosRemaining, setVetosRemaining] = useState<number | null>(null);
  const [challengesRemaining, setChallengesRemaining] = useState<number | null>(null);
  const [doubleOrNadaRemaining, setDoubleOrNadaRemaining] = useState<number | null>(null);

  const [rivals, setRivals] = useState<{ participantId: string; alias: string }[]>([]);
  const [socialFlow, setSocialFlow] = useState<SocialFlow>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState('');

  // 1-second countdown + deadline check
  useEffect(() => {
    if (!matchdayFirstKickoff) {
      setCountdown('');
      setDeadlinePassed(false);
      return;
    }
    const tick = () => {
      const diff = new Date(matchdayFirstKickoff).getTime() - Date.now();
      if (diff <= 0) {
        setDeadlinePassed(true);
        setCountdown('Cerrado');
      } else {
        setDeadlinePassed(false);
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setCountdown(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
      }
    };
    tick();
    const t = setInterval(tick, 1_000);
    return () => clearInterval(t);
  }, [matchdayFirstKickoff]);

  const loadData = useCallback(async (matchday: number) => {
    setLoading(true);
    setError('');
    setDoubleOrNothingActive(false);
    try {
      const [matchesRes, picksRes] = await Promise.all([
        fetch(`/api/editions/${editionId}/matches?matchday=${matchday}`),
        fetch(`/api/editions/${editionId}/picks?matchday=${matchday}`),
      ]);
      const matchesData = await matchesRes.json();
      const picksData = await picksRes.json();

      const list: Match[] = Array.isArray(matchesData) ? matchesData : [];
      setMatches(list);

      if (list.length > 0) {
        const kickoffs = list
          .map((m) => m.kickoffTime)
          .filter((k): k is string => typeof k === 'string' && !Number.isNaN(new Date(k).getTime()))
          .map((k) => new Date(k).getTime());
        setMatchdayFirstKickoff(kickoffs.length > 0 ? new Date(Math.min(...kickoffs)).toISOString() : null);
      } else {
        setMatchdayFirstKickoff(null);
      }

      setMyPick(picksData?.myPick ?? null);
      if (typeof picksData?.wildcardsRemaining === 'number') {
        setWildcardsRemaining(picksData.wildcardsRemaining);
      }
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  // Load edition meta → find current matchday
  useEffect(() => {
    if (authLoading) return;
    setEditionStartMatchday(null);
    setLoading(true);

    fetch(`/api/editions/${editionId}/meta`)
      .then((r) => r.json())
      .then(async (meta) => {
        const start = Number.isFinite(Number(meta.startMatchday)) ? Number(meta.startMatchday) : 1;
        const end = meta.endMatchday != null ? Number(meta.endMatchday) : null;
        setEditionStartMatchday(start);
        setEditionEndMatchday(Number.isFinite(end) ? end : null);
        setLeagueSeason(meta.season ?? null);
        setChampionshipId(meta.championshipId ?? '');
        setChampionshipName(meta.championshipName ?? meta.name ?? '');
        setChampionshipMode(meta.mode ?? meta.championshipMode ?? '');
        setDoubleOrNothingEnabled(meta.doubleOrNothingEnabled ?? false);
        setWildcardCount(meta.wildcardCount ?? 0);
        setBlockCount(meta.blockCount ?? 0);
        setVetoCount(meta.vetoCount ?? 0);
        setChallengeCount(meta.challengeCount ?? 0);
        setDoubleOrNadaCount(meta.doubleOrNadaCount ?? 0);

        let initialMd = start;
        try {
          const dRes = await fetch(`/api/editions/${editionId}/deadline`);
          const dData = await dRes.json();
          const current = Number(dData?.matchdayNumber);
          if (Number.isFinite(current)) {
            initialMd = end != null && Number.isFinite(end)
              ? Math.min(Math.max(current, start), end as number)
              : Math.max(current, start);
          }
        } catch { /* keep start */ }
        setCurrentMatchday(initialMd);
      })
      .catch(() => {
        setEditionStartMatchday(1);
        setCurrentMatchday(1);
        setLoading(false);
      });
  }, [authLoading, editionId]);

  useEffect(() => {
    if (authLoading || editionStartMatchday === null) return;
    loadData(currentMatchday);
  }, [authLoading, editionStartMatchday, currentMatchday, loadData]);

  // Fetch elimination status + wildcardsRemaining + rivals for social actions
  useEffect(() => {
    if (authLoading || !user?.alias) { setParticipantEliminated(false); return; }
    fetch(`/api/editions/${editionId}/standings`)
      .then((r) => r.json())
      .then((data) => {
        const rows: StandingRow[] = Array.isArray(data) ? data : [];
        const me = rows.find((r) => r.alias === user.alias);
        setParticipantEliminated(me?.status === 'ELIMINATED');
        if (typeof me?.wildcardsRemaining === 'number') setWildcardsRemaining(me.wildcardsRemaining);
        if (typeof me?.blocksRemaining === 'number') setBlocksRemaining(me.blocksRemaining);
        if (typeof me?.vetosRemaining === 'number') setVetosRemaining(me.vetosRemaining);
        if (typeof me?.challengesRemaining === 'number') setChallengesRemaining(me.challengesRemaining);
        if (typeof me?.doubleOrNadaRemaining === 'number') setDoubleOrNadaRemaining(me.doubleOrNadaRemaining);
        const activeRivals = rows.filter((r) => r.alias !== user.alias && r.status !== 'ELIMINATED');
        setRivals(activeRivals.map((r) => ({ participantId: r.participantId, alias: r.alias })));
      })
      .catch(() => setParticipantEliminated(false));
  }, [editionId, user?.alias, authLoading]);

  // Check if double-or-nothing was already used in this edition
  useEffect(() => {
    if (!editionId) return;
    fetch(`/api/editions/${editionId}/picks`)
      .then((r) => r.json())
      .then((data) => {
        const picks = Array.isArray(data) ? data : Array.isArray(data?.picks) ? data.picks : [];
        setHasUsedDoubleOrNothing(
          picks.some((p: { isDoubleOrNothing?: boolean }) => p.isDoubleOrNothing === true),
        );
      })
      .catch(() => {});
  }, [editionId]);

  const canPick = !submitting && !participantEliminated && !deadlinePassed;

  function handleSelectTeam(teamId: string) {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
    setError('');
  }

  async function handlePick(pickType: 'WIN' | 'WIN_OR_DRAW') {
    if (!selectedTeamId || !canPick) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/editions/${editionId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId, matchdayNumber: currentMatchday, pickType, isDoubleOrNothing: doubleOrNothingActive }),
      });
      if (res.ok) {
        if (doubleOrNothingActive) setHasUsedDoubleOrNothing(true);
        setSelectedTeamId(null);
        await loadData(currentMatchday);
      } else {
        const data = await res.json();
        const msg = Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Error al registrar el pick');
        setError(msg);
      }
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTeam = selectedTeamId
    ? matches.flatMap((m) => [m.homeTeam, m.awayTeam]).find((t) => t.id === selectedTeamId) ?? null
    : null;

  const matchdayTeams: Team[] = matches.length > 0
    ? Array.from(
        new Map(
          matches.flatMap((m) => [m.homeTeam, m.awayTeam]).map((t) => [t.id, t]),
        ).values(),
      )
    : [];

  function openSocialFlow(action: SocialAction) {
    setSocialError('');
    setSocialFlow({ action, step: 'rival', rivalId: '', rivalAlias: '' });
  }

  function handleSocialRival(rivalId: string, rivalAlias: string) {
    if (!socialFlow) return;
    if (socialFlow.action === 'VETO') {
      setSocialFlow({ ...socialFlow, step: 'team', rivalId, rivalAlias });
    } else {
      executeSocialAction(socialFlow.action, rivalId, rivalAlias, null);
    }
  }

  async function executeSocialAction(action: SocialAction, rivalId: string, rivalAlias: string, teamId: string | null) {
    setSocialLoading(true);
    setSocialError('');
    try {
      const body: Record<string, unknown> = { targetParticipantId: rivalId, matchdayNumber: currentMatchday };
      if (action === 'VETO' && teamId) body.teamId = teamId;
      const endpoint = action === 'BLOCK' ? 'blocks' : action === 'VETO' ? 'vetos' : 'challenges';
      const res = await fetch(`/api/editions/${editionId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSocialFlow(null);
        // refresh tokens
        const d = await fetch(`/api/editions/${editionId}/standings`).then((r) => r.json()).catch(() => []);
        const rows: StandingRow[] = Array.isArray(d) ? d : [];
        const me = rows.find((r) => r.alias === user?.alias);
        if (typeof me?.blocksRemaining === 'number') setBlocksRemaining(me.blocksRemaining);
        if (typeof me?.vetosRemaining === 'number') setVetosRemaining(me.vetosRemaining);
        if (typeof me?.challengesRemaining === 'number') setChallengesRemaining(me.challengesRemaining);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Error al ejecutar la acción');
        setSocialError(msg);
      }
    } catch {
      setSocialError('Error de red');
    } finally {
      setSocialLoading(false);
    }
  }

  const pickStatus = myPick?.status ? (PICK_STATUS_CONFIG[myPick.status] ?? null) : null;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (authLoading || (loading && editionStartMatchday === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Shield className="w-14 h-14 mx-auto text-amber-500 animate-pulse drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
          <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Cargando…</p>
        </div>
      </div>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom,0px)+80px)] lg:pb-0">

      {/* ══ BOTTOM SHEET ══════════════════════════════════════════════════ */}
      {selectedTeam && canPick && (
        <PickBottomSheet
          team={selectedTeam}
          submitting={submitting}
          mode={championshipMode}
          onPick={handlePick}
          onClose={() => setSelectedTeamId(null)}
        />
      )}

      {socialFlow && (
        <SocialBottomSheet
          flow={socialFlow}
          rivals={rivals}
          teams={matchdayTeams}
          loading={socialLoading}
          error={socialError}
          onSelectRival={handleSocialRival}
          onSelectTeam={(teamId) => {
            if (socialFlow) executeSocialAction('VETO', socialFlow.rivalId, socialFlow.rivalAlias, teamId);
          }}
          onBack={() => setSocialFlow((f) => f ? { ...f, step: 'rival', rivalId: '', rivalAlias: '' } : null)}
          onClose={() => { setSocialFlow(null); setSocialError(''); }}
        />
      )}

      {/* ══ HERO HEADER ═══════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        {/* Layered backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/30 via-background/95 to-background" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(245,158,11,0.12) 0%, transparent 65%)' }}
        />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4">
          {/* Nav row */}
          <div className="h-13 flex items-center justify-between py-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-400/50 hover:text-amber-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </button>
            <div className="hidden sm:flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-500/25">
                La Liga
              </span>
              {championshipName && (
                <span className="text-[11px] font-medium text-amber-300/45 truncate max-w-[180px]">
                  {championshipName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/guide')}
                className="text-amber-400/50 hover:text-amber-400 transition-colors"
                aria-label="Guía del juego"
              >
                <Lightbulb className="w-5 h-5" />
              </button>
              <button
                onClick={() => setActiveTab('jugadores')}
                className="text-amber-400/50 hover:text-amber-400 transition-colors"
                aria-label="Jugadores"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Hero content */}
          <div className="pb-8 pt-3 flex flex-col items-center text-center gap-3">
            {/* Logo */}
            <div className="relative">
              <div className="absolute inset-0 scale-150 blur-2xl bg-amber-500/10 rounded-full" />
              <LaLigaLogo />
            </div>

            {/* Title */}
            <div>
              <h1
                className="text-4xl sm:text-5xl font-black tracking-tight text-amber-400"
                style={{ textShadow: '0 0 50px rgba(245,158,11,0.4), 0 0 100px rgba(245,158,11,0.15), 0 3px 10px rgba(0,0,0,0.9)' }}
              >
                La Liga
              </h1>
              {leagueSeason != null && (
                <p className="text-xs font-medium tracking-widest uppercase text-amber-300/30 mt-1.5">
                  Temporada {leagueSeason}/{Number(leagueSeason) + 1}
                </p>
              )}
            </div>

            {/* Matchday nav */}
            <div className="flex items-center gap-3 mt-0.5">
              <button
                onClick={() => {
                  const min = editionStartMatchday ?? 1;
                  if (currentMatchday > min) {
                    setCurrentMatchday((m) => m - 1);
                    setSelectedTeamId(null);
                  }
                }}
                disabled={currentMatchday <= (editionStartMatchday ?? 1)}
                className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors text-lg"
              >
                ‹
              </button>
              <span className="text-sm font-bold text-muted-foreground min-w-[90px] text-center">
                Jornada {currentMatchday}
              </span>
              <button
                onClick={() => {
                  if (editionEndMatchday == null || currentMatchday < editionEndMatchday) {
                    setCurrentMatchday((m) => m + 1);
                    setSelectedTeamId(null);
                  }
                }}
                disabled={editionEndMatchday != null && currentMatchday >= editionEndMatchday}
                className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors text-lg"
              >
                ›
              </button>
            </div>

            {/* Deadline / eliminated pill */}
            {participantEliminated ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-bold text-red-400">Has sido eliminado</span>
              </div>
            ) : deadlinePassed ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary border border-border">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Picks cerrados</span>
              </div>
            ) : matchdayFirstKickoff ? (
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">Cierra en {countdown}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/70">
                  {new Date(matchdayFirstKickoff).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}
                  {new Date(matchdayFirstKickoff).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative border-b border-border overflow-x-auto">
          <div className="max-w-4xl mx-auto px-4 flex min-w-max">
            {([
              { key: 'picks', label: '⚽ Picks' },
              { key: 'jugadores', label: '👥 Jugadores' },
              { key: 'clasificacion', label: '🏆 Clasificación' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'px-4 py-3 text-sm font-bold transition-colors relative whitespace-nowrap',
                  activeTab === key ? 'text-amber-400' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {activeTab === key && (
                  <span className="absolute bottom-0 inset-x-2 h-0.5 bg-amber-500 rounded-t-full" />
                )}
              </button>
            ))}
            {championshipId && (
              <button
                onClick={() => router.push(`/championship/${championshipId}`)}
                className="px-4 py-3 text-sm font-bold transition-colors relative whitespace-nowrap text-muted-foreground hover:text-foreground ml-auto"
              >
                ⚙️ Ajustes
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ══ CONTENT ════════════════════════════════════════════════════════ */}
      <main className="max-w-4xl mx-auto px-4 py-4">

        {/* ── Picks tab ──────────────────────────────────────────────────── */}
        {activeTab === 'picks' && (
          <div>
            {error && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* My pick banner */}
            {myPick?.team && (
              <div className={cn(
                'mb-4 flex items-center gap-3 px-3 py-3 rounded-2xl border',
                pickStatus ? pickStatus.cls : 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400',
              )}>
                <img
                  src={myPick.team.logoUrl}
                  alt={myPick.team.name}
                  className="w-10 h-10 object-contain shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{myPick.team.name}</p>
                  {myPick.pickType && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {myPick.pickType === 'WIN_OR_DRAW' ? '🤝 Empata' : '🏆 Gana'}
                    </p>
                  )}
                </div>
                {pickStatus && (
                  <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold shrink-0', pickStatus.cls)}>
                    {pickStatus.icon}
                    <span>{pickStatus.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* Wildcard badge */}
            {wildcardCount > 0 && !participantEliminated && (
              <div className="mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <span className="text-base shrink-0">🛡️</span>
                <div className="flex-1 min-w-0">
                  {wildcardsRemaining !== null ? (
                    wildcardsRemaining > 0 ? (
                      <p className="text-sm font-semibold text-amber-300">
                        {wildcardsRemaining} vida{wildcardsRemaining !== 1 ? 's' : ''} extra
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin vidas extra</p>
                    )
                  ) : (
                    <p className="text-sm font-semibold text-amber-300">Vidas extra disponibles</p>
                  )}
                </div>
              </div>
            )}

            {/* Social tokens — clickable buttons */}
            {(blockCount > 0 || vetoCount > 0 || challengeCount > 0) && !participantEliminated && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                {blockCount > 0 && (
                  <button
                    disabled={(blocksRemaining ?? 0) <= 0}
                    onClick={() => openSocialFlow('BLOCK')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-sm font-semibold disabled:opacity-40 hover:border-amber-500/30 active:scale-95 transition-all"
                  >
                    <span>🔒</span>
                    <span className="text-muted-foreground">Bloqueos:</span>
                    <span className="font-bold text-foreground tabular-nums">{blocksRemaining ?? '—'}</span>
                  </button>
                )}
                {vetoCount > 0 && (
                  <button
                    disabled={(vetosRemaining ?? 0) <= 0}
                    onClick={() => openSocialFlow('VETO')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-sm font-semibold disabled:opacity-40 hover:border-amber-500/30 active:scale-95 transition-all"
                  >
                    <span>🚫</span>
                    <span className="text-muted-foreground">Vetos:</span>
                    <span className="font-bold text-foreground tabular-nums">{vetosRemaining ?? '—'}</span>
                  </button>
                )}
                {challengeCount > 0 && (
                  <button
                    disabled={(challengesRemaining ?? 0) <= 0}
                    onClick={() => openSocialFlow('CHALLENGE')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-sm font-semibold disabled:opacity-40 hover:border-amber-500/30 active:scale-95 transition-all"
                  >
                    <span>⚔️</span>
                    <span className="text-muted-foreground">Retos:</span>
                    <span className="font-bold text-foreground tabular-nums">{challengesRemaining ?? '—'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Double or nada — token mode */}
            {doubleOrNadaCount > 0 && !participantEliminated && (
              <button
                disabled={(doubleOrNadaRemaining ?? 0) <= 0 || !!myPick}
                onClick={() => setDoubleOrNothingActive((v) => !v)}
                className={cn(
                  'mb-4 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-all active:scale-95',
                  doubleOrNothingActive
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-card border-border text-foreground hover:border-amber-500/30 disabled:opacity-40',
                )}
              >
                <span>🎲</span>
                <span className={doubleOrNothingActive ? 'text-amber-400' : 'text-muted-foreground'}>Doble o nada:</span>
                <span className="font-bold tabular-nums">{doubleOrNadaRemaining ?? '—'}</span>
                {doubleOrNothingActive && <span className="ml-1 text-[10px] text-amber-400/80">ACTIVO</span>}
              </button>
            )}

            {/* Double or nothing — legacy boolean mode */}
            {doubleOrNothingEnabled && doubleOrNadaCount === 0 && championshipMode === 'LEAGUE' && (
              hasUsedDoubleOrNothing ? (
                <div className="mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary border border-border">
                  <span className="text-base shrink-0">🎲</span>
                  <p className="text-sm text-muted-foreground">Comodín usado</p>
                </div>
              ) : !myPick ? (
                <label className="mb-4 flex items-center gap-3 px-3 py-3 rounded-xl border border-border bg-secondary/50 cursor-pointer hover:border-amber-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={doubleOrNothingActive}
                    onChange={(e) => setDoubleOrNothingActive(e.target.checked)}
                    className="h-4 w-4 accent-amber-500 rounded shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Doble o nada 🎲</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">×2 si ganás · -3 si perdés</p>
                  </div>
                </label>
              ) : null
            )}

            {/* Match list */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Cargando jornada…</div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No hay partidos disponibles</div>
            ) : (
              <div className="flex flex-col gap-2">
                {matches.map((match) => {
                  const homeLocked = match.homeUsed && myPick?.team?.id !== match.homeTeam.id;
                  const awayLocked = match.awayUsed && myPick?.team?.id !== match.awayTeam.id;
                  const isHomeMyPick = myPick?.team?.id === match.homeTeam.id;
                  const isAwayMyPick = myPick?.team?.id === match.awayTeam.id;
                  const isHomeSelected = selectedTeamId === match.homeTeam.id;
                  const isAwaySelected = selectedTeamId === match.awayTeam.id;
                  const someSelected = isHomeSelected || isAwaySelected;
                  const isPickedMatch = isHomeMyPick || isAwayMyPick;

                  const isLive = ['LIVE', 'IN_PLAY', 'HALFTIME', '1H', '2H', 'HT'].includes(match.status);
                  const isFinished = ['FINISHED', 'FT', 'AET', 'PEN'].includes(match.status);
                  const hasScore = match.homeScore !== null && match.awayScore !== null;

                  return (
                    <div
                      key={match.id}
                      className={cn(
                        'rounded-2xl border overflow-hidden transition-all',
                        isPickedMatch
                          ? 'border-amber-500/30 bg-card shadow-[0_0_24px_rgba(245,158,11,0.06)]'
                          : 'border-border bg-card',
                      )}
                    >
                      {/* Status bar */}
                      <div className={cn(
                        'flex items-center justify-between px-3 py-1.5 border-b',
                        isLive
                          ? 'border-red-500/20 bg-red-500/[0.06]'
                          : 'border-border/40 bg-secondary/30',
                      )}>
                        <div className="flex items-center gap-1.5">
                          {isLive ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">En vivo</span>
                            </>
                          ) : isFinished ? (
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Finalizado</span>
                          ) : (
                            <span className="text-[10px] font-medium text-muted-foreground">{formatKickoff(match.kickoffTime)}</span>
                          )}
                        </div>
                        {isPickedMatch && (
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Tu pick</span>
                        )}
                      </div>

                      {/* Teams + score */}
                      <div className="flex items-center px-2 py-3 gap-1">
                        <TeamButton
                          team={match.homeTeam}
                          isUsed={homeLocked}
                          isMyPick={isHomeMyPick}
                          isSelected={isHomeSelected}
                          isOtherSelected={someSelected && !isHomeSelected}
                          canPick={canPick}
                          onSelect={() => handleSelectTeam(match.homeTeam.id)}
                          align="left"
                        />

                        {/* Score / VS */}
                        <div className="flex flex-col items-center justify-center shrink-0 w-14 gap-0.5">
                          {hasScore ? (
                            <span className="text-xl font-black text-foreground tabular-nums tracking-tight leading-none">
                              {match.homeScore}
                              <span className="text-muted-foreground mx-0.5">–</span>
                              {match.awayScore}
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-muted-foreground/30 tracking-widest">VS</span>
                          )}
                        </div>

                        <TeamButton
                          team={match.awayTeam}
                          isUsed={awayLocked}
                          isMyPick={isAwayMyPick}
                          isSelected={isAwaySelected}
                          isOtherSelected={someSelected && !isAwaySelected}
                          canPick={canPick}
                          onSelect={() => handleSelectTeam(match.awayTeam.id)}
                          align="right"
                        />
                      </div>

                      {/* Amber strip on picked match */}
                      {isPickedMatch && (
                        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Jugadores tab ──────────────────────────────────────────────── */}
        {activeTab === 'jugadores' && (
          <ParticipantsList editionId={editionId} />
        )}

        {/* ── Clasificación tab ──────────────────────────────────────────── */}
        {activeTab === 'clasificacion' && (
          <StandingsTab editionId={editionId} championshipMode={championshipMode} />
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
}
