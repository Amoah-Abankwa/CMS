import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from './lib/csp';

export function proxy(request: NextRequest) {
  // Generate one nonce for this request. The same nonce is:
  // 1. passed to Next.js through x-nonce, and
  // 2. included in the CSP header.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isProduction = process.env.NODE_ENV === 'production';
  const csp = contentSecurityPolicy(isProduction, nonce);

  // Headers passed into the Next.js rendering pipeline.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Headers sent to the browser.
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon).*)',
      missing: [
        {
          type: 'header',
          key: 'next-router-prefetch',
        },
        {
          type: 'header',
          key: 'purpose',
          value: 'prefetch',
        },
      ],
    },
  ],
};