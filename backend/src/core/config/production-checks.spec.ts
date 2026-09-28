import { productionProblems, productionWarnings, type ProductionEnv } from './production-checks';

const good: ProductionEnv = {
  NODE_ENV: 'production',
  WEB_ORIGIN: 'https://portal.anu.edu.gh',
  JWT_ACCESS_SECRET: 'q7Vd9LmZ2xR4tP8wK1sN6yB3cF5hJ0gA-u2E',
  JWT_REFRESH_SECRET: 'Zp3Wm8Xk1Qv6Rt9Ys2Ln5Hb7Jd4Fg0Ca-e8T',
  MFA_ENCRYPTION_KEY: '3f9a1c7e5b2d8046af13c9e75b0d2468ce1f3a5b7d9e0c2468af13579bdf0246',
  SMTP_HOST: '',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_live123',
  SMS_PROVIDER: 'arkesel',
  SMS_API_KEY: 'key',
  PAYMENTS_PROVIDER: 'paystack',
  PAYSTACK_SECRET_KEY: 'sk_live_abc123',
  DEMO_MODE: false,
};

describe('production configuration checks', () => {
  it('accepts a proper production configuration', () => {
    expect(productionProblems(good)).toEqual([]);
    expect(productionWarnings(good)).toEqual([]);
  });

  it('does not apply outside production', () => {
    expect(productionProblems({ ...good, NODE_ENV: 'development', DEMO_MODE: true, PAYMENTS_PROVIDER: 'demo' })).toEqual([]);
  });

  it('refuses demo settings', () => {
    const p = productionProblems({ ...good, DEMO_MODE: true, PAYMENTS_PROVIDER: 'demo', SMS_PROVIDER: 'log' });
    expect(p).toHaveLength(3);
  });

  it('refuses an insecure or local website address', () => {
    expect(productionProblems({ ...good, WEB_ORIGIN: 'http://portal.anu.edu.gh' })).toHaveLength(1);
    expect(productionProblems({ ...good, WEB_ORIGIN: 'https://localhost:3000' })).toHaveLength(1);
  });

  it('refuses weak, shared or public secrets', () => {
    expect(productionProblems({ ...good, JWT_REFRESH_SECRET: good.JWT_ACCESS_SECRET })).toHaveLength(1);
    expect(productionProblems({ ...good, JWT_ACCESS_SECRET: 'change-me-change-me-change-me-change-me' })).toHaveLength(1);
    expect(productionProblems({ ...good, JWT_ACCESS_SECRET: 'a'.repeat(40) })).toHaveLength(1);
    expect(productionProblems({ ...good, JWT_ACCESS_SECRET: 'abab'.repeat(10) })).toHaveLength(1);
    expect(productionProblems({ ...good, MFA_ENCRYPTION_KEY: '0'.repeat(64) })).toHaveLength(1);
  });

  it('needs email, a real SMS key, and a Paystack secret key', () => {
    expect(productionProblems({ ...good, RESEND_API_KEY: '' })).toHaveLength(1);
    expect(productionProblems({ ...good, EMAIL_PROVIDER: 'smtp' })).toHaveLength(1);
    expect(productionProblems({ ...good, EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com' })).toEqual([]);
    expect(productionProblems({ ...good, SMS_API_KEY: '' })).toHaveLength(1);
    expect(productionProblems({ ...good, PAYSTACK_SECRET_KEY: 'pk_live_abc' })).toHaveLength(1);
  });

  it('warns about Paystack test keys without refusing', () => {
    const test = { ...good, PAYSTACK_SECRET_KEY: 'sk_test_abc' };
    expect(productionProblems(test)).toEqual([]);
    expect(productionWarnings(test)).toHaveLength(1);
  });
});
