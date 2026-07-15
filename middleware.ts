import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canManageKnowledge, getSessionFromRequest } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');
  const isProtectedPage =
    pathname.startsWith('/claims') ||
    pathname.startsWith('/submit') ||
    isAdminPage;
  const isProtectedApi =
    (pathname === '/api/claims' &&
      (request.method === 'GET' || request.method === 'POST')) ||
    (pathname === '/api/claims/stats' && request.method === 'GET') ||
    pathname === '/api/claims/extract' ||
    pathname === '/api/claims/lookup-policy' ||
    pathname === '/api/upload' ||
    (pathname.match(/^\/api\/claims\/[^/]+\/documents\/[^/]+$/) &&
      request.method === 'GET') ||
    (pathname.match(
      /^\/api\/claims\/[^/]+\/(underwrite|analyze|request-info|clear-info-request)$/
    ) &&
      request.method === 'POST') ||
    isAdminApi;

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

  if (isAdminPage || isAdminApi) {
    if (!canManageKnowledge(session.role)) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/claims', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/claims',
    '/claims/:path*',
    '/submit',
    '/admin',
    '/admin/:path*',
    '/api/claims',
    '/api/claims/:path*',
    '/api/upload',
    '/api/admin',
    '/api/admin/:path*',
  ],
};