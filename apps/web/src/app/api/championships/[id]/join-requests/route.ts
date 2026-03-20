import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = req.nextUrl.searchParams.get('status');
  const qs = status ? `?status=${status}` : '';
  return proxyRequest(`/championships/${id}/join-requests${qs}`);
}
