import { proxyRequest } from '@/lib/api-proxy';

export async function GET(_req: Request, { params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  return proxyRequest(`/editions/${editionId}/picks/history`);
}
