/**
 * Working out the visitor's real address behind proxies.
 *
 * The backend usually sits behind one or more proxies (the hosting load balancer, Nginx, and in some
 * setups the Next.js server relaying /api). Each adds the address it received the request from to
 * X-Forwarded-For. TRUST_PROXY tells Express how many of those hops to trust, so req.ip is the visitor
 * rather than the last proxy. See docs/DEPLOYMENT.md, "Visitors' IP addresses".
 */

/** TRUST_PROXY as Express expects it: a hop count ("1", "2"), or addresses and ranges ("loopback, 10.0.0.0/8"). */
export function parseTrustProxy(value: string): number | string | boolean {
  const v = value.trim();
  if (v === '' || v === 'false') return false;
  if (v === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

/** Stores addresses plainly: "::ffff:41.66.2.10" (IPv4 written as IPv6) becomes "41.66.2.10". */
export function normaliseIp(ip: string | undefined): string | undefined {
  if (!ip) return ip;
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  return m ? m[1] : ip;
}

/** True for this computer (::1, 127.x): what you see when the visitor and server share a machine, or when a proxy's address is not being passed on. */
export function isLoopback(ip: string | undefined) {
  return ip === '::1' || /^127\./.test(ip ?? '') || ip === '::ffff:127.0.0.1';
}
