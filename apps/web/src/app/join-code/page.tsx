'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

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

    // Si no hay sesión, redirigimos a login y, tras autenticarse,
    // volvemos a esta misma URL para auto-enviar el join.
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

  // Si llegamos con ?code=... y ya hay sesión, pedimos el join automáticamente.
  useEffect(() => {
    const trimmed = codeFromQuery.trim();
    if (!trimmed) return;
    if (!user) return;
    if (submitting) return;
    // Si ya se ha completado, no reenviar.
    if (status === 'success') return;
    void submitJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromQuery, user]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Entrar con código</CardTitle>
          <CardDescription>
            Pega el código del campeonato. Tu solicitud se enviará al admin para su aprobación.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="join-code">Código</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: 3f2c1e9c-..."
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="text"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitJoin();
              }}
            />
          </div>

          {status === 'success' && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Button disabled={submitting} onClick={() => void submitJoin()}>
            {submitting ? 'Enviando...' : 'Solicitar unirme'}
          </Button>

          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Volver al dashboard
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function JoinCodePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
          <p className="text-muted-foreground">Cargando...</p>
        </main>
      }
    >
      <JoinCodeContent />
    </Suspense>
  );
}

