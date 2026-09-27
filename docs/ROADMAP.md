# Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: accounts with emailed setup links, index numbers, staff MFA, 32 roles, Developer access, activity logs, notifications, dashboard shell, theming | Done |
| 2 | Academic management, in three slices: (a) semesters, curriculum, course offerings, lecturer assignment, course registration and approval, class lists; (b) internal marks, results approval, publishing, GPA, with email and SMS alerts; (c) exam timetable and exam eligibility, with alerts | Done |
| 3 | Class attendance, self check-in, excused absences, reports, and attendance as an exam eligibility rule | Done |
| 4 | Morning devotion: Mon, Tue, Thu, Fri; early 7:30 to 7:50, late 7:50 to 8:00; semester score out of 5.00 | Done |
| 5 | Accommodation: university hostels with priority allocation, verified private hostels with booking, and where every student lives | Done |
| 6 | Library: catalogue, circulation desk, renewals, reservations queue, fines and reminders | Done |
| 7 | Food marketplace: vendor approval, menus, opening hours, pickup and delivery, Paystack payments (mobile money and card) or pay at the counter, order tracking, refunds, vendor settlements | Done |
| 8 | Student employment: campus jobs with CGPA eligibility, applications and hiring; student dispatchers paid per delivery; dispatcher settlements | Done |
| 9 | Quality assurance: static checks (schema, wiring, design rules, open-route review), rule tests, end-to-end smoke test; see `docs/QA.md` | In progress: checks that need no packages done; first real run pending |
| 10 | Security hardening and launch preparation: production safety checks, production seed and first-admin command, account suspension, reset-code limits, housekeeping, website security headers, CI pipeline, go-live runbook (`docs/DEPLOYMENT.md`), security review (`docs/SECURITY.md`) | Built; launch waits for the first CI run (Phase 9) |

## Open questions for ANU

- Index number level codes: degree is assumed to be `4` (ANU25**4**00001). Diploma (`2`) and postgraduate (`6`) are placeholders until the Registry confirms them.
- Which SMS provider ANU already has a contract with (Arkesel is implemented; Hubtel or mNotify can be added).
- Student employment: the minimum CGPA (2.50 assumed), whether first-year students without results may work (assumed yes), how many jobs a student may hold (1 assumed), and the dispatcher fee per delivery (GH₵ 4.00 assumed). All are settings in Employment rules.
- Payments: whether ANU has a Paystack account (or prefers Hubnet, ExpressPay or a bank gateway), whether the university takes a commission from vendors, and how often vendors are paid.
- Morning devotion: how the 5.00 score is used (a standalone record or part of a course result), and who is exempt.
- Library fine amounts (currently GH₵ 1.00 a day, capped at GH₵ 50.00; changeable in Library rules).

## Known simplifications in Phase 2a

- An Academic Advisor reviews every student in their department. Assigning individual advisees to advisors can come later.
- Students see the courses in their programme curriculum for their current level. Carry-over (resit) courses and electives from other levels come with results in Phase 2b, since they depend on failed grades.
- An approved registration can only be changed by the department (planned: a "reopen" action for Heads of Department and the Registry).

## Phase 2b notes

- Grading scale: editable by the Registry. Each save is a new version; results keep the version they were graded with.
- Totals are rounded to a whole number (half up) before grading. Missing an exam gives IC (incomplete), which is left out of the GPA.
- Approval chain: lead lecturer submits, Head of Department approves, Dean approves, Exam Coordinator or Registrar publishes. Any approver can return results with a note. Super Admins cannot approve or publish.
- Students see continuous assessment only when the lead lecturer shares it (a snapshot, so later edits stay private until shared again), and exam marks only through published results.
- Planned next: result amendments after publication (with a formal approval trail), carry-over courses for failed grades, and class of degree.

## Phase 2c notes

- Exam timetable: papers with date, time, length, venue, invigilators and a note. Checked for student clashes, venue seats (papers may share a hall within its seats) and invigilator clashes. Clashes block publishing; missing venues and unscheduled papers are warnings.
- Students only see the published copy. Republishing notifies only students whose papers changed, listing the changes.
- Eligibility rules: fee clearance (can be switched off by the Registry or Exam Coordinator) and exam holds (one paper or all papers). Overrides need a reason and survive recalculation. Publishing notifies only students whose status changed. SMS gives counts only.
- Planned: attendance threshold as a rule (Phase 3), invigilator duty notifications, seat numbers per student, and an exam attendance register.

## Phase 3 notes

- Lecturers add classes once (with weekly repeats) and take attendance by self check-in or by marking the register. Teaching assistants can do the same.
- Self check-in: a 6-character code that changes every 30 seconds, plus a QR code. The current and previous codes are accepted. Check-in closes by itself after the set time (a job runs every 5 minutes); anyone who did not check in is then marked absent.
- Late counts as attended. Excused absences are left out of the calculation entirely.
- Excuses are recorded by Health Services or the Dean of Students for a date range, apply to past and future registers, and can be withdrawn. Lecturers see only "Excused".
- Students are warned once when they fall below the minimum (after a set number of classes), and warned again only if they recover and drop again.
- Attendance is an exam eligibility rule that can be switched off. Courses with no recorded classes are not checked.
- Planned: a location or Wi-Fi check to make check-in harder to share, and students requesting excuses themselves with documents.

