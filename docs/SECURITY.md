# Security

What protects the platform, what is still open, and what ANU needs to decide. For going live, see
`DEPLOYMENT.md`; for testing, `QA.md`.

## Controls in place

**Signing in**
- Students sign in with index number and password; staff and partners with email, password and an authenticator app (required). Authenticator secrets are encrypted in the database (AES-256-GCM); ten one-time recovery codes are issued.
- Passwords are hashed with Argon2id (OWASP settings) and must be at least 10 characters. No password is ever sent to anyone: new accounts get a one-time setup link, which is deleted from the database once sent.
- Five wrong passwords lock the account for 15 minutes. Reset codes expire after 10 minutes, allow five tries, and at most three are sent to one account per hour.
- Sessions use httpOnly cookies (secure over HTTPS in production). Refresh tokens rotate; reusing an old one ends the session and is logged. People can see and end their own sessions.

**Who can do what**
- Every screen and API route is guarded by a permission from the person's active role. Routes without a permission (a person's own data) are limited to the owner in code; `scripts/qa/list-open-routes.py` fails the build if a new unguarded route appears without review.
- Super Admins run the platform but cannot make academic or financial decisions (results, exams, fee clearance, hostels, library, marketplace, employment).
- The Developer role only works while a Super Admin grant is active and expires.
- Student Dispatcher is an add-on role granted and removed only by the dispatcher approval process.

