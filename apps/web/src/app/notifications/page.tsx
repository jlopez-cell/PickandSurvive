'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronLeft } from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-[#06090f]" />}>
      <NotificationsContent />
    </Suspense>
  );
}

type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

function NotificationsContent() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#06090f]">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top,0px)] px-4">
        <div className="h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-white/60" />
          </button>
          <p className="text-xs font-bold uppercase tracking-wider text-white/35">Notificaciones</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/[0.08] flex items-center justify-center">
              <Bell className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-sm text-white/30 font-semibold">Sin notificaciones</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="px-4 py-2 space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-left px-4 py-4 rounded-2xl border transition-all active:scale-[0.98] ${
                  n.read
                    ? 'bg-white/[0.03] border-white/[0.06] opacity-60'
                    : 'bg-white/[0.06] border-white/[0.12]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                  {n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-white/10 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 leading-snug">{n.message}</p>
                    <p className="text-[11px] text-white/30 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
