'use client';

import { useEffect, useRef, useState } from 'react';

type AvailableTeam = { id: string; name: string; logoUrl?: string | null };

type SocialActionsProps = {
  editionId: string;
  targetParticipantId: string;
  targetAlias: string;
  matchdayNumber: number;
  myParticipant: {
    id: string;
    blocksRemaining: number;
    vetosRemaining: number;
    challengesRemaining: number;
  };
  availableTeams: AvailableTeam[];
  onSuccess: () => void;
};

export function SocialActions({
  editionId,
  targetParticipantId,
  targetAlias,
  matchdayNumber,
  myParticipant,
  availableTeams,
  onSuccess,
}: SocialActionsProps) {
  const [open, setOpen] = useState(false);
  const [vetoStep, setVetoStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setVetoStep(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  }

  function toggle() {
    setOpen((o) => !o);
    setVetoStep(false);
    setError('');
  }

  async function doBlock() {
    setLoading(true);
    try {
      const res = await fetch(`/api/editions/${editionId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetParticipantId, matchdayNumber }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Error al bloquear');
        showError(msg);
        return;
      }
      setOpen(false);
      onSuccess();
    } catch {
      showError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  async function doVeto(teamId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/editions/${editionId}/vetos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetParticipantId, teamId, matchdayNumber }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Error al vetar');
        showError(msg);
        return;
      }
      setOpen(false);
      setVetoStep(false);
      onSuccess();
    } catch {
      showError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  async function doChallenge() {
    setLoading(true);
    try {
      const res = await fetch(`/api/editions/${editionId}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetParticipantId, matchdayNumber }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Error al retar');
        showError(msg);
        return;
      }
      setOpen(false);
      onSuccess();
    } catch {
      showError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  const hasAny =
    myParticipant.blocksRemaining > 0 ||
    myParticipant.vetosRemaining > 0 ||
    myParticipant.challengesRemaining > 0;

  if (!hasAny) return null;

  return (
    <div ref={menuRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Acciones sobre ${targetAlias}`}
        className="px-1.5 py-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm leading-none"
      >
        ···
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-2 min-w-[190px]">
          {error && (
            <p className="text-xs text-red-400 px-3 py-1 mb-1">{error}</p>
          )}

          {vetoStep ? (
            <div>
              <button
                type="button"
                onClick={() => setVetoStep(false)}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 w-full text-left transition-colors"
              >
                ← Volver
              </button>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 pt-1 pb-0.5">
                Elegí el equipo a vetar
              </p>
              {availableTeams.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">Sin equipos disponibles</p>
              ) : (
                <div className="flex flex-col gap-0.5 mt-1">
                  {availableTeams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={loading}
                      onClick={() => doVeto(t.id)}
                      className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-secondary w-full text-left transition-colors disabled:opacity-50"
                    >
                      {t.logoUrl && (
                        <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                      )}
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {myParticipant.blocksRemaining > 0 && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={doBlock}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-secondary w-full text-left transition-colors disabled:opacity-50"
                >
                  <span>🔒</span>
                  <span>Bloquear ({myParticipant.blocksRemaining})</span>
                </button>
              )}
              {myParticipant.vetosRemaining > 0 && (
                <button
                  type="button"
                  onClick={() => setVetoStep(true)}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-secondary w-full text-left transition-colors"
                >
                  <span>🚫</span>
                  <span>Vetar equipo ({myParticipant.vetosRemaining})</span>
                </button>
              )}
              {myParticipant.challengesRemaining > 0 && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={doChallenge}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-secondary w-full text-left transition-colors disabled:opacity-50"
                >
                  <span>⚔️</span>
                  <span>Retar ({myParticipant.challengesRemaining})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
