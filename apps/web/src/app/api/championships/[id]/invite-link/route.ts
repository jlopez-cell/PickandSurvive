import { proxyRequest } from '@/lib/api-proxy';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyRequest(`/championships/${id}/invite-link`, { method: 'POST' });
}
