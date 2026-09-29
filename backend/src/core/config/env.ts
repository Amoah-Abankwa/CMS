import 'dotenv/config';
import { z } from 'zod';
import { productionProblems, productionWarnings } from './production-checks';

const hex = (len: number) => z.string().regex(new RegExp(`^[0-9a-fA-F]{${len}}$`));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  /** Proxies in front of the backend to trust for the visitor's address: a hop count, or addresses and ranges. See docs/DEPLOYMENT.md. */
  TRUST_PROXY: z.string().default('1'),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: hex(64),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  MFA_CHALLENGE_TTL_SECONDS: z.coerce.number().default(300),
  /** smtp (SMTP_* settings) or resend (RESEND_API_KEY). With neither configured, emails are only logged in development. */
  EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
  RESEND_API_KEY: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('All Nations University <no-reply@anu.edu.gh>'),
  SMS_PROVIDER: z.enum(['log', 'arkesel']).default('log'),
  SMS_SENDER_ID: z.string().max(11).default('ANU'),
  SMS_API_KEY: z.string().default(''),
  /** "demo" simulates payments (no money moves); "paystack" takes real payments. */
  PAYMENTS_PROVIDER: z.enum(['demo', 'paystack']).default('demo'),
  PAYSTACK_SECRET_KEY: z.string().default(''),
  DEMO_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Validates environment variables once at startup and fails fast on misconfiguration. */
export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const problems = productionProblems(parsed.data);
  if (problems.length) {
    throw new Error(`Refusing to start in production:\n- ${problems.join('\n- ')}`);
  }
  for (const w of productionWarnings(parsed.data)) console.warn(`Warning: ${w}`);
  cached = parsed.data;
  return cached;
}
