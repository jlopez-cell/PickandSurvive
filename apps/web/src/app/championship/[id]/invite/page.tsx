'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  const [copied, setCopied] = useState(false);
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

  const generateLink = async () => {
    const res = await fetch(`/api/championships/${id}/invite-link`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(data.url);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" className="-ml-2 mb-6 text-muted-foreground" onClick={() => router.back()}>
          ← Volver
        </Button>
        <h1 className="text-2xl font-bold text-foreground mb-8">Gestión de invitaciones</h1>

        {/* Enlace de invitación */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Enlace de invitación</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {inviteUrl ? (
              <div className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2">
                <span className="text-sm text-muted-foreground flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {inviteUrl}
                </span>
                <Button size="sm" onClick={copyLink}>
                  {copied ? '¡Copiado!' : 'Copiar'}
                </Button>
              </div>
            ) : (
              <Button size="sm" className="w-fit" onClick={generateLink}>Generar enlace</Button>
            )}
            {inviteUrl && (
              <Button size="sm" variant="outline" className="w-fit" onClick={generateLink}>
                Generar nuevo enlace
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Invitar por email */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Invitar por email</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form onSubmit={sendEmail} className="flex gap-2">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@ejemplo.com"
                className="flex-1"
              />
              <Button type="submit" disabled={emailSending}>
                {emailSending ? 'Enviando...' : 'Enviar'}
              </Button>
            </form>
            {emailMsg && <p className="text-sm text-green-400">{emailMsg}</p>}
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
                  <div key={req.id} className="flex justify-between items-center bg-background border border-border rounded-lg px-4 py-3 gap-4">
                    <div>
                      <span className="font-semibold text-foreground text-sm">@{req.user.alias}</span>
                      <span className="text-muted-foreground text-xs ml-2">{req.user.email}</span>
                      <span className="text-muted-foreground/60 text-xs ml-2">
                        · vía {req.source === 'LINK' ? 'enlace' : 'email'}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleDecision(req.id, 'approve')}
                        disabled={processing === req.id}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDecision(req.id, 'reject')}
                        disabled={processing === req.id}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
