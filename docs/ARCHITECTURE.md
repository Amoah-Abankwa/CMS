# Architecture notes (Phase 1)

## Request path

Browser -> Next.js (`/api/*` rewrite) -> NestJS `/api/v1` -> Prisma (driver adapter) -> Supabase Postgres.

The browser only ever talks to the web origin, so auth cookies are first-party and the API can stay off the public internet if the host allows it.

## Authentication

- **Nobody receives a password.** When the Registry registers a student or a Super Admin creates a staff account, the account starts as `PENDING_SETUP` with no password. The owner is emailed a one-time link (stored hashed, valid 72 hours, older links cancelled when a new one is sent) and chooses their own password. Students also get their index number by SMS. "Forgot password" on an account still awaiting setup sends a fresh setup link.
- **Students** sign in with index number and password. The index number is assigned at registration in the same database transaction, using an atomic counter per admission year and programme level.
- **Staff** sign in with email and password, then must pass TOTP two-step verification. On first sign-in they set up an authenticator app before any session exists. Ten single-use recovery codes are issued at setup.
- Access token: 15-minute JWT in an httpOnly cookie. Refresh token: opaque, stored hashed, rotated on every use, scoped to `/api/v1/auth`. Reusing an old refresh token ends the session.
- 5 failed attempts lock the account for 15 minutes and notify the owner.
- Sensitive actions (currently Developer access changes) need an authenticator code from the last 15 minutes. The web app prompts for it automatically and retries.
- CSRF: cookies are `SameSite=Lax`, and every non-GET request must carry the `x-anu-client: web` header.

## Roles and permissions

- Role keys, permission keys and log groups live in `shared` so both apps agree.
- **Staff can hold several roles** (for example Lecturer and Head of Department). A Super Admin chooses them when creating the account and can change them later on the staff record; both actions need a fresh authenticator code, are logged with before and after values, and notify the person.
- The API refuses a second holder of a one-holder role and names the current one.
- Nobody can change their own roles, and the last active Super Admin cannot lose that role.
- 26 staff roles in 7 areas, plus Developer, student and partner roles. See `docs/ROLES.md` for the full list, what each can do today and when its tools arrive. The definitions live in `shared/src/roles.ts`.
- Head of Department, Programme Coordinator and Academic Advisor are tied to a department; Dean to a school. One Head per department, one Dean per school, one Vice-Chancellor and one Dean of Students at a time.
- A session has one **active role**. Permissions come from that role only. People with several roles switch in the sidebar.
- The **Developer** role is off for everyone. Only a Super Admin can turn it on for a staff member, never for themselves, with a reason and optional expiry. Grants expire through a scheduled job every 5 minutes. Turning it off moves any Developer session back to the person's primary role.

### Add-on roles

Permissions normally come from the session's active role only. An add-on role (currently Student Dispatcher, see `ADD_ON_ROLES` in `shared/src/roles.ts`) instead adds its permissions to the role it belongs to, and never appears in the role switcher. A student approved as a dispatcher keeps their Student role active and gains the dispatcher's pages. Add-on roles cannot be assigned from the staff screens; they are granted and removed only by the feature that owns them.

## Activity logs

- `AuditLog` is append-only; a database trigger rejects updates and deletes.
- Each entry records who, which role, which log group, what, target, result, IP, device and a correlation ID that matches the `x-correlation-id` response header.
- Every user can view, filter, print and export their own log. Super Admins see everything, grouped by Students, Lecturers, Librarians, Non-teaching staff, External partners, Developers and Administrators.

## Notifications

- `NotificationsService.notify()` renders the template for each recipient, stores the in-app notification and one delivery row per channel, then queues each delivery in pg-boss. Requests never wait on email or SMS.
- The worker retries 5 times with backoff, then marks the delivery failed. Exams Officers and Super Admins can list failed deliveries and resend.
- Messages carrying temporary passwords or reset codes are marked sensitive; their text is replaced with `[redacted]` in the database after the final attempt.
- Event templates already exist for results published, internal marks updated, exam timetable published and exam eligibility published. Phase 2 wires them to the academic workflows.

## Payments

`backend/src/modules/payments` is shared by any feature that takes money. A feature calls `PaymentsService.start()` with a purpose (for example `FOOD_ORDER`) and registers what should happen on success with `onSucceeded(purpose, handler)`. The provider (Paystack, or the demo provider for development) is chosen by `PAYMENTS_PROVIDER`.

- The browser redirect is never trusted. A payment counts only after the server verifies it with the provider, and the amount and currency match what was recorded.
- Confirmation is idempotent: the status changes from pending once, so the success handler runs once even if the return page and the webhook arrive together.
- The Paystack webhook is public but checked with the HMAC-SHA512 signature over the raw request body, and is exempt from the browser CSRF check.
- Every payment, refund, failure and rejected webhook is written to the activity log.

Library fines and school fees can use the same module later.

## Legacy CMS integration path

The current CMS (`cms.anu.edu.gh`) is an ASP.NET WebForms application. This platform does not scrape or impersonate it. `StudentProfile.externalRef` and `StaffProfile.externalRef` are reserved for legacy IDs. Once ANU provides a database export, read-only replica or API, an import module will map legacy records to these tables and keep index numbers unchanged.

## Repository layout

`backend/` (NestJS), `frontend/` (Next.js) and `shared/` (rules both use). Pure business rules live in `shared/src`: grading and GPA (`grading.ts`), exam clashes and eligibility (`exams.ts`), and attendance (`attendance.ts`). The backend enforces them; the frontend uses the same functions to preview results before saving, so the two never disagree.
