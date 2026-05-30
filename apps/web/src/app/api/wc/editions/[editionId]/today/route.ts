import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(req: NextRequest, { params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  return proxyRequest(`/wc/editions/${editionId}/today${req.nextUrl.search}`);
}
