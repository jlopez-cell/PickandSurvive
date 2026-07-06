'use client';

import { useEffect } from 'react';

const BUNDLE_TS = process.env.NEXT_PUBLIC_BUILD_TS ?? 'unknown';

export function VersionGuard() {
  useEffect(() => {
    if (BUNDLE_TS === 'unknown') return;

    // Anti-loop key scoped to this specific bundle version.
    // sessionStorage survives window.location.reload() in the same tab,
    // so if the reload doesn't serve a newer bundle we won't loop.
    const RELOAD_KEY = `vg_reload_${BUNDLE_TS}`;

    if (sessionStorage.getItem(RELOAD_KEY)) return;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildTs } = await res.json();
        if (!buildTs || buildTs === 'unknown') return;

        if (buildTs !== BUNDLE_TS) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          // Reload WITHOUT touching the URL — avoids desynchronising the
          // Next.js router, which breaks navigation after history.replaceState.
          window.location.reload();
        }
      } catch {}
    };

    const t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, []);

  return null;
}
