'use client';

import { Bell, Home, Trophy, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

type Tab = 'home' | 'championships' | 'notifications' | 'profile';

export function MobileBottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();

  const active: Tab = (() => {
    if (pathname.startsWith('/profile')) return 'profile';
    if (pathname.startsWith('/notifications')) return 'notifications';
    if (pathname.startsWith('/championship')) return 'championships';
    return 'home';
  })();

  const TABS: { key: Tab; label: string; icon: React.ReactNode; route: string }[] = [
    { key: 'home',          label: 'Inicio',       icon: <Home className="w-5 h-5" />,     route: '/dashboard' },
    { key: 'championships', label: 'Ligas',         icon: <Trophy className="w-5 h-5" />,   route: '/championship/new' },
    { key: 'notifications', label: 'Alertas',       icon: <Bell className="w-5 h-5" />,     route: '/notifications' },
    { key: 'profile',       label: 'Perfil',        icon: <UserRound className="w-5 h-5" />, route: '/profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-white/[0.06] bg-[#06090f]/95 backdrop-blur-xl"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
    >
      <div className="grid grid-cols-4 max-w-xl mx-auto pt-1.5">
        {TABS.map(({ key, label, icon, route }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => router.push(route)}
              className="relative flex flex-col items-center gap-1 py-1.5 px-1 transition-all"
            >
              {key === 'notifications' && unreadCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-10px)] min-w-[14px] h-3.5 px-1 rounded-full bg-red-500 text-[9px] leading-3.5 text-white text-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className={`transition-colors ${isActive ? 'text-amber-400' : 'text-white/35'}`}>
                {icon}
              </span>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-amber-400' : 'text-white/30'}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

