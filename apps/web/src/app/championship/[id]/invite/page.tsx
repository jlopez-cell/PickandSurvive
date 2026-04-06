'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

type JoinRequest = {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  user: { id: string; alias: string; email: string };
};

export default function InvitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = useCallback(() => {
    setLoadingRequests(true);
    fetch(`/api/championships/${id}/join-requests?status=PENDING`)
      .then((r) => r.json())
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoadingRequests(false));
  }, [id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    // Asegura que siempre haya un enlace/código visible al abrir la pantalla.
    void generateLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const generateLink = async () => {
    const res = await fetch(`/api/championships/${id}/invite-link`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(data.url);
      setInviteToken(data.token);
      setCopied(false);
      setCopiedToken(false);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    setCopyError('');
    try {
      // Modern API (puede fallar en iOS/HTTP/no permisos)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        throw new Error('Clipboard API no disponible');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      // Fallback para navegadores móviles antiguos
      try {
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!ok) throw new Error('execCommand copy failed');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopyError('No se pudo copiar automáticamente. Mantén pulsado el enlace y copia manualmente.');
      }
    }
  };

  const copyToken = async () => {
    if (!inviteToken) return;
    setCopyError('');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteToken);
      } else {
        throw new Error('Clipboard API no disponible');
      }
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
      return;
    } catch {
      setCopyError('No se pudo copiar el código automáticamente. Cópialo manualmente.');
    }
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    setEmailSending(true);
    setEmailMsg('');
    const res = await fetch(`/api/championships/${id}/invite-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput }),
    });
    const data = await res.json();
    const resendId = data?.resendId ?? '—';
    const resendStatus = data?.resendStatus ?? '—';
    const resendRaw = (() => {
      try {
        if (!data?.resendRaw) return '—';
        const s = JSON.stringify(data.resendRaw);
        return s.length > 300 ? `${s.slice(0, 300)}...` : s;
      } catch {
        return '—';
      }
    })();

    const msg = data?.message
      ? `${data.message} | resendId: ${resendId} | resendStatus: ${resendStatus} | resendRaw: ${resendRaw}`
      : res.ok
        ? `Invitación enviada | resendId: ${resendId} | resendStatus: ${resendStatus} | resendRaw: ${resendRaw}`
        : 'Error al enviar el email';

    setEmailMsg(msg);
    if (res.ok) setEmailInput('');
    setEmailSending(false);
  };

  const handleDecision = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessing(requestId);
    await fetch(`/api/championships/${id}/join-requests/${requestId}/${action}`, { method: 'POST' });
    fetchRequests();
    setProcessing(null);
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 pb-24">
      <div className="max-w-3xl mx-auto pb-2">
        <Button variant="ghost" size="sm" className="-ml-2 mb-6 text-muted-foreground" onClick={() => router.back()}>
          ← Volver
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6 sm:mb-8">Invitaciones</h1>

        {/* Enlace de invitación */}
        <Card className="mb-5 sm:mb-6">
          <CardHeader>
            <CardTitle className="text-base">Enlace de invitación</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {inviteUrl ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-background border border-border rounded-md px-3 py-2">
                  <span className="text-xs sm:text-sm text-muted-foreground flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {inviteUrl}
                  </span>
                  <Button size="sm" className="w-full sm:w-auto" onClick={copyLink}>
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </Button>
                </div>

                {inviteToken && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-background border border-border rounded-md px-3 py-2">
                    <span className="text-xs sm:text-sm text-muted-foreground flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      Código: {inviteToken}
                    </span>
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={copyToken}>
                      {copiedToken ? '¡Copiado!' : 'Copiar código'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Button size="sm" className="w-full sm:w-fit" onClick={generateLink}>Generar enlace</Button>
            )}
            {inviteUrl && (
              <Button size="sm" variant="outline" className="w-full sm:w-fit" onClick={generateLink}>
                Generar nuevo enlace
              </Button>
            )}
            {copyError && <p className="text-xs sm:text-sm text-red-400 break-words">{copyError}</p>}
          </CardContent>
        </Card>

        {/* Invitar por email */}
        <Card className="mb-5 sm:mb-6">
          <CardHeader>
            <CardTitle className="text-base">Invitar por email</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form onSubmit={sendEmail} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@ejemplo.com"
                className="flex-1"
              />
              <Button type="submit" disabled={emailSending} className="w-full sm:w-auto">
                {emailSending ? 'Enviando...' : 'Enviar'}
              </Button>
            </form>
            {emailMsg && <p className="text-xs sm:text-sm text-green-400 break-words">{emailMsg}</p>}
          </CardContent>
        </Card>

        {/* Solicitudes pendientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitudes pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <p className="text-muted-foreground text-sm">Cargando...</p>
            ) : requests.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay solicitudes pendientes.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {requests.map((req) => (
                  <div key={req.id} className="bg-background border border-border rounded-lg p-3 sm:px-4 sm:py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">@{req.user.alias}</div>
                        <div className="text-muted-foreground text-xs break-all">{req.user.email}</div>
                        <div className="text-muted-foreground/60 text-xs mt-1">
                          vía {req.source === 'LINK' ? 'enlace' : 'email'} · {new Date(req.createdAt).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="success"
                          className="w-full"
                          onClick={() => handleDecision(req.id, 'approve')}
                          disabled={processing === req.id}
                        >
                          {processing === req.id ? '...' : 'Aprobar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={() => handleDecision(req.id, 'reject')}
                          disabled={processing === req.id}
                        >
                          {processing === req.id ? '...' : 'Rechazar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <MobileBottomNav />
    </main>
  );
}
