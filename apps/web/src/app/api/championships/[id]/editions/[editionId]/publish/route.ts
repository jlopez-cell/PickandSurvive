import { proxyRequest } from '@/lib/api-proxy';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string; editionId: string }> },
) {
  const { id, editionId } = await params;
  return proxyRequest(`/championships/${id}/editions/${editionId}/publish`, { method: 'PATCH' });
}
