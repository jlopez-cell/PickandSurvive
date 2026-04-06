import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_CANONICAL_ORIGIN = 'https://pickandsurvive.com';

function isIpHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Fuerza origen seguro/canónico para evitar "Not secure":
 * - HTTP -> HTTPS
 * - Host por IP/legacy -> dominio canónico
 */
function maybeRedirectToSecureOrigin(request: NextRequest): NextResponse | null {
  const host = request.headers.get('host')?.split(':')[0] ?? '';
  if (!host || isLocalHost(host)) return null;
  // `next dev`: permite abrir la app desde otro dispositivo en LAN (http://IP:puerto o hostname .local).
  if (process.env.NODE_ENV === 'development') return null;

  const canonical = (process.env.NEXT_PUBLIC_CANONICAL_ORIGIN?.trim() || DEFAULT_CANONICAL_ORIGIN).replace(/\/$/, '');
  const legacy = process.env.NEXT_PUBLIC_LEGACY_HOST?.trim();
  const canonicalHost = (() => {
    try {
      return new URL(canonical).host.split(':')[0];
    } catch {
      return 'pickandsurvive.com';
    }
  })();

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  const isHttps = protocol === 'https';
  const shouldUseCanonicalHost = host !== canonicalHost && (host === legacy || isIpHost(host));
  const shouldForceHttps = !isHttps;

  if (!shouldUseCanonicalHost && !shouldForceHttps) {
    return null;
  }

  const base = shouldUseCanonicalHost ? canonical : `https://${host}`;
  const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, base);
  return NextResponse.redirect(dest, 308);
}

const PROTECTED_PREFIXES = ['/dashboard', '/championship', '/edition', '/join', '/profile'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const secureRedirect = maybeRedirectToSecureOrigin(request);
  if (secureRedirect) {
    return secureRedirect;
  }

  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
