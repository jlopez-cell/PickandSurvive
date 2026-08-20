'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    <main className="min-h-screen bg-[#06090f] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)] pt-[env(safe-area-inset-top,0px)] sm:px-6">
      <div className="max-w-3xl mx-auto pt-6 pb-2">
        <button
          type="button"
          className="mb-6 -ml-2 flex items-center gap-1 text-sm text-white/35 hover:text-white/60 transition-colors"
          onClick={() => router.back()}
        >
          ← Volver
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-white/85 mb-6 sm:mb-8">Invitaciones</h1>

        {/* Enlace de invitación */}
        <div className="bg-[#0c1220] border border-white/[0.07] rounded-2xl p-5 mb-5 sm:mb-6">
          <h2 className="text-sm font-bold text-white/85 mb-4">Enlace de invitación</h2>
          <div className="flex flex-col gap-3">
            {inviteUrl ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2">
                  <span className="text-xs sm:text-sm text-white/35 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {inviteUrl}
                  </span>
                  <button
                    className={`w-full sm:w-auto rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
                      copied
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25'
                        : 'bg-amber-500 text-black'
                    }`}
                    onClick={copyLink}
                  >
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>

                {inviteToken && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2">
                    <span className="text-xs sm:text-sm text-white/35 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      Código: {inviteToken}
                    </span>
                    <button
                      className={`w-full sm:w-auto bg-white/5 border border-white/[0.08] rounded-xl px-3 py-1.5 text-sm transition-colors ${
                        copiedToken ? 'text-emerald-300' : 'text-white/60'
                      }`}
                      onClick={copyToken}
                    >
                      {copiedToken ? '¡Copiado!' : 'Copiar código'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                className="w-full sm:w-fit bg-amber-500 text-black font-bold rounded-xl px-4 py-2 text-sm"
                onClick={generateLink}
              >
                Generar enlace
              </button>
            )}
            {inviteUrl && (
              <button
                className="w-full sm:w-fit bg-white/5 border border-white/[0.08] text-white/60 rounded-xl px-4 py-2 text-sm"
                onClick={generateLink}
              >
                Generar nuevo enlace
              </button>
            )}
            {copyError && (
              <p className="text-xs sm:text-sm text-red-300 break-words">{copyError}</p>
            )}
          </div>
        </div>

        {/* Invitar por email */}
        <div className="bg-[#0c1220] border border-white/[0.07] rounded-2xl p-5 mb-5 sm:mb-6">
          <h2 className="text-sm font-bold text-white/85 mb-4">Invitar por email</h2>
          <div className="flex flex-col gap-3">
            <form onSubmit={sendEmail} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@ejemplo.com"
                className="bg-white/5 border border-white/[0.08] text-white/80 rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none flex-1 placeholder:text-white/20"
              />
              <button
                type="submit"
                disabled={emailSending}
                className="w-full sm:w-auto bg-amber-500 text-black font-bold rounded-xl px-4 py-3 text-sm disabled:opacity-50"
              >
                {emailSending ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
            {emailMsg && (
              <p className="text-xs sm:text-sm text-emerald-300 break-words">{emailMsg}</p>
            )}
          </div>
        </div>

        {/* Solicitudes pendientes */}
        <div className="bg-[#0c1220] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white/85 mb-4">Solicitudes pendientes</h2>
          {loadingRequests ? (
            <p className="text-white/35 text-sm">Cargando...</p>
          ) : requests.length === 0 ? (
            <p className="text-white/35 text-sm">No hay solicitudes pendientes.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <div key={req.id} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 sm:px-4 sm:py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-white/85 text-sm truncate">@{req.user.alias}</div>
                      <div className="text-white/35 text-xs break-all">{req.user.email}</div>
                      <div className="text-white/25 text-xs mt-1">
                        vía {req.source === 'LINK' ? 'enlace' : 'email'} ·{' '}
                        {new Date(req.createdAt).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:gap-2 shrink-0">
                      <button
                        className="w-full bg-emerald-500 text-white font-bold rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={() => handleDecision(req.id, 'approve')}
                        disabled={processing === req.id}
                      >
                        {processing === req.id ? '...' : 'Aprobar'}
                      </button>
                      <button
                        className="w-full bg-red-500/90 text-white font-bold rounded-xl px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={() => handleDecision(req.id, 'reject')}
                        disabled={processing === req.id}
                      >
                        {processing === req.id ? '...' : 'Rechazar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <MobileBottomNav />
    </main>
  );
}
