import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pick & Survive',
    short_name: 'PickSurvive',
    description: 'Football pick & survive game',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait',
    icons: [
      {
        src: '/dashboard-hero.jpeg',
        sizes: '1024x1024',
        type: 'image/jpeg',
      },
    ],
  };
}