**Web and API**
- The browser only talks to the website's own address (the website forwards `/api`), so cookies are first-party. Writes need a custom header (CSRF protection); CORS allows only the website.
- Security headers on the API (helmet) and the website: a content security policy (no content from other sites, no framing, no plugins), HSTS, no-sniff, strict referrer policy, and camera, microphone and payment features switched off (location is allowed for this site only, for the dispatcher's delivery page).
- All input is validated; unknown fields are rejected. Errors never reveal internals, only a reference number to quote to support.
- 120 requests a minute per address.

**Money**
- Payments count only after the server verifies them with Paystack; amount and currency must match. Paystack webhooks are checked by signature. A payment is applied exactly once. Refunds are automatic when a paid order is cancelled, and failed refunds are logged for Finance.
- Campus dispatchers are paid their fee by whoever holds it: Finance for fees paid through Paystack, the vendor for fees included in a cash or MoMo payment to the vendor, or the customer on delivery. Each delivery records which, so Finance only pays out what the university collected.
- Payouts through Paystack Transfers need the right permission and a fresh authenticator code, cannot exceed the amount owed, and are recorded only when Paystack confirms them.
- A dispatcher's location is shared only while they carry an order, only with that order's customer, never with vendors, and is cleared at delivery.
- Vendors tick cash and MoMo orders as paid themselves (with the MoMo transaction ID); the customer is told at once, and each tick is in the activity log.
- Payments in the other currency (cedis towards a dollar bill) are converted at the Accounts office's rate in force on the payment date; the original amount and rate are kept on the payment and its receipt.
- Receipts and statements are also generated as PDFs by the server, only for the student they belong to (or Finance, or for dues the association's officers and the Dean of Students office).
- Fee payments recorded from bank slips cannot be recorded twice (the slip number is unique per method), and are reversed with a reason rather than deleted.
- Every departmental dues payment gets a numbered receipt that is sent to the student by SMS, including cash recorded by an officer, so a student would notice a payment that was not recorded or one they never made. Only the Dean of Students office can cancel a receipt.

**Records**
- Every significant action is in the activity log with who, what, when and the result. The log is append-only in the database itself (a trigger refuses changes and deletions).
- Row-level security is on for every table, so Supabase's public API cannot read data; `pnpm db:deploy` re-applies it after every migration.
- CSV downloads neutralise spreadsheet formulas typed into names or notes.
- Private documents (hostel forms, signed forms, excuse evidence such as medical notes) are stored in Cloudinary as "authenticated" files with no public address. The API gives a five-minute signed download link only to people allowed to see a document (the student, and the staff who handle it), and records every opening of a private document in the activity log.
- Photos are uploaded by the browser straight to Cloudinary with a short-lived signature the API creates only after checking the person owns the dish or hostel. The signature fixes the folder and allowed formats; the API refuses any photo from outside that folder. The Cloudinary API secret never reaches the browser. The content security policy allows images only from Cloudinary's delivery address and uploads only to its API.

**Production safety**
- The API refuses to start in production with demo mode, simulated payments or SMS, missing email, an address that is not https, placeholder or shared secrets, or any demo account in the database.
- The seed loads only reference data in production and refuses demo data.
- Expired sessions, reset codes and setup links are cleaned up nightly.

## Known gaps and residual risks

- **The platform has not yet been run end to end** (see `QA.md`). The first CI run is the first real install.
- **No independent penetration test.** Recommended before or soon after launch, especially of sign-in, payments and role changes.
- **Dependencies have not been audited** (the CI runs `pnpm audit` once packages install). Keep them updated.
- **The content security policy allows inline scripts**, which Next.js needs unless per-request nonces are added. Other protections (validation, output encoding by React, no framing) reduce the risk; nonces are a worthwhile later improvement.
- **Rate limits are per address.** Many students share an address on campus Wi-Fi, so limits must stay generous; account lockout and reset-code limits protect individual accounts. A web application firewall or per-account limits could be added if abuse appears.
- **Paystack and Arkesel integrations are written to their published APIs but untested live.** Test with test keys before launch.
- **Demo credentials are public** (`DEMO_ACCOUNTS.md`). This is intended for demos; the production checks make sure they can never exist in production.

## Decisions for ANU

- **Data protection.** Under Ghana's Data Protection Act, 2012 (Act 843), ANU processes students' and staff personal data as a data controller. Confirm the university's registration with the Data Protection Commission covers this platform, name who handles requests from people to see or correct their data, and update the privacy notice students and staff see.
- **How long to keep records.** The platform keeps the activity log, notifications and academic records indefinitely; only sign-in records are cleaned up. ANU's records policy should set periods (for example, the activity log for a fixed number of years), which can then be added as clean-up jobs.
- **Who holds the keys.** Decide who in ICT holds the production secrets and the Supabase and Paystack accounts, with at least two people able to act.
- **Reporting problems.** Name a contact (for example security@anu.edu.gh) for anyone who finds a security problem.


## Content security policy (nonce-based)

Every page gets a fresh random nonce from `frontend/src/proxy.ts`, and a Content-Security-Policy that runs only scripts carrying it (`script-src 'self' 'nonce-...' 'strict-dynamic'`); `'unsafe-inline'` is no longer allowed for scripts. Next.js adds the nonce to its own scripts, and the root layout gives it to the theme script. Pages are therefore rendered per request. Inline styles remain allowed (`style-src 'unsafe-inline'`), because React style attributes need them; this is the usual trade-off and carries far less risk than inline scripts. Tests in `frontend/src/lib/csp.spec.ts` fail if the script policy is ever loosened.

## Uploads

The size of every photo and document is checked with Cloudinary after upload (photos 5 MB, documents 10 MB, e-books 50 MB) rather than trusted from the browser; files over the limit are deleted and refused. Replaced or removed photos are deleted from Cloudinary by a queued job, retried if Cloudinary does not answer.

## Records retention

Set by the Super Admin under **Records retention**, as ANU decides (for example under the Data Protection Act, 2012 (Act 843) and audit requirements). The nightly clean-up removes read notifications (default after 365 days), copies of sent emails and texts (180 days) and online payments never completed (90 days); completed payments are never removed. The activity log is kept for good by default. If a period is set (at least one year), entries older than that are removed through the database function `purge_activity_log`, the only way past the append-only rule (`backend/prisma/sql/03_audit_retention.sql`, applied by `pnpm db:deploy`).

## Independent penetration test

To be done by an independent firm before or soon after launch. Suggested scope: sign-in (index number, staff email with authenticator codes, password reset and set-up links, lock-outs); access between roles and scopes (Heads of Department and advisors within their departments, owners and vendors only their own records, students only their own); payments and payouts (Paystack webhooks, amounts, transfers needing authenticator codes); uploads and private documents (signed uploads, five-minute download links); the content security policy; the data import; and the API's rate limits. Give the testers a copy of the platform with demo data, not live student records.
