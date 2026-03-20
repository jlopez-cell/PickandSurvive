'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type League = { id: string; name: string; country: string };

export default function NewChampionshipPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [form, setForm] = useState({
    name: '',
    footballLeagueId: '',
    mode: 'TOURNAMENT',
    pickResetAtMidseason: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/leagues')
      .then((r) => r.json())
      .then((data) => setLeagues(Array.isArray(data) ? data : []))
      .catch(() => setLeagues([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.footballLeagueId) {
      setError('Nombre y liga son obligatorios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/championships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(msg || 'Error al crear el campeonato');
        return;
      }
      router.push(`/championship/${data.id}`);
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-start justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-2 text-muted-foreground" onClick={() => router.back()}>
            ← Volver
          </Button>
          <CardTitle>Nuevo campeonato</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nombre del campeonato</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Liga de los Viernes"
                maxLength={80}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Liga de fútbol</Label>
              <Select
                value={form.footballLeagueId}
                onValueChange={(v) => setForm({ ...form, footballLeagueId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una liga..." />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.country})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Modo de juego</Label>
              <Select
                value={form.mode}
                onValueChange={(v) => setForm({ ...form, mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOURNAMENT">Torneo (supervivencia)</SelectItem>
                  <SelectItem value="LEAGUE">Liga (puntos)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id="midseason"
                checked={form.pickResetAtMidseason}
                onCheckedChange={(checked) => setForm({ ...form, pickResetAtMidseason: !!checked })}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="midseason" className="cursor-pointer text-foreground">
                  Reiniciar picks a media vuelta
                </Label>
                <p className="text-xs text-muted-foreground/60">
                  Permite volver a elegir equipos usados en la primera vuelta
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creando...' : 'Crear campeonato'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
