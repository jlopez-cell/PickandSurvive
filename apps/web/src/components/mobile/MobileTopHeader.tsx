'use client';

import { useRouter } from 'next/navigation';
import { Bell, ChevronLeft, Menu, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileTopHeaderProps {
  title?: string;
  onBack?: () => void;
}

export function MobileTopHeader({ title, onBack }: MobileTopHeaderProps = {}) {
  const router = useRouter();

  return (
    <header className="relative z-20 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] flex min-h-[3.25rem] items-center justify-between border-b border-white/[0.07] bg-[#0c1220] md:hidden">
      {title !== undefined || onBack !== undefined ? (
        <>
          <button
            type="button"
            onClick={onBack ?? (() => router.back())}
            className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.07] flex items-center justify-center text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors shrink-0"
            aria-label="Volver"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {title && (
            <span className="absolute left-1/2 -translate-x-1/2 font-bold text-white/85 text-base truncate max-w-[60%]">
              {title}
            </span>
          )}
          <div className="w-9 shrink-0" />
        </>
      ) : (
        <>
          <button
            type="button"
            className="flex items-center gap-3"
            onClick={() => router.push('/dashboard')}
            aria-label="Ir a inicio"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-400" />
            </div>
            <div className="font-bold tracking-wide text-white/85">Pick &amp; Survive</div>
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/60 hover:text-white/90 hover:bg-white/10"
              onClick={() => router.push('/dashboard?tab=leagues')}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/60 hover:text-white/90 hover:bg-white/10"
              onClick={() => router.push('/dashboard?tab=notifications')}
              aria-label="Abrir notificaciones"
            >
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </header>
  );
}
