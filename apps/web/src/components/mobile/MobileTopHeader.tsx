'use client';

import { useRouter } from 'next/navigation';
import { Bell, Menu, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MobileTopHeader() {
  const router = useRouter();

  return (
    <header className="relative z-20 h-16 px-4 flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-black/40 to-transparent md:hidden">
      <button
        type="button"
        className="flex items-center gap-3"
        onClick={() => router.push('/dashboard')}
        aria-label="Ir a inicio"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-b from-yellow-400/30 to-yellow-600/15 border border-yellow-300/30 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-yellow-200" />
        </div>
        <div className="font-extrabold tracking-wide text-white">Pick &amp; Survive</div>
      </button>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/90 hover:text-white hover:bg-white/10"
          onClick={() => router.push('/dashboard?tab=leagues')}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/85 hover:text-white hover:bg-white/10"
          onClick={() => router.push('/dashboard?tab=notifications')}
          aria-label="Abrir notificaciones"
        >
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
