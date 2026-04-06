'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { MobileTopHeader } from '@/components/mobile/MobileTopHeader';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Cargando perfil...
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url('/dashboard-hero.jpeg')` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/65 to-slate-950/95" />

      <MobileTopHeader />

      <main className="relative z-10 p-4 sm:p-6 pb-24">
        <div className="max-w-xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-6 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => router.push('/dashboard')}
          >
            ← Volver
          </Button>

          <Card className="rounded-2xl border-white/10 bg-slate-950/35 text-white">
            <CardHeader>
              <CardTitle className="text-slate-50">Mi Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-300">Alias</p>
                <p className="font-semibold text-slate-50">@{user.alias}</p>
              </div>
              <div>
                <p className="text-xs text-slate-300">Email</p>
                <p className="font-semibold text-slate-50 break-words">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-300">Rol</p>
                <p className="font-semibold text-slate-50">{user.role}</p>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={logout}
                >
                  Cerrar sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
