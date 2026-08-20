'use client';

import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function LoginContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get('redirect') || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, redirectTo || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#06090f] p-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white/85">Pick & Survive</h1>
          <p className="text-sm text-white/35 mt-1">Iniciá sesión para continuar</p>
        </div>

        <div className="bg-[#0c1220] border border-white/[0.07] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-white/35 uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-amber-500/30 focus:bg-white/[0.07] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-white/35 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-amber-500/30 focus:bg-white/[0.07] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-black font-bold rounded-2xl py-3 text-sm disabled:opacity-50 transition-opacity active:scale-[0.98]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/35">
            ¿No tenés cuenta?{' '}
            <Link
              href={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : '/register'}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] flex items-center justify-center bg-[#06090f]">
          <div className="w-6 h-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
