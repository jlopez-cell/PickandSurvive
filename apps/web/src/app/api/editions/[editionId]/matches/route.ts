import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(req: NextRequest, { params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  const matchday = req.nextUrl.searchParams.get('matchday') ?? '';
  return proxyRequest(`/editions/${editionId}/matches?matchday=${matchday}`);
}

