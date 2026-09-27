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
- Security headers on the API (helmet) and the website: a content security policy (no content from other sites, no framing, no plugins), HSTS, no-sniff, strict referrer policy, and camera, microphone, location and payment features switched off.
- All input is validated; unknown fields are rejected. Errors never reveal internals, only a reference number to quote to support.
- 120 requests a minute per address.

**Money**
- Payments count only after the server verifies them with Paystack; amount and currency must match. Paystack webhooks are checked by signature. A payment is applied exactly once. Refunds are automatic when a paid order is cancelled, and failed refunds are logged for Finance.
- Campus dispatchers never handle cash.
- Fee payments recorded from bank slips cannot be recorded twice (the slip number is unique per method), and are reversed with a reason rather than deleted.
- Every departmental dues payment gets a numbered receipt that is sent to the student by SMS, including cash recorded by an officer, so a student would notice a payment that was not recorded or one they never made. Only the Dean of Students office can cancel a receipt.

**Records**
- Every significant action is in the activity log with who, what, when and the result. The log is append-only in the database itself (a trigger refuses changes and deletions).
- Row-level security is on for every table, so Supabase's public API cannot read data; `pnpm db:deploy` re-applies it after every migration.
- CSV downloads neutralise spreadsheet formulas typed into names or notes.

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