## Phase 4 notes (morning devotion)

- Statuses: early (arrive before 7:50, including before 7:30), late (7:50 to 8:00), absent (not recorded by 8:00), excused. There is no "on time".
- Score out of 5.00 = 5.00 x (early + late x 0.5) / services counted. Excused and cancelled services are not counted. Early every time is exactly 5.00. The total and the late share are settings; late must earn less than early.
- Recording: self check-in with a rotating code and QR code on the projector, and door entry by ushers (typing or scanning index numbers). The arrival time sets early or late.
- Expected students are those with an approved course registration that semester. Services close themselves after 8:00; anyone not recorded becomes absent or excused.
- Service times are copied from the rules when scheduled, so changing the rules does not alter past services.
- The Chaplaincy finalises scores at the end of the semester; students are told their score. Finalising again after corrections only tells students whose score changed.
- Not yet: exemptions for specific students, and passing the 5.00 into a course result. Tell us how ANU uses the score and it can be added.

## Phase 5 notes (accommodation)

- University halls are single-gender. Allocation order: confirmed special needs, first years, final years, then continuing students, each first come first served. Partly filled rooms fill first. It never exceeds a room's beds or places a student in a hall for the other gender.
- Running allocation creates provisional places only the Hostel Office sees. Publishing turns them into offers with a deadline (5 days by default); unanswered offers expire every 15 minutes and free the bed. Running again offers freed beds to the waiting list.
- Private hostels are created by owners with partner accounts (same setup link and authenticator sign-in as staff) and are hidden from students until the Hostel Office verifies them. Accepting a booking takes a bed off the free count in a way two acceptances cannot both take the last bed.
- A student can hold one place a semester: accepting a university room is blocked while they have a confirmed private booking, and the other way round.
- Owners see a student's name, index number, phone and email, nothing academic.
- Not yet: payment of hostel fees (planned with payments), photos of private hostels (needs file storage), roommate requests, hall check-in and check-out, and complaints about private hostels.

## Phase 6 notes (library)

- Due dates fall at the end of the day and never on a closed day (Sunday by default).
- Fines are charged when an overdue book comes back (days late x daily rate, after any grace days, capped per book), or the lost-book fee when a book is declared lost. Fines are paid at the desk (cash or mobile money with a receipt number) or waived by the Librarian with a reason.
- Borrowing stops at the item limit, with any overdue book, or at the fine limit. Renewal is refused when overdue, out of renewals, or reserved by someone else.
- Returned copies go to the next person in the reservation queue and are kept for a set number of days; uncollected copies pass along the queue automatically.
- Reminders: before the due date, the day after, then weekly (at most three), only between 07:00 and 20:00.
- Two desks cannot issue the same copy at once.
- Not yet: paying fines online, library clearance for graduation, e-books and journals, inter-library loans, and linking reading lists to courses.

## Phase 7 notes (food marketplace)

- Vendors are partner accounts created by the Dean of Students office (or Finance). The owner gets a setup link; the shop stays hidden until approved. Suspending a shop hides it at once.
- Customers are students and staff. Orders are only taken in the vendor's opening hours, unless paused. A customer can have at most 3 orders on the go. Sold-out dishes, a changed menu and minimum orders are checked on the server.
- Order steps: waiting for payment, placed, accepted (preparing), ready for pickup or out for delivery, completed. Customers can cancel only before the vendor accepts. Vendors must give a reason to decline or cancel. To complete, the vendor types the customer's 4-digit code, which the vendor's screen never shows.
- Payments: set `PAYMENTS_PROVIDER=paystack` and `PAYSTACK_SECRET_KEY`, and in the Paystack dashboard set the webhook URL to `https://<api-host>/api/v1/payments/paystack/webhook`. Customers pay by mobile money or card on Paystack's page. A payment only counts once the server has verified it with Paystack (from the return page, the webhook, or a final check before an unpaid order expires), and the amount and currency must match. Webhooks are checked with Paystack's HMAC-SHA512 signature. Payments are confirmed exactly once even if the webhook and the return page arrive together.
- The Paystack integration is written to Paystack's published API but has not been run against a live or test Paystack account in this build environment. Test it with Paystack test keys before launch.
- `PAYMENTS_PROVIDER=demo` (the default) uses a marked test checkout inside the platform; it refuses to start in production.
- Refunds happen automatically when a paid order is declined or cancelled, or when a payment arrives after its order expired. Paystack refunds complete later and are marked refunded by webhook. A refund that fails is logged for Finance to resolve.
- Online payments are collected into the university's account. **Vendor settlements** shows, per vendor and period, online sales, commission (0% by default), payouts recorded and what is owed. Recording a payout does not send money; Finance pays by mobile money and records the transaction ID. Pay-at-counter money goes straight to the vendor.
- Vendors deliver with their own staff for now. Student dispatchers come with Phase 8.
- Not yet: automatic payouts through Paystack transfers, ratings and reviews, meal plans or student wallet, scheduled orders, photos of dishes, and receipts as PDFs.

