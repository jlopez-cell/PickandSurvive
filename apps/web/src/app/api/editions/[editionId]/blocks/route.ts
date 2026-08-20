import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function POST(req: NextRequest, { params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  const body = await req.json();
  return proxyRequest(`/editions/${editionId}/blocks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
