'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function NewEditionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({ startMatchday: '', endMatchday: '', potAmountCents: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startMatchday) {
      setError('La jornada de inicio es obligatoria.');
      return;
    }
    setLoading(true);
    setError('');

    const body: Record<string, number> = {
      startMatchday: parseInt(form.startMatchday, 10),
    };
    if (form.endMatchday) body.endMatchday = parseInt(form.endMatchday, 10);
    if (form.potAmountCents) body.potAmountCents = Math.round(parseFloat(form.potAmountCents) * 100);

    try {
      const res = await fetch(`/api/championships/${id}/editions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(msg || 'Error al crear la edición');
        return;
      }
      router.push(`/championship/${id}`);
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-start justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 w-fit text-muted-foreground" onClick={() => router.back()}>
            ← Volver
          </Button>
          <CardTitle>Nueva edición</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start">Jornada de inicio *</Label>
              <Input
                id="start"
                type="number"
                min={1}
                value={form.startMatchday}
                onChange={(e) => setForm({ ...form, startMatchday: e.target.value })}
                placeholder="Ej: 10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end">
                Jornada de fin{' '}
                <span className="text-muted-foreground/60 font-normal">(solo modo Liga)</span>
              </Label>
              <Input
                id="end"
                type="number"
                min={1}
                value={form.endMatchday}
                onChange={(e) => setForm({ ...form, endMatchday: e.target.value })}
                placeholder="Ej: 38"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pot">
                Bote por participante (€){' '}
                <span className="text-muted-foreground/60 font-normal">(opcional)</span>
              </Label>
              <Input
                id="pot"
                type="number"
                min={0}
                step={0.01}
                value={form.potAmountCents}
                onChange={(e) => setForm({ ...form, potAmountCents: e.target.value })}
                placeholder="Ej: 5.00"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creando...' : 'Crear edición'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
