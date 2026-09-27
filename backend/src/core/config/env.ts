import 'dotenv/config';
import { z } from 'zod';

const hex = (len: number) => z.string().regex(new RegExp(`^[0-9a-fA-F]{${len}}$`));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: hex(64),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  MFA_CHALLENGE_TTL_SECONDS: z.coerce.number().default(300),
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
  cached = parsed.data;
  return cached;
}
