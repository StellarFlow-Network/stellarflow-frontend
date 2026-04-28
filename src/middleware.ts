import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE = 'sf_admin_session';
const ADMIN_PATHS = ['/admin'];

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(ADMIN_COOKIE)?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
