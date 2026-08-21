'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronLeft, X } from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-background" />}>
      <NotificationsContent />
    </Suspense>
  );
}

type NotificationPayload = Record<string, unknown>;

type Notification = {
  id: string;
  type: string;
  payload: NotificationPayload;
  read: boolean;
  createdAt: string;
};

function notificationMessage(type: string, payload: NotificationPayload): string {
  switch (type) {
    case 'PICK_REMINDER':
      return `⏰ Tienes ${payload.minutesLeft ?? '?'} minutos para hacer tu pick — Jornada ${payload.matchdayNumber ?? '?'}`;
    case 'JOIN_APPROVED':
      return '✅ Tu solicitud fue aprobada. ¡Ya eres parte del campeonato!';
    case 'JOIN_REJECTED':
      return '❌ Tu solicitud para unirte al campeonato fue rechazada.';
    case 'NEW_JOIN_REQUEST':
      return '👋 Nuevo participante quiere unirse a tu campeonato. Revisa las solicitudes.';
    case 'EDITION_FINISHED':
      return `🏆 La edición "${payload.editionName ?? 'desconocida'}" ha finalizado.`;
    case 'INVITATION':
      return `📩 Tienes una invitación para unirte a "${payload.championshipName ?? 'un campeonato'}". Pulsá para aceptar.`;
    default:
      return 'Nueva notificación.';
  }
}

function NotificationsContent() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => setNotifications(Array.isArray(data?.notifications) ? data.notifications : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string, n?: Notification) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
    setNotifications((prev) => prev.map((x) => x.id === id ? { ...x, read: true } : x));
    if (n?.type === 'INVITATION' && n.payload.inviteToken) {
      router.push(`/join/${n.payload.inviteToken}`);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
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
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="pt-[env(safe-area-inset-top,0px)] px-4">
        <div className="h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notificaciones</p>
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
            <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-semibold">Sin notificaciones</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="px-4 py-2 space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-4 rounded-2xl border transition-all ${
                  n.read
                    ? 'bg-secondary/50 border-border opacity-60'
                    : 'bg-secondary border-border'
                }`}
              >
                <button
                  onClick={() => markRead(n.id, n)}
                  className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  aria-label="Marcar como leída"
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-muted-foreground/30' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{notificationMessage(n.type, n.payload)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors mt-0.5"
                  aria-label="Borrar notificación"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
