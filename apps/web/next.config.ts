import type { NextConfig } from 'next';

// Set by remote-post-deploy.sh before the build so both server and client
// webpack compilations share the exact same value. Falls back to Date.now()
// for local dev (tiny race condition between compilations is acceptable in dev).
const BUILD_TS = process.env.NEXT_PUBLIC_BUILD_TS ?? Date.now().toString();

const nextConfig: NextConfig = {
  transpilePackages: ['@pickandsurvive/shared'],
  experimental: {
    // Enable server actions (stable in Next.js 15)
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_BUILD_TS: BUILD_TS,
  },
  async headers() {
    return [
      {
        // Prevent iOS web clip from caching HTML pages; static assets (_next/static) keep long TTL
        source: '/((?!_next/static|_next/image|favicon).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
