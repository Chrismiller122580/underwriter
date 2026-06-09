import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/api/claims' && request.method === 'POST') {
    return NextResponse.next();
  }

  const isProtectedPage = pathname.startsWith('/claims');
  const isProtectedApi =
    (pathname === '/api/claims' && request.method === 'GET') ||
    (pathname.match(/^\/api\/claims\/[^/]+\/underwrite$/) &&
      request.method === 'POST');

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);

  if (!session) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/claims', '/claims/:path*', '/api/claims', '/api/claims/:path*'],
};