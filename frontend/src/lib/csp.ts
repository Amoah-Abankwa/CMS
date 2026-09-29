/**
 * The Content-Security-Policy for a page, with that request's nonce. Scripts run only if they carry the
 * nonce (Next.js adds it to its own scripts; the theme script gets it in the root layout), and anything
 * those scripts load is trusted through 'strict-dynamic'. Inline styles stay allowed because React style
 * attributes need them.
 */
export function contentSecurityPolicy(isProduction: boolean, nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    // Photos are served by Cloudinary; uploads go from the browser straight to Cloudinary with a signature.
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    `connect-src 'self' https://api.cloudinary.com${isProduction ? '' : ' ws: wss:'}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
