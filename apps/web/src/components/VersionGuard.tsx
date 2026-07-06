'use client';

import { useEffect } from 'react';

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
          const url = new URL(window.location.href);
          // Anti-loop: if we already tried reloading with this exact build, give up.
          // Happens when the browser stubbornly serves old JS from cache (iOS PWA, etc.)
          if (url.searchParams.get('_v') === buildTs) return;
          url.searchParams.set('_v', buildTs);
          window.location.replace(url.toString());
          return;
        }

        // Bundle is up to date — clean up any stale _v param left in the URL
        const url = new URL(window.location.href);
        if (url.searchParams.has('_v')) {
          url.searchParams.delete('_v');
          history.replaceState(null, '', url.toString());
        }
      } catch {}
    };

    const t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, []);

  return null;
}
