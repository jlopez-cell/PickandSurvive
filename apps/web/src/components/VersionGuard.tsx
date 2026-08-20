'use client';

import { useEffect, useRef, useState } from 'react';

const BUNDLE_TS = process.env.NEXT_PUBLIC_BUILD_TS ?? 'unknown';
const RETRY_KEY = 'vg_retry_count';
const MAX_AUTO_RETRIES = 2;

function getRetryCount(): number {
  try { return parseInt(sessionStorage.getItem(RETRY_KEY) ?? '0', 10); } catch { return 0; }
}
function incRetryCount() {
  try { sessionStorage.setItem(RETRY_KEY, String(getRetryCount() + 1)); } catch {}
}
function clearRetryCount() {
  try { sessionStorage.removeItem(RETRY_KEY); } catch {}
}

export function VersionGuard() {
  const [state, setState] = useState<'idle' | 'updating' | 'stale'>('idle');
  const checking = useRef(false);

  useEffect(() => {
    if (BUNDLE_TS === 'unknown') return;

    // On mount: if we have the _v param, a reload just happened.
    // Check if it actually served the new bundle.
    const url = new URL(window.location.href);
    if (url.searchParams.has('_v')) {
      const targetTs = url.searchParams.get('_v');
      if (targetTs === BUNDLE_TS) {
        // Successful update — clear retry counter
        clearRetryCount();
      }
      // Always strip the param from the visible URL
      url.searchParams.delete('_v');
      window.history.replaceState({}, '', url.toString());
    }

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildTs } = await res.json();
        if (!buildTs || buildTs === 'unknown' || buildTs === BUNDLE_TS) return;

        // New version detected
        const retries = getRetryCount();
        if (retries >= MAX_AUTO_RETRIES) {
          setState('stale'); // Too many failed auto-reloads → show manual banner
          return;
        }

        setState('updating');
        incRetryCount();

        // Hard-reload: add _v param so the next mount knows which version we targeted.
        // This bypasses browser disk cache for the HTML (which Next.js serves with no-store).
        setTimeout(() => {
          const dest = new URL(window.location.href);
          dest.searchParams.set('_v', buildTs);
          window.location.replace(dest.toString());
        }, 1_200);
      } catch {
        // Ignore network errors (offline, etc.)
      } finally {
        checking.current = false;
      }
    };

    // Check immediately on mount
    check();

    // Re-check when user returns to the tab (crucial for mobile)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Periodic check every 45s for long-lived sessions
    const interval = setInterval(check, 45_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, []);

  if (state === 'idle') return null;

  const bannerStyle: React.CSSProperties = {
    paddingTop: 'max(0.625rem, env(safe-area-inset-top))',
  };

  if (state === 'stale') {
    return (
      <button
        onClick={async () => {
          clearRetryCount();
          try {
            const res = await fetch('/api/version', { cache: 'no-store' });
            const { buildTs } = await res.json();
            const url = new URL(window.location.href);
            url.searchParams.set('_v', buildTs);
            window.location.replace(url.toString());
          } catch {
            window.location.reload();
          }
        }}
        style={bannerStyle}
        className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-center text-sm font-semibold pb-2.5 px-4 w-full cursor-pointer"
      >
        🔄 Nueva versión disponible — Toca para actualizar
      </button>
    );
  }

  return (
    <div
      style={bannerStyle}
      className="fixed top-0 inset-x-0 z-[100] bg-orange-500 text-white text-center text-sm font-semibold pb-2.5 px-4"
    >
      ↻ Actualizando a la nueva versión...
    </div>
  );
}
