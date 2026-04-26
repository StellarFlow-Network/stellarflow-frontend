/**
 * Slow Network Middleware — Issue #236
 * Injects a random delay (100ms–2000ms) on API routes in the staging environment.
 * Only active when NEXT_PUBLIC_APP_ENV=staging or NODE_ENV=test.
 */

import { NextRequest, NextResponse } from "next/server";

const MIN_DELAY_MS = 100;
const MAX_DELAY_MS = 2000;

function randomDelay(): number {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isStaging =
  process.env.NEXT_PUBLIC_APP_ENV === "staging" ||
  process.env.NODE_ENV === "test";

export async function middleware(request: NextRequest) {
  if (isStaging && request.nextUrl.pathname.startsWith("/api/")) {
    const delay = randomDelay();
    await sleep(delay);
    const response = NextResponse.next();
    response.headers.set("X-Simulated-Delay-Ms", String(delay));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
