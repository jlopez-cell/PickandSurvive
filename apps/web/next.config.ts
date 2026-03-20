import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pickandsurvive/shared'],
  experimental: {
    // Enable server actions (stable in Next.js 15)
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
