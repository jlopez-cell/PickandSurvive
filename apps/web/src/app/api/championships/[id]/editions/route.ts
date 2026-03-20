import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  return proxyRequest(`/championships/${id}/editions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
