'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          {status === 'loading' && <CardTitle className="text-2xl">Verificando...</CardTitle>}
          {status === 'success' && <CardTitle className="text-2xl text-green-400">¡Email verificado!</CardTitle>}
          {status === 'error' && <CardTitle className="text-2xl text-destructive">Error de verificación</CardTitle>}
          {status !== 'loading' && <CardDescription>{message}</CardDescription>}
          {status === 'loading' && <CardDescription>Por favor espera un momento.</CardDescription>}
        </CardHeader>
        {status !== 'loading' && (
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">{status === 'success' ? 'Ir al login' : 'Volver al login'}</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Cargando...</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
