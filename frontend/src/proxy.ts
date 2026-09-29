import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from './lib/csp';

/**
 * Runs before every page: gives the request a fresh random nonce and the matching
 * Content-Security-Policy. Next.js reads the policy from the request and adds the nonce to its scripts.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(process.env.NODE_ENV === 'production', nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API (proxied to the backend), static files or prefetches.
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
