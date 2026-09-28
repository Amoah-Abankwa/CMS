/**
 * Reasons a configuration is not safe to run in production. Each is a plain sentence saying what to
 * change. Kept free of imports so it can be tested on its own.
 */
export interface ProductionEnv {
  NODE_ENV: string;
  WEB_ORIGIN: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  MFA_ENCRYPTION_KEY: string;
  SMTP_HOST: string;
  EMAIL_PROVIDER: string;
  RESEND_API_KEY: string;
  SMS_PROVIDER: string;
  SMS_API_KEY: string;
  PAYMENTS_PROVIDER: string;
  PAYSTACK_SECRET_KEY: string;
  DEMO_MODE: boolean;
}

/** Secrets that appear in the repository (demo data and docs) must never protect real accounts. */
const PUBLIC_VALUES = new Set(['KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD', 'AnuDemo#2025']);

/** A secret made of one repeated character, a short repeated pattern, or an obvious placeholder. */
function looksWeak(secret: string): boolean {
  if (PUBLIC_VALUES.has(secret)) return true;
  if (/change|secret|example|placeholder|password|xxxx/i.test(secret)) return true;
  if (new Set(secret).size < 8) return true;
  for (let n = 1; n <= 8; n++) {
    if (secret.length % n === 0 && secret.slice(0, n).repeat(secret.length / n) === secret) return true;
  }
  return false;
}

export function productionProblems(env: ProductionEnv): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const p: string[] = [];
  if (env.DEMO_MODE) p.push('DEMO_MODE must be false in production.');
  if (!env.WEB_ORIGIN.startsWith('https://')) p.push('WEB_ORIGIN must be an https:// address in production.');
  if (/localhost|127\.0\.0\.1/.test(env.WEB_ORIGIN)) p.push('WEB_ORIGIN must be the public address of the website, not localhost.');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) p.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  if (looksWeak(env.JWT_ACCESS_SECRET)) p.push('JWT_ACCESS_SECRET looks like a placeholder. Generate one with: openssl rand -base64 48');
  if (looksWeak(env.JWT_REFRESH_SECRET)) p.push('JWT_REFRESH_SECRET looks like a placeholder. Generate one with: openssl rand -base64 48');
  if (looksWeak(env.MFA_ENCRYPTION_KEY)) p.push('MFA_ENCRYPTION_KEY looks like a placeholder. Generate one with: openssl rand -hex 32');
  if (env.EMAIL_PROVIDER === 'resend' && !/^re_\w+/.test(env.RESEND_API_KEY)) p.push('RESEND_API_KEY is required (re_...) when EMAIL_PROVIDER is resend: setup links and reset codes are sent by email.');
  if (env.EMAIL_PROVIDER === 'smtp' && !env.SMTP_HOST) p.push('Email must be configured in production: set EMAIL_PROVIDER=resend with RESEND_API_KEY, or SMTP_HOST.');
  if (env.SMS_PROVIDER === 'log') p.push('SMS_PROVIDER "log" only prints messages. Set a real provider (arkesel) in production.');
  if (env.SMS_PROVIDER !== 'log' && !env.SMS_API_KEY) p.push('SMS_API_KEY is required for the SMS provider.');
  if (env.PAYMENTS_PROVIDER !== 'paystack') p.push('PAYMENTS_PROVIDER must be "paystack" in production; "demo" takes no real money.');
  if (env.PAYMENTS_PROVIDER === 'paystack' && !/^sk_(live|test)_\w+$/.test(env.PAYSTACK_SECRET_KEY)) p.push('PAYSTACK_SECRET_KEY must be a Paystack secret key (sk_live_...).');
  return p;
}

/** Test keys are allowed (for a staging site), but are worth a warning in production. */
export function productionWarnings(env: ProductionEnv): string[] {
  if (env.NODE_ENV !== 'production') return [];
  return env.PAYSTACK_SECRET_KEY.startsWith('sk_test_') ? ['PAYSTACK_SECRET_KEY is a test key: no real money will move. Fine for a staging site, not for launch.'] : [];
}
