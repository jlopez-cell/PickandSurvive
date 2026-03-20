'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando perfil...</p>
      </main>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        <Button variant="ghost" size="sm" className="-ml-2 mb-6" onClick={() => router.push('/dashboard')}>
          ← Volver
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Mi Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Alias</p>
              <p className="font-semibold">@{user.alias}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-semibold">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rol</p>
              <p className="font-semibold">{user.role}</p>
            </div>

            <div className="pt-2">
              <Button variant="outline" onClick={logout}>
                Cerrar sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
