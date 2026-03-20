'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Únete al campeonato</CardTitle>
            <CardDescription>
              Debes iniciar sesión o registrarte para poder unirte a este campeonato.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button className="flex-1" onClick={() => router.push(`/login?redirect=/join/${token}`)}>
              Iniciar sesión
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => router.push(`/register?redirect=/join/${token}`)}>
              Registrarse
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        {status === 'success' ? (
          <>
            <CardHeader>
              <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-400 text-2xl flex items-center justify-center mx-auto mb-2">
                ✓
              </div>
              <CardTitle>Solicitud enviada</CardTitle>
              <CardDescription>{message}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                El administrador del campeonato deberá aprobar tu solicitud. Te notificaremos por email.
              </p>
              <Button className="w-full" onClick={() => router.push('/dashboard')}>
                Ir al dashboard
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Únete al campeonato</CardTitle>
              <CardDescription>
                Hola, <strong className="text-foreground">@{user.alias}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Al confirmar, se enviará una solicitud al administrador del campeonato. Tu participación
                quedará pendiente hasta que sea aprobada.
              </p>
              {status === 'error' && (
                <Alert variant="destructive">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={handleJoin}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Enviando...' : 'Solicitar unirme'}
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => router.push('/dashboard')}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