## Phase 8 notes (student employment and dispatchers)

- Eligibility is checked from live data every time: CGPA from published results (the same calculation as the student's results page), an approved course registration this semester, and no disciplinary or academic misconduct hold (fee and administrative holds do not count). A job can ask for a higher CGPA than the university minimum. Students with no results yet may apply unless the rule is switched off.
- Campus jobs: Career Services (and the Dean of Students office) post jobs as drafts, open them, and review applicants with their CGPA and a flag if they do not meet the rules. Hiring re-checks eligibility and the number of places inside a transaction. Hired students whose standing changes are flagged, not dismissed automatically. Jobs close by themselves on their closing date (daily at 05:00).
- Dispatchers: students apply with a statement and a mobile money number. Approval adds the Student Dispatcher role as an add-on to the Student role, so they never switch roles. Every morning at 05:00, active dispatchers who no longer meet the rules are suspended automatically (once they have no delivery in hand) and told why.
- Deliveries: vendors choose to use campus dispatchers. Those orders must be paid online, so students never carry cash. When the vendor marks an order ready, online dispatchers are told; the first to take it gets it (a single conditional update). Only the hall is shown until a delivery is taken. The dispatcher confirms collection, then completes the order with the customer's 4-digit code. They can hand a delivery back before collecting it, or report a problem to the vendor. A dispatcher carries at most 2 deliveries at once and cannot deliver their own order. Vendors are alerted if nobody takes an order within 15 minutes, and can send it with their own staff. Dispatchers who stop opening the Deliveries page are taken offline after 20 minutes.
- Pay: dispatchers earn a fixed fee per completed delivery (GH₵ 4.00 by default), deducted from the vendor's settlement. Finance records mobile money payouts to dispatchers on Vendor settlements; the student is told by SMS. Cancelled deliveries earn nothing, even if the food had been collected.
- Also in this phase: every password field has a show/hide button.
- Not yet: timesheets and payroll for hourly campus jobs, internships and external job listings, dispatcher ratings, live location tracking, and automatic payouts through Paystack transfers.

## Phase 9 notes (quality assurance)

- The build environment has no internet access or database, so the platform has not yet been installed or started. Everything that could be checked without packages was, and is repeatable with `pnpm qa`. Details, results and the first-run checklist are in `docs/QA.md`.
- Found and fixed: a duplicate database enum name (`DeliveryStatus`) that would have stopped `prisma generate`; spreadsheet formula injection in four CSV downloads.
- Phase 9 is complete once the first-run checklist in `docs/QA.md` passes on a real machine: `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm qa:smoke`.

## Phase 10 notes (security and launch preparation)

- The API refuses to start in production with unsafe settings (demo mode, simulated payments or SMS, no email, non-https address, placeholder or shared secrets) or with demo accounts in the database.
- `NODE_ENV=production pnpm db:seed` loads only reference data; `pnpm admin:create` creates the first Super Admin with an emailed setup link.
- `pnpm db:deploy` now applies migrations and then re-applies the database hardening (append-only activity log, row-level security), which new tables from Phases 4 to 8 needed.
- New: administrators can suspend, deactivate and reactivate staff and partner accounts (signs them out everywhere at once). Reset codes are limited to three per account per hour. Old sessions and codes are cleaned up nightly.
- `.github/workflows/ci.yml` installs everything, type-checks, tests, builds, and runs the smoke test against a real database. Pushing the project to GitHub gives the first real run that Phase 9 is waiting for.
- Not yet: independent penetration test, nonce-based content security policy, suspending student accounts from the Registry screens, records-retention periods (an ANU decision; see `docs/SECURITY.md`).

## Fees and departmental dues (added after Phase 10)

- **Fees.** Finance sets fee schedules per semester, for everyone or for a programme and/or level (the most specific applies), and issues bills. Students pay online (mobile money or card) or at the bank, where Finance records the slip; the same slip cannot be recorded twice. Scholarships, waivers and extra charges are adjustments with a reason. Payments recorded in error are reversed, not deleted.
- **Automatic fee clearance.** Once a student has paid the set percentage (70% by default, set by Finance) they are cleared for exams; if a reversal or charge takes them below it, that automatic clearance is withdrawn. Clearances Finance sets by hand are never changed by the rule.
- **Departmental dues.** Associations (EHASSA, BACA and others) are linked to departments by the Dean of Students office, which records each elected president and treasurer for a term. Officers get an **Association dues** screen for their term only (an add-on to their student account, like dispatchers), set dues, see who has paid, and record cash. Every payment, cash or online, has a numbered receipt sent to the student by SMS; only the Dean of Students office can cancel one. Online dues are held by the university and paid out to the association's account by Finance.
- To confirm with ANU: the real clearance percentage; whether international students pay in US dollars (the platform currently bills in cedis only); what EHASSA and BACA stand for and which departments each covers; whether dues are compulsory.
- Not yet: fee instalment plans with deadlines, late-payment penalties, bank statement import, and printed PDF receipts.
