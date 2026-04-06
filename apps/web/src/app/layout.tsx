import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'Pick & Survive',
  title: 'Pick & Survive',
  description: 'Football pick & survive game',
  manifest: '/manifest.webmanifest',
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pick & Survive',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

/** Mejor integración con la barra de estado en móvil (menos “modo web” brusco al cambiar de ruta). */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
