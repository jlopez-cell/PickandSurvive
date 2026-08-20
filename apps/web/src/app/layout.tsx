import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { VersionGuard } from '@/components/VersionGuard';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'Pick & Survive',
  title: 'Pick & Survive — El juego de fútbol definitivo',
  description: 'Elige un equipo ganador cada jornada. Si tu equipo pierde, quedas eliminado. ¿Hasta cuándo sobrevivirás?',
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pick & Survive',
  },
  other: { 'mobile-web-app-capable': 'yes' },
  openGraph: {
    title: 'Pick & Survive',
    description: 'El juego de fútbol definitivo. Elige, sobrevive, gana.',
    images: [{ url: '/logo.png', width: 1080, height: 1080, alt: 'Pick & Survive' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pick & Survive',
    description: 'El juego de fútbol definitivo.',
    images: ['/logo.png'],
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f59e0b',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('ps-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');})();`,
          }}
        />
      </head>
      <body>
        <VersionGuard />
        {children}
      </body>
    </html>
  );
}
