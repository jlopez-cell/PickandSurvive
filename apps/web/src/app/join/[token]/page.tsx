'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleJoin = async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/championships/join/${token}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || '¡Solicitud enviada!');
        setStatus('success');
      } else {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setMessage(msg || 'No se pudo procesar la solicitud.');
        setStatus('error');
      }
    } catch {
      setMessage('Error de red. Inténtalo de nuevo.');
      setStatus('error');
    }
  };

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-background flex items-center justify-center pt-[env(safe-area-inset-top,0px)]">
        <p className="text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[100dvh] bg-background flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 flex flex-col gap-5 text-center">
          <div>
            <h1 className="text-xl font-bold text-foreground">Únete al campeonato</h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Debés iniciar sesión o registrarte para poder unirte a este campeonato.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              className="bg-amber-500 text-black font-bold rounded-2xl py-3.5 w-full"
              onClick={() => router.push(`/login?redirect=/join/${token}`)}
            >
              Iniciar sesión
            </button>
            <button
              className="bg-secondary border border-border text-foreground font-medium rounded-2xl py-3.5 w-full hover:bg-secondary/80 transition-colors"
              onClick={() => router.push(`/register?redirect=/join/${token}`)}
            >
              Registrarse
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 flex flex-col gap-5 text-center">
        {status === 'success' ? (
          <>
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-2xl flex items-center justify-center">
                ✓
              </div>
            </div>

            <div>
              <h1 className="text-xl font-bold text-foreground">Solicitud enviada</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{message}</p>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              El administrador del campeonato deberá aprobar tu solicitud. Te notificaremos por email.
            </p>

            <button
              className="bg-amber-500 text-black font-bold rounded-2xl py-3.5 w-full"
              onClick={() => router.push('/dashboard')}
            >
              Ir al dashboard
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold text-foreground">Únete al campeonato</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Hola, <strong className="text-amber-400 font-bold">@{user.alias}</strong>
              </p>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Al confirmar, se enviará una solicitud al administrador del campeonato. Tu participación
              quedará pendiente hasta que sea aprobada.
            </p>

            {status === 'error' && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 leading-relaxed">
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                className="bg-amber-500 text-black font-bold rounded-2xl py-3.5 w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                onClick={handleJoin}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Enviando...' : 'Solicitar unirme'}
              </button>
              <button
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => router.push('/dashboard')}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
