import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pick & Survive',
    short_name: 'Pick&Survive',
    description: 'El juego de fútbol definitivo',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#06090f',
    theme_color: '#f59e0b',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
