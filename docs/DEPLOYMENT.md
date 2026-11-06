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
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=re_...`, `MAIL_FROM` (an address on the domain verified in Resend). SMTP (`EMAIL_PROVIDER=smtp` with `SMTP_*`) also works.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from the Cloudinary console, for dish and hostel photos. Without them, photo uploads say they are not set up; everything else works.
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
7. **Email.** In Resend, add and verify the sending domain (it gives the SPF and DKIM records to add to DNS), and add a DMARC record, or setup links and reset codes will land in spam. Send yourself a password reset to check.
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


## After the tenth round

- Run `pnpm install` (the backend now uses `@pdf-lib/fontkit` to put the cedi sign in PDFs; the DejaVu Sans fonts and their licence are in `backend/assets/fonts`, and must be deployed with the backend).
- `pnpm db:deploy` now also applies `prisma/sql/03_audit_retention.sql`.
- Pages are rendered per request because of the content security policy nonce; allow for this when sizing the frontend server.


## First academic year

On a new installation the Registrar creates the current academic year and its semesters under **Academics, Academic calendar**, marks the current semester, and sets its registration dates, before anything else (fees, registration, devotion and attendance all follow the current semester).

## Visitors' IP addresses

Sessions and the activity log record each visitor's IP address, and request limits are counted per person. If every address shows as `::1` (or `127.0.0.1`), the backend is seeing a proxy on the same machine instead of the visitor.

- **On your own computer (development)** `::1` is correct: you are visiting from the same machine.
- **On a server**, the backend must be told how many proxies sit in front of it (`TRUST_PROXY`), and each proxy must pass the visitor's address on in `X-Forwarded-For`.

**Recommended: send `/api` straight to the backend.** The Next.js server relays `/api` to the backend when nothing else does, but it may not pass the visitor's address on. Let the web server route `/api` directly instead. On a single server with Nginx:

```nginx
server {
  server_name portal.anu.edu.gh;
  # (TLS settings as usual)

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

and set `TRUST_PROXY="loopback"` for the backend (trust only Nginx on the same machine, so an address a visitor makes up is ignored).

**Other setups:**

| Setup | `TRUST_PROXY` |
| --- | --- |
| Nginx on the same machine sends `/api` to the backend (above) | `loopback` |
| A hosting load balancer (Render, Railway, a cloud load balancer) sends `/api` to the backend | `1` |
| Load balancer, then Nginx, then the backend | `2` |
| Requests go through the Next.js relay | Add 1 for the relay, but only if you confirm it passes the address on; otherwise use the recommended setup |

**To check:** sign in from a phone on mobile data, then open **Account and security**: the session should show the phone's public address, not `::1` or a server's address. As superadmin, **All activity** shows the same.

Request limits are counted per signed-in account, and on sign-in pages per address and account tried, so the many students who share the campus's public address do not block one another.


## Troubleshooting: "link expired" straight away, or "Cannot GET/POST /api/v1/..."

The website calls the API at `/api/v1/...` on its own address. Something must pass those requests to the backend unchanged, **without redirecting them**: a redirect (301 or 302) turns the browser's POST into a GET, which the API refuses ("Cannot GET"), and the set-up page then reports the link as invalid or expired. Forgot password, sign-in and every form fail the same way.

1. **Check `API_URL` for the frontend.** It must be the backend's own address, never the public website address: `http://127.0.0.1:4000` when both run on one server, or the backend service's internal address on a hosting service. It is read **when the frontend is built**, so rebuild the frontend after changing it (`pnpm --filter @anu/frontend build`, then restart).
2. **Or send `/api` straight to the backend** from Nginx (see "Visitors' IP addresses" above); then `API_URL` is not used for browser requests at all.
3. **Check `WEB_ORIGIN` for the backend.** It must be the exact public address people use, with `https://` and the same `www.` or not; it goes into the links in emails.
4. **Test it:** `curl -i -X POST https://portal.anu.edu.gh/api/v1/auth/setup/verify -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{"token":"test"}'` should answer **404 with "This setup link is invalid..."**. A `301`, `302` or a `Location:` header means a redirect is in the way. In the browser, the Network tab shows the same: the request to `/api/v1/auth/setup/verify` must be a POST with no redirect before it.

A set-up link also stops working when a newer one is sent for the same account (the Registry resending it, or the person using "Forgot password" before setting up, which sends a fresh set-up link). Always use the newest email.
