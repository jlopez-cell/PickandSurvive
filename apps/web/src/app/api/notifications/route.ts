import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || '';
  return proxyRequest(`/notifications${search}`);
}
