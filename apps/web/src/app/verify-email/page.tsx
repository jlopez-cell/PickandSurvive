'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token no encontrado en la URL.');
      return;
    }

    apiFetch<{ message: string }>(`/auth/verify?token=${token}`)
      .then(data => {
        setMessage(data.message);
        setStatus('success');
      })
      .catch(err => {
        setMessage(err instanceof Error ? err.message : 'Error al verificar el email.');
        setStatus('error');
      });
  }, [token]);

  return (
    <main className="min-h-[100dvh] bg-[#06090f] flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm bg-[#0c1220] border border-white/[0.07] rounded-2xl p-6 flex flex-col gap-5 text-center">
        {/* Status icon */}
        <div className="flex justify-center">
          {status === 'loading' && (
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <span className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin block" />
            </div>
          )}
          {status === 'success' && (
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-2xl flex items-center justify-center">
              ✓
            </div>
          )}
          {status === 'error' && (
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-2xl flex items-center justify-center">
              ✕
            </div>
          )}
        </div>

        {/* Title + description */}
        <div>
          {status === 'loading' && (
            <>
              <h1 className="text-xl font-bold text-white/85">Verificando...</h1>
              <p className="text-sm text-white/35 mt-1.5">Por favor esperá un momento.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <h1 className="text-xl font-bold text-emerald-400">Email verificado</h1>
              <p className="text-sm text-white/35 mt-1.5 leading-relaxed">{message}</p>
            </>
          )}
          {status === 'error' && (
            <>
              <h1 className="text-xl font-bold text-red-400">Error de verificación</h1>
              <p className="text-sm text-white/35 mt-1.5 leading-relaxed">{message}</p>
            </>
          )}
        </div>

        {/* CTA */}
        {status !== 'loading' && (
          <Link
            href="/login"
            className="bg-amber-500 text-black font-bold rounded-2xl py-3.5 w-full block"
          >
            {status === 'success' ? 'Ir al login' : 'Volver al login'}
          </Link>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] bg-[#06090f] flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)]">
          <p className="text-white/35">Cargando...</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
