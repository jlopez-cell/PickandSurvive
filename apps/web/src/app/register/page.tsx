'use client';

import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function RegisterContent() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', alias: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get('redirect') || '';

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, alias: form.alias }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(message || 'Error al registrarse');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-[#06090f] p-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full max-w-sm">
          <div className="bg-[#0c1220] border border-white/[0.07] rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-5">
              <span className="text-xl text-amber-400 font-bold">✓</span>
            </div>
            <h2 className="text-xl font-bold text-white/85 mb-2">¡Registro completado!</h2>
            <p className="text-sm text-white/35 mb-6 leading-relaxed">
              Revisá tu email para verificar tu cuenta antes de iniciar sesión.
            </p>
            <Link
              href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
              className="block w-full bg-amber-500 text-black font-bold rounded-2xl py-3 text-sm text-center active:scale-[0.98] transition-transform"
            >
              Ir al login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#06090f] p-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white/85">Pick & Survive</h1>
          <p className="text-sm text-white/35 mt-1">Crear cuenta nueva</p>
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
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                placeholder="tu@email.com"
                className="bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-amber-500/30 focus:bg-white/[0.07] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="alias" className="text-xs font-medium text-white/35 uppercase tracking-wider">
                Alias
              </label>
              <input
                id="alias"
                type="text"
                value={form.alias}
                onChange={e => update('alias', e.target.value)}
                required
                minLength={3}
                maxLength={20}
                placeholder="mi_alias"
                className="bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-amber-500/30 focus:bg-white/[0.07] transition-colors"
              />
              <p className="text-[11px] text-white/25">3–20 caracteres · letras, números y guion bajo</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-white/35 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-amber-500/30 focus:bg-white/[0.07] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-xs font-medium text-white/35 uppercase tracking-wider">
                Confirmar contraseña
              </label>
              <input
                id="confirm"
                type="password"
                value={form.confirm}
                onChange={e => update('confirm', e.target.value)}
                required
                placeholder="Repetí la contraseña"
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
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/35">
            ¿Ya tenés cuenta?{' '}
            <Link
              href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] flex items-center justify-center bg-[#06090f]">
          <div className="w-6 h-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
        </main>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
