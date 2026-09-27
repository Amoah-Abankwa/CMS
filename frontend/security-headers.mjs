/**
 * Security headers for every page. Kept in its own file so they can be checked without Next.js.
 *
 * The site loads nothing from other origins: fonts are bundled at build time, the API is reached
 * through the /api rewrite, and Paystack checkout is a full-page redirect (not embedded).
 * 'unsafe-inline' for scripts is needed because Next.js injects inline bootstrapping scripts and the
 * theme script runs before first paint; moving to per-request nonces is noted in docs/SECURITY.md.
 */
export function securityHeaders(isProduction) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isProduction ? '' : ' ws: wss:'}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const headers = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
  // HSTS only over HTTPS in production; sending it from localhost would pin browsers to https://localhost.
  if (isProduction) headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
  return headers;
}
