# All Nations University Platform

A modern university management and campus services platform for All Nations University (ANU), Koforidua, Ghana. This repository is a working prototype built to propose a replacement path for the current CMS. It does not copy the existing system; it is designed to integrate with it, or replace it module by module, once ANU grants authorised technical access.

**Status:** Phases 1 to 7 are complete: foundation (accounts, MFA, roles, activity logs, notifications), academic management (registration, results and GPA, exam timetable and eligibility), class attendance, morning devotion, accommodation, library, and the food marketplace with online payments. Phase 8 (student employment and dispatchers) is next. See `docs/ROADMAP.md`.

## Stack

| Layer | Choice |
| --- | --- |
| API | NestJS 11, TypeScript |
| Database | PostgreSQL on Supabase, Prisma ORM 7.10.0 with the `@prisma/adapter-pg` driver adapter |
| Background jobs | pg-boss (runs on the same Postgres; no Redis) |
| Web | Next.js 16 App Router, Zustand, one shared Axios instance, React Hook Form with Zod, Tailwind CSS 4 |
| Email / SMS | SMTP via Nodemailer; Arkesel for SMS (both log to the console in development) |

No Docker is used anywhere. Everything runs with Node.js and a Supabase project.

## Requirements

- Node.js 22 (see `.nvmrc`)
- pnpm 9 (`corepack enable`)
- A Supabase project (free tier is fine for development)

## First-time setup

1. Install dependencies. This also builds the shared package.

   ```bash
   pnpm install
   ```

2. Create the API environment file and fill it in.

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

   In Supabase, open **Project Settings, Database, Connection string**:
   - `DATABASE_URL`: the **transaction pooler** string (port 6543), with `?pgbouncer=true` appended.
   - `DIRECT_URL`: the **session pooler** or direct string (port 5432). Migrations and pg-boss use this one.

   Generate the three secrets:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_ACCESS_SECRET
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_REFRESH_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # MFA_ENCRYPTION_KEY (64 hex chars)
   ```

3. Create the database schema and the Prisma client.

   ```bash
   pnpm db:migrate        # prompts for a migration name, e.g. "foundation"
   ```

   If you already migrated the earlier version, run `pnpm db:migrate` again (name it after the change, e.g. "course-registration") and re-run `pnpm db:seed` so the renamed Exam Coordinator role and role descriptions are loaded.

   ```bash
   # nothing else to run here
   ```

4. Harden the database. In the Supabase SQL editor, run the two files in `backend/prisma/sql/` in order:
   - `01_audit_append_only.sql` blocks any update or delete on the activity log.
   - `02_enable_rls.sql` turns on Row Level Security for every table, which shuts off Supabase's public REST API. The NestJS API is the only way in.

   Re-run `02_enable_rls.sql` after any migration that adds tables.

5. Load the demonstration data (all fictional).

   ```bash
   pnpm db:seed
   ```

6. Start both apps.

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:3000
   - API: http://localhost:4000/api/v1 (OpenAPI docs at http://localhost:4000/api/docs)

Demo accounts are in `docs/DEMO_ACCOUNTS.md`.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs API and web together |
| `pnpm db:generate` | Regenerates the Prisma client after schema edits |
| `pnpm db:migrate` | Creates and applies a development migration |
| `pnpm db:deploy` | Applies migrations in staging or production |
| `pnpm db:seed` | Loads demo data (safe to re-run) |
| `pnpm --filter @anu/backend test` | API unit tests |

## Repository layout

```
backend/     NestJS API (port 4000)
  prisma/      schema (one file per area), seed data, SQL hardening scripts
  src/core/    infrastructure: config, Prisma, jobs, email, SMS, crypto
  src/common/  guards, decorators, filters shared by every module
  src/modules/ one folder per feature: auth, students, staff, offerings, results, exams, attendance...
frontend/    Next.js app (port 3000)
  src/app/        pages (route groups: (auth) sign-in pages, (app) signed-in pages)
  src/features/   one folder per feature, each with its api.ts and components
  src/components/ shared UI primitives and the dashboard layout
shared/      role keys, permissions and pure business rules (grading, exam clashes,
             eligibility, attendance) used by both backend and frontend
docs/        architecture, roles, demo accounts, roadmap
```

Run commands from the repository root; `pnpm dev` starts both. To work on one side only: `pnpm dev:backend` or `pnpm dev:frontend`.

## Deployment outline (no Docker)

- **Backend**: any Node host (Render, Railway, Fly.io, or a VM with PM2). Build with `pnpm --filter @anu/shared build && pnpm --filter @anu/backend build`, run `pnpm db:deploy`, then `node backend/dist/main.js`.
- **Frontend**: Vercel or any Node host. Set `API_URL` to the API's internal or public URL.
- Use separate Supabase projects for staging and production.
- Set `NODE_ENV=production`, `DEMO_MODE=false`, real SMTP and `SMS_PROVIDER=arkesel`. The API refuses to start in production without them.
