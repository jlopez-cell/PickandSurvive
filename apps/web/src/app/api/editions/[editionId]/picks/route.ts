import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(req: NextRequest, { params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  const matchday = req.nextUrl.searchParams.get('matchday') ?? '';
  return proxyRequest(`/editions/${editionId}/picks?matchday=${matchday}`);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  const body = await req.json();
  return proxyRequest(`/editions/${editionId}/picks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
