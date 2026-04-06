import { proxyRequest } from '@/lib/api-proxy';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyRequest(`/notifications/${id}/read`, { method: 'PATCH' });
}
