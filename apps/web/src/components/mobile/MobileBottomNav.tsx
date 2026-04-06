'use client';

import { Bell, LayoutDashboard, UserRound, Users } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Tab = 'home' | 'leagues' | 'notifications' | 'profile';

export function MobileBottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = (searchParams.get('tab') || '').toLowerCase();

  const active: Tab = (() => {
    if (pathname.startsWith('/profile')) return 'profile';
    if (pathname.startsWith('/dashboard')) {
      if (tabParam === 'notifications') return 'notifications';
      if (tabParam === 'leagues') return 'leagues';
      return 'home';
    }
    // Championship/edition screens: keep "Mis ligas" highlighted
    if (pathname.startsWith('/championship') || pathname.startsWith('/edition')) return 'leagues';
    return 'home';
  })();

  const go = (tab: Tab) => {
    if (tab === 'profile') {
      router.push('/profile');
      return;
    }
    if (tab === 'home') {
      router.push('/dashboard?tab=home');
      return;
    }
    if (tab === 'leagues') {
      router.push('/dashboard?tab=leagues');
      return;
    }
    if (tab === 'notifications') {
      router.push('/dashboard?tab=notifications');
    }
  };

  const cls = (tab: Tab) =>
    `rounded-xl px-2 py-2 text-xs font-semibold flex flex-col items-center gap-1 ${
      active === tab ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-white/10 bg-slate-950/90 backdrop-blur px-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2">
      <div className="grid grid-cols-4 gap-2 max-w-xl mx-auto">
        <button className={cls('home')} onClick={() => go('home')}>
          <LayoutDashboard className="h-5 w-5" />
          Inicio
        </button>
        <button className={cls('leagues')} onClick={() => go('leagues')}>
          <Users className="h-5 w-5" />
          Mis ligas
        </button>
        <button className={`relative ${cls('notifications')}`} onClick={() => go('notifications')}>
          <Bell className="h-5 w-5" />
          Notifs
          {unreadCount > 0 && (
            <span className="absolute right-3 top-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button className={cls('profile')} onClick={() => go('profile')}>
          <UserRound className="h-5 w-5" />
          Perfil
        </button>
      </div>
    </nav>
  );
}

