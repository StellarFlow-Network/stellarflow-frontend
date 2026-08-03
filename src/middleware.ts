import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE = 'sf_admin_session';
const ADMIN_PATHS = ['/admin'];

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isDev = process.env.NODE_ENV === 'development';
  const scriptDev = isDev ? " 'unsafe-eval'" : "";
  const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const apiUrls = nextPublicApiUrl ? ` ${nextPublicApiUrl}` : '';

  const connectSrc = [
    "'self'",
    "https://horizon-testnet.stellar.org",
    "https://soroban-testnet.stellar.org",
    "https://horizon.stellar.org",
    "https://soroban-rpc.mainnet.stellar.org",
    "https://*.stellar.org",
    "https://raw.githubusercontent.com",
    apiUrls,
    isDev ? "ws://localhost:*" : "",
    isDev ? "http://localhost:*" : "",
  ].filter(Boolean).join(" ");

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    scriptDev,
    "https://polyfill-library.fastly.dev",
  ].filter(Boolean).join(" ");

  const cspHeader = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'nonce-${nonce}';
    connect-src ${connectSrc};
    img-src 'self' blob: data: https://*.basemaps.cartocdn.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  let response: NextResponse;

  if (isAdminPath(pathname)) {
    const sessionToken = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!sessionToken) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.webp|.*\\.svg|.*\\.png|.*\\.jpg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
