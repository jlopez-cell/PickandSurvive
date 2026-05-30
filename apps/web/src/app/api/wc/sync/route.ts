import { proxyRequest } from '@/lib/api-proxy';

export async function POST() {
  return proxyRequest('/wc/sync', { method: 'POST' });
}
