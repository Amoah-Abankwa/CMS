# Quality assurance (Phase 9)

This file records what has been checked, what was found and fixed, and what still has to be checked
on a machine with internet access and PostgreSQL.

## Why the checks are split in two

The build environment used for Phases 1 to 9 has no internet access and no database, so packages
(NestJS, Prisma, Next.js, Jest) could not be installed and the platform has never been started. Every
check that does not need those packages was run and is repeatable with one command. The checks that
need a running system are scripted too (`pnpm qa:smoke`) and listed below, but **have not been run yet**.

## Automated checks

| Command | What it checks | Needs packages? | Status |
| --- | --- | --- | --- |
| `pnpm qa:static` | Database schema, frontend-to-API wiring, design rules, unguarded routes (four scripts below) | No, only Python 3 | Passing |
| `pnpm qa:rules` | All business-rule tests that do not need NestJS (67 tests in 12 files) | Only `tsx` | Passing |
| `pnpm test` | Every backend spec with real Jest, including the one the rule runner skips | Yes | Not yet run |
| `pnpm typecheck` | Full TypeScript checking of backend and frontend | Yes | Not yet run; only the shared package has had a full type check, the others a syntax check |
| `pnpm build` | Production builds | Yes | Not yet run |
| `pnpm qa:smoke` | End to end against a running API with demo data: 73 checks | Yes, and a database | Not yet run |

### The static checks (`scripts/qa/`)

- **check-schema.py**: validates the Prisma schema without Prisma: 79 models, 41 enums and 202 relation fields. It checks that every type exists, that each relation has exactly one opposite side with a matching name, that `fields`/`references` point at real columns, that one-to-one foreign keys are unique, and that no name is defined twice.
- **check-wiring.py**: every frontend API call (235) matches a backend route and HTTP method (255 routes); every sidebar, in-page and notification link (149) opens a page that exists (77 pages); every permission used exists and is given to some role (38); every notification sent has a template (40); every activity-log action recorded (125) has a readable label, and every module is in the activity filter.
- **check-requirements.py**: ANU's design rules across 328 files: no gradients, no emojis (in screens, emails or SMS), colours only from theme tokens so light and dark mode both work (every one of the 17 colour tokens has a dark value), and no leftover debug output.
- **list-open-routes.py**: lists every route with no permission requirement and fails if one appears that is not in `reviewed-open-routes.txt`, so each new open route gets a security review.

Each checker was tested by planting mistakes (a call to a route that does not exist, a wrong HTTP method, a missing page, an unknown permission, a one-sided relation, a gradient, an emoji, a fixed colour) and confirming it reported every one.

### The rule tests

`scripts/qa/run-specs.ts` runs the real `*.spec.ts` files with a small Jest-compatible runner, so the business rules can be tested without installing Jest. It covers index numbers, grading and GPA, exam clashes and eligibility, attendance check-in codes, devotion scoring, hostel allocation, library fines and due dates, food orders and opening hours, Paystack webhook signatures, campus job and dispatcher eligibility, CSV safety, and the authenticator codes used by the smoke test (checked against the RFC 6238 test vectors). The runner itself was tested with deliberately failing assertions.

## Found and fixed in Phase 9

1. **Duplicate database enum (would have stopped the platform from starting).** Phase 8 added an enum `DeliveryStatus` for food deliveries, but Phase 1 already had one with that name for email and SMS delivery. Prisma refuses a schema with a duplicate name, so `pnpm db:generate` would have failed. Renamed the Phase 8 enum to `DispatchDeliveryStatus`; no code referred to it by name.
2. **Spreadsheet formula injection in four CSV downloads.** The class list, overdue books, where-students-live and devotion scores downloads wrote user-typed text straight into CSV. A name or note starting with `=` could run as a formula when opened in Excel. All CSV downloads now use one helper (`frontend/src/lib/csv.ts`) that neutralises such values, quotes correctly and adds the marker Excel needs to show GH₵ and accented names properly.
3. **Smoke test robustness** (found while testing the test): it now reports clearly when the API is not running, and records a failure instead of stopping when a response is not what it expects.

## Security review of open routes

12 routes are public, all intentional: sign-in and authenticator steps, account setup, password reset, the health check, and the Paystack webhook (checked by its HMAC signature).

65 routes need a signed-in user but no particular permission: mostly the user's own data under `/me/...`, food ordering, notifications and read-only policies. Each was reviewed. Every route that acts on a specific record (an order, loan, reservation, booking, application, notification or session) limits it to its owner in the service, and student-only features refuse other account types. The results-approval routes check permission and department scope inside the service. One accepted observation: partner accounts (vendors, hostel owners) can search the library catalogue. It holds no personal data, and they have no menu link to it.

Rate limiting: 120 requests a minute per address everywhere, plus an account lockout after repeated failed sign-ins. See Phase 10 below for why sign-in limits per address were not tightened.

## Continuous integration

`.github/workflows/ci.yml` (added in Phase 10) runs on every push: static checks, rule tests, Prisma generate, type check, Jest, build and a dependency audit; then, in a second job, a real PostgreSQL database with the demo data, the API started from its production build, and `pnpm qa:smoke` against it. Pushing the project to a GitHub repository is the quickest way to do the first real run. After the first successful install, commit `pnpm-lock.yaml` and turn on the cache (see the comment in the workflow).

## First run on a machine with internet (do this next)

1. Install Node.js 22, pnpm and PostgreSQL 16 (or use Supabase). Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`, and fill them in.
2. `pnpm install`
3. `pnpm qa`: static checks and rule tests (should pass as they do here).
4. `pnpm db:generate`: the first real check of the schema by Prisma.
5. `pnpm typecheck`: full type checking. Expect a first round of type errors to fix, since the backend and frontend have only been syntax-checked.
6. `pnpm test`: all backend specs with Jest.
7. `pnpm db:migrate` (creates the first migration; commit `backend/prisma/migrations`), then `pnpm db:harden` and `pnpm db:seed`.
8. `pnpm dev`, then in another terminal `pnpm qa:smoke`. Run it on a weekday between 07:00 and 21:00 Ghana time so the food-delivery part runs (the cafeteria is closed otherwise and that part is skipped). It creates and completes one order; re-seed afterwards for a clean demo.
9. `pnpm build`.
10. Walk through `docs/DEMO_ACCOUNTS.md` in a browser, on a phone and on a desktop, in light and dark mode. The API console shows every email and SMS that would be sent.

Please send back the output of any step that fails; most first-run problems are quick to fix.

## Manual checks the scripts cannot do

- Layout on small phones (360 px wide) and with the sidebar collapsed; long names and long course titles.
- Keyboard-only use and a screen reader on sign-in, check-in, checkout and the dispatcher screen.
- The projector screens for class and devotion check-in from the back of a hall.
- Real SMS and email delivery with ANU's providers, and how messages look on a basic phone.
- Paystack with test keys: mobile money and card, a failed payment, a refund, and the webhook reaching the server.
- Behaviour on a slow connection (campus Wi-Fi at peak times).

## For Phase 10 (security and production)

- Sign-in rate limits: many students share one address behind campus Wi-Fi, so per-address limits must stay generous; consider limits per account and per index number instead, and a cap on password-reset messages per account per hour.
- Run a dependency audit (`pnpm audit`) once packages are installed.
- Production settings: secure cookies over HTTPS (already on when `NODE_ENV=production`), the real payment provider, backups, monitoring and log retention.
