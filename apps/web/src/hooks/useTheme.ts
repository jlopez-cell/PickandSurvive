'use client';

import { useCallback, useEffect, useState } from 'react';

export function useTheme() {
  const [isLight, setIsLight] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ps-theme') === 'light';
  });

  useEffect(() => {
    const theme = isLight ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ps-theme', theme);
  }, [isLight]);

  const toggle = useCallback(() => setIsLight((prev) => !prev), []);

  return { isLight, toggle };
}
