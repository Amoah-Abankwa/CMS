# Going live

A step-by-step runbook for putting the platform into production. **Do not start until Phase 9 is
complete**: the CI pipeline (`.github/workflows/ci.yml`) must pass, including the end-to-end smoke
test, and the walkthrough in `docs/DEMO_ACCOUNTS.md` must have been tried in a browser.

## What runs where

| Part | Suggested home | Why |
| --- | --- | --- |
| Database | Supabase (PostgreSQL 16), paid plan with point-in-time recovery | Managed backups; the API already uses the pooled and direct Supabase connections |
| API (NestJS) | One always-on Node.js 22 process: Render, Railway, or a university VM with PM2 behind Nginx | Background jobs (reminders, expiring orders, daily checks) need a process that keeps running, so not a "serverless" host |
| Website (Next.js) | Vercel, or the same VM with `next start` | The website forwards `/api` to the API, so sign-in cookies stay on the university's own domain |

Use one public address for people, for example `https://portal.anu.edu.gh`. The API does not need a public address of its own if the website host can reach it.

## Production settings (API)

Start from `backend/.env.example`. In production the API **refuses to start** if any of these are wrong, and says which:

- `NODE_ENV=production`, `DEMO_MODE=false`
- `WEB_ORIGIN=https://portal.anu.edu.gh` (https, not localhost)
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: two different values from `openssl rand -base64 48`
- `MFA_ENCRYPTION_KEY`: `openssl rand -hex 32`. **Keep a copy in a safe place**: without it, every staff authenticator must be set up again.
- `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (direct, port 5432) from Supabase
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `SMS_PROVIDER=arkesel`, `SMS_API_KEY`, `SMS_SENDER_ID=ANU`
- `PAYMENTS_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY=sk_live_...` (a `sk_test_` key is allowed for a staging site, with a warning)

The website needs `API_URL` (where it can reach the API, for example `http://127.0.0.1:4000` on the same VM).

## Steps

1. **Database.** Create the Supabase project in the region closest to Ghana that Supabase offers. Turn on point-in-time recovery. Do not reuse a database that ever held demo data: the API refuses to start in production if demo accounts exist.
2. **Schema.** From a machine with the production settings: `pnpm install`, then `pnpm db:deploy`. This applies migrations and then hardens the database (activity log append-only; row-level security on every table so Supabase's public API cannot read them). `pnpm db:deploy` always does both; never run migrations on their own.
3. **Reference data.** `NODE_ENV=production pnpm db:seed` loads roles and permissions, message templates and the default grading scale. It never loads demo people.
4. **Start the API** and check `https://<api-or-portal>/api/v1/health` returns `{"status":"ok"}`.
5. **First administrator.** `pnpm admin:create --email <address> --first <name> --last <name> --staff-number <number>`. They receive a setup link by email, choose a password and set up an authenticator. Further staff are added from the Staff screens by a signed-in person, so every change is logged against someone.
6. **Website.** Deploy the frontend with `API_URL` set. Point the domain at it and make sure HTTPS works.
7. **Email.** Add SPF, DKIM and DMARC records for the sending domain, or setup links and reset codes will land in spam. Send yourself a password reset to check.
8. **SMS.** Register the sender ID "ANU" with Arkesel (sender IDs in Ghana need approval, which can take a few days) and fund the account. Send a test.
9. **Paystack.** Complete business verification, then in the dashboard set the webhook URL to `https://portal.anu.edu.gh/api/v1/payments/paystack/webhook` and switch to live keys. Make one small real payment and refund it.
10. **University set-up** (Registrar, Career Services and others, in the platform): schools, departments and programmes; semesters; grading scale check; staff accounts and roles; student accounts; library, devotion, attendance, hostel, marketplace and employment rules.
11. **Monitoring.** Add an uptime check on `/api/v1/health` that alerts ICT by SMS or email. ICT Support should look at **Failed messages** daily in the first weeks.
12. **Backups.** Before launch, restore a backup into a spare project and sign in to it. A backup that has never been restored is not yet a backup.
13. **Pilot.** Start with one department or one service (for example the library and morning devotion) before the whole university.

## Updating

1. The change passes CI.
2. Take note of the latest backup point.
3. `pnpm db:deploy` (migrations, then hardening again for any new tables).
4. Deploy the new API and website builds; the API restarts cleanly (running jobs are retried).
5. Check the health address and sign in.

Migrations only move forward. To undo a bad release, deploy the previous build; if data was damaged, restore from point-in-time recovery to just before the update.

## If something goes wrong

- **API will not start:** read the first lines of its log. Configuration problems are listed one per line with what to change.
- **People cannot sign in:** check the database is reachable (health address), then the Failed messages screen for setup links and reset codes.
- **Suspected breach:** a Super Admin revokes the affected sessions; ICT rotates `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (this signs everyone out), and the Internal Auditor exports the activity log for the period. Do not rotate `MFA_ENCRYPTION_KEY` without a plan: it would require every staff authenticator to be set up again.
