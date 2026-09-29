import { contentSecurityPolicy } from './csp';

describe('content security policy', () => {
  const prod = contentSecurityPolicy(true, 'abc123');
  const scripts = prod.split('; ').find((d) => d.startsWith('script-src'))!;
  it('runs only scripts carrying this request\u2019s nonce', () => {
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });
  it('keeps framing, plugins and other sites out', () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("default-src 'self'");
    expect(prod).toContain('upgrade-insecure-requests');
  });
  it('allows eval only in development (hot reload)', () => {
    expect(contentSecurityPolicy(false, 'x')).toContain("'unsafe-eval'");
  });
});
