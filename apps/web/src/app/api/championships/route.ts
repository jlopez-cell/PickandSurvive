import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET() {
  return proxyRequest('/championships');
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyRequest('/championships', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
