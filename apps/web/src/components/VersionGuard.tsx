'use client';

import { useEffect } from 'react';

// Baked into this bundle at build time
const BUNDLE_TS = process.env.NEXT_PUBLIC_BUILD_TS ?? 'unknown';

export function VersionGuard() {
  useEffect(() => {
    if (BUNDLE_TS === 'unknown') return;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildTs } = await res.json();
        if (!buildTs || buildTs === 'unknown') return;

        if (buildTs !== BUNDLE_TS) {
          // This bundle is stale — the server has a newer deploy.
          // Use location.href to force a full hard navigation (bypasses JS cache).
          window.location.href = window.location.href;
        }
      } catch {}
    };

    // Small delay so the page renders first
    const t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, []);

  return null;
}
