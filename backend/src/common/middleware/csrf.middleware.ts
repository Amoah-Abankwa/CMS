import type { NextFunction, Request, Response } from 'express';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Server-to-server callbacks authenticated by their own signature, not by a browser session. */
const SIGNED_WEBHOOKS = new Set(['/api/v1/payments/paystack/webhook']);

/**
 * Cookie-authenticated APIs need CSRF protection. Browsers cannot send this custom header
 * cross-origin without a CORS preflight, and CORS only allows the ANU web origin.
 */
export function csrfHeaderMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SAFE.has(req.method) || req.header('x-anu-client') === 'web' || SIGNED_WEBHOOKS.has(req.path)) return next();
  res.status(403).json({ statusCode: 403, code: 'CSRF_REJECTED', message: 'Request blocked.' });
}
