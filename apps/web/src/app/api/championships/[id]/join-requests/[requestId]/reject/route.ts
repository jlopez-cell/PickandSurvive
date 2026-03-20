import { proxyRequest } from '@/lib/api-proxy';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const { id, requestId } = await params;
  return proxyRequest(`/championships/${id}/join-requests/${requestId}/reject`, { method: 'POST' });
}
