import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  // Migrations must use the direct (non-pooled) Supabase connection.
  datasource: {
    url: env('DIRECT_URL'),
  },
});
