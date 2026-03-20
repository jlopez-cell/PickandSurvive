'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Edition = {
  id: string;
  status: string;
  startMatchday: number;
  endMatchday: number | null;
  potAmountCents: number;
  createdAt: string;
};

type Championship = {
  id: string;
  name: string;
  mode: 'TOURNAMENT' | 'LEAGUE';
  adminId: string;
  pickResetAtMidseason: boolean;
  footballLeague: { id: string; name: string; country: string };
  editions: Edition[];
  admin: { id: string; alias: string };
};

const MODE_LABEL: Record<string, string> = { TOURNAMENT: 'Torneo', LEAGUE: 'Liga' };
const EDITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', OPEN: 'Abierta', ACTIVE: 'Activa', FINISHED: 'Finalizada', CANCELLED: 'Cancelada',
};
type BadgeVariant = 'muted' | 'default' | 'success' | 'warning' | 'destructive';
const STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: 'muted', OPEN: 'default', ACTIVE: 'success', FINISHED: 'muted', CANCELLED: 'destructive',
};

export default function ChampionshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const fetchChampionship = () => {
    fetch(`/api/championships/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('No encontrado');
        return r.json();
      })
      .then(setChampionship)
      .catch((e) => setError(e.message))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (!authLoading) fetchChampionship();
  }, [id, authLoading]);

  const handlePublish = async (editionId: string) => {
    setPublishing(editionId);
    const res = await fetch(`/api/championships/${id}/editions/${editionId}/publish`, { method: 'PATCH' });
    if (res.ok) fetchChampionship();
    setPublishing(null);
  };

  const handleActivate = async (editionId: string) => {
    setActivating(editionId);
    const res = await fetch(`/api/championships/${id}/editions/${editionId}/activate`, { method: 'PATCH' });
    if (res.ok) fetchChampionship();
    setActivating(null);
  };

  if (authLoading || fetching) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  if (error || !championship) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-destructive mb-4">{error || 'Campeonato no encontrado'}</p>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Volver al dashboard</Button>
      </main>
    );
  }

  const isAdmin = championship.adminId === user?.id;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground -ml-2" onClick={() => router.push('/dashboard')}>
          ← Volver
        </Button>

        {/* Header */}
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">{championship.name}</h1>
            <p className="text-sm text-muted-foreground">
              {championship.footballLeague.name} · {championship.footballLeague.country} · {MODE_LABEL[championship.mode]}
              {championship.pickResetAtMidseason && ' · Reset media vuelta'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">Admin: @{championship.admin.alias}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => router.push(`/championship/${id}/invite`)}>
                Invitaciones
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/championship/${id}/edition/new`)}>
                + Nueva edición
              </Button>
            </div>
          )}
        </div>

        {/* Editions */}
        <h2 className="text-base font-semibold text-foreground mb-4">Ediciones</h2>

        {championship.editions.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground mb-4">No hay ediciones todavía.</p>
            {isAdmin && (
              <Button size="sm" onClick={() => router.push(`/championship/${id}/edition/new`)}>
                Crear primera edición
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {championship.editions.map((edition) => (
              <Card key={edition.id}>
                <CardContent className="py-4 flex justify-between items-center gap-4">
                  <div>
                    <span className="font-semibold text-foreground text-sm">
                      Jornada {edition.startMatchday}
                      {edition.endMatchday ? ` → ${edition.endMatchday}` : ''}
                    </span>
                    {edition.potAmountCents > 0 && (
                      <span className="text-muted-foreground text-xs ml-2">
                        · Bote: {(edition.potAmountCents / 100).toFixed(2)} €/persona
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={STATUS_BADGE[edition.status] ?? 'muted'}>
                      {EDITION_STATUS_LABEL[edition.status]}
                    </Badge>
                    {isAdmin && edition.status === 'DRAFT' && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handlePublish(edition.id)}
                        disabled={publishing === edition.id}
                      >
                        {publishing === edition.id ? 'Publicando...' : 'Publicar'}
                      </Button>
                    )}
                    {isAdmin && edition.status === 'OPEN' && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleActivate(edition.id)}
                        disabled={activating === edition.id}
                      >
                        {activating === edition.id ? 'Activando...' : 'Activar'}
                      </Button>
                    )}
                    {(edition.status === 'ACTIVE' || edition.status === 'OPEN') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/edition/${edition.id}`)}
                      >
                        Ver →
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
