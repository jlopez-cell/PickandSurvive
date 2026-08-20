'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function JoinCodeContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const codeFromQuery = searchParams.get('code') || '';

  const [code, setCode] = useState<string>(codeFromQuery);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (codeFromQuery && codeFromQuery !== code) {
      setCode(codeFromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromQuery]);

  const redirectAfterLogin = useMemo(() => {
    const trimmed = code.trim();
    if (!trimmed) return '/join-code';
    return `/join-code?code=${encodeURIComponent(trimmed)}`;
  }, [code]);

  const submitJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus('error');
      setMessage('Introduce un código de invitación.');
      return;
    }

    if (!user && !authLoading) {
      router.push(`/login?redirect=${encodeURIComponent(redirectAfterLogin)}`);
      return;
    }

    setSubmitting(true);
    setStatus('idle');
    setMessage('');
    try {
      const res = await fetch(`/api/championships/join/${encodeURIComponent(trimmed)}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
        throw new Error(msg || 'No se pudo enviar la solicitud.');
      }

      setStatus('success');
      setMessage(data?.message || 'Solicitud enviada. El admin del campeonato deberá aprobarla.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Error de red. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const trimmed = codeFromQuery.trim();
    if (!trimmed) return;
    if (!user) return;
    if (submitting) return;
    if (status === 'success') return;
    void submitJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromQuery, user]);

  if (authLoading) {
    return (
      <main className="min-h-[100dvh] bg-background flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)]">
        <p className="text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Entrar con código</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Pegá el código del campeonato. Tu solicitud se enviará al admin para su aprobación.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="join-code" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Código
          </label>
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: 3f2c1e9c-..."
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="text"
            className="bg-secondary border border-border text-foreground rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none w-full placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitJoin();
            }}
          />
        </div>

        {status === 'success' && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 leading-relaxed">
            {message}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 leading-relaxed">
            {message}
          </div>
        )}

        <button
          disabled={submitting}
          onClick={() => void submitJoin()}
          className="bg-amber-500 text-black font-bold rounded-2xl py-3.5 w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? 'Enviando...' : 'Solicitar unirme'}
        </button>

        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Volver al dashboard
        </button>
      </div>
    </main>
  );
}

export default function JoinCodePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] bg-background flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)]">
          <p className="text-muted-foreground">Cargando...</p>
        </main>
      }
    >
      <JoinCodeContent />
    </Suspense>
  );
}
