import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // BUILD_TS is baked into the server process at build time — changes every deploy
  const buildTs = process.env.NEXT_PUBLIC_BUILD_TS ?? 'unknown';
  return NextResponse.json({ buildTs }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
