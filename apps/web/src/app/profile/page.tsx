'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { MobileTopHeader } from '@/components/mobile/MobileTopHeader';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#06090f]">
        <div className="w-6 h-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const initials = (user.alias || user.email || 'US').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-[#06090f] text-white">
      <MobileTopHeader />

      <main className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
        <div className="max-w-xl mx-auto">
          {/* Avatar e identidad */}
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <span className="text-2xl font-bold text-amber-400">{initials}</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white/85">@{user.alias}</p>
              <p className="text-sm text-white/35 mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Datos */}
          <div className="bg-[#0c1220] border border-white/[0.07] rounded-2xl overflow-hidden mb-3">
            <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
              <p className="text-xs font-medium text-white/35 uppercase tracking-wider">Alias</p>
              <p className="text-sm font-medium text-white/85">@{user.alias}</p>
            </div>
            <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between gap-4">
              <p className="text-xs font-medium text-white/35 uppercase tracking-wider shrink-0">Email</p>
              <p className="text-sm font-medium text-white/85 break-all text-right">{user.email}</p>
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <p className="text-xs font-medium text-white/35 uppercase tracking-wider">Rol</p>
              <p className="text-sm font-medium text-white/85">{user.role}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-2xl py-3.5 text-sm transition-colors active:scale-[0.98]"
          >
            Cerrar sesión
          </button>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
