import { proxyRequest } from '@/lib/api-proxy';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return proxyRequest(`/championships/join/${token}`, { method: 'POST' });
}
