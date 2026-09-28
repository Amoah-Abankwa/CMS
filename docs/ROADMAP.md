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
- Done since: individual exemptions and the 5.00 in course totals (see later sections).

## Phase 5 notes (accommodation)

- University halls are single-gender. Allocation order: confirmed special needs, first years, final years, then continuing students, each first come first served. Partly filled rooms fill first. It never exceeds a room's beds or places a student in a hall for the other gender.
- Running allocation creates provisional places only the Hostel Office sees. Publishing turns them into offers with a deadline (5 days by default); unanswered offers expire every 15 minutes and free the bed. Running again offers freed beds to the waiting list.
- Private hostels are created by owners with partner accounts (same setup link and authenticator sign-in as staff) and are hidden from students until the Hostel Office verifies them. Accepting a booking takes a bed off the free count in a way two acceptances cannot both take the last bed.
- A student can hold one place a semester: accepting a university room is blocked while they have a confirmed private booking, and the other way round.
- Owners see a student's name, index number, phone and email, nothing academic.
- Not yet: roommate requests and complaints about private hostels (hostel fees, photos, check-in and check-out are done; see later sections).

## Phase 6 notes (library)

- Due dates fall at the end of the day and never on a closed day (Sunday by default).
- Fines are charged when an overdue book comes back (days late x daily rate, after any grace days, capped per book), or the lost-book fee when a book is declared lost. Fines are paid at the desk (cash or mobile money with a receipt number) or waived by the Librarian with a reason.
- Borrowing stops at the item limit, with any overdue book, or at the fine limit. Renewal is refused when overdue, out of renewals, or reserved by someone else.
- Returned copies go to the next person in the reservation queue and are kept for a set number of days; uncollected copies pass along the queue automatically.
- Reminders: before the due date, the day after, then weekly (at most three), only between 07:00 and 20:00.
- Two desks cannot issue the same copy at once.
- Not yet: library clearance for graduation, e-books and journals, inter-library loans, and linking reading lists to courses (fines can be paid online).

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
- Not yet: automatic payouts through Paystack transfers, ratings and reviews, meal plans or student wallet, and scheduled orders (dish photos are done).

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
- Not yet: independent penetration test, nonce-based content security policy, records-retention periods (an ANU decision; see `docs/SECURITY.md`). Suspending student accounts is done.

## Fees and departmental dues (added after Phase 10)

- **Fees.** Finance sets fee schedules per semester, for everyone or for a programme and/or level (the most specific applies), and issues bills. Students pay online (mobile money or card) or at the bank, where Finance records the slip; the same slip cannot be recorded twice. Scholarships, waivers and extra charges are adjustments with a reason. Payments recorded in error are reversed, not deleted.
- **Automatic fee clearance.** Once a student has paid the set percentage (70% by default, set by Finance) they are cleared for exams; if a reversal or charge takes them below it, that automatic clearance is withdrawn. Clearances Finance sets by hand are never changed by the rule.
- **Departmental dues.** Associations (EHASSA, BACA and others) are linked to departments by the Dean of Students office, which records each elected president and treasurer for a term. Officers get an **Association dues** screen for their term only (an add-on to their student account, like dispatchers), set dues, see who has paid, and record cash. Every payment, cash or online, has a numbered receipt sent to the student by SMS; only the Dean of Students office can cancel one. Online dues are held by the university and paid out to the association's account by Finance.
- Confirmed by ANU: the Registrar's office sets the clearance percentage; international students are billed in US dollars; EHASSA is the Engineering and Health and Allied Science Students Association and BACA the Business and Accounting Students Association; dues are compulsory.
- Not yet: fee instalment plans with deadlines, late-payment penalties and bank statement import (PDF receipts are done).

## Registry and fee updates

- **Registry.** The Registrar creates, edits and removes schools, departments and programmes, and links programmes to departments. Each programme has a type: Bachelor's regular (8 semesters), Bachelor's weekend (12), Diploma, Graduate School, or any the Registrar adds; a programme can override its type's number of semesters. Programmes with students are marked "not admitting" rather than removed.
- **Index numbers.** The Registrar sets the index number format for each programme type, from tokens: {YY}/{YYYY} admission year, {CODE} the type's code, {SEQ:n} the running number (e.g. ANU{YY}{CODE}{SEQ:5} gives ANU25400001; ANUGS{YY}{SEQ:4} gives ANUGS250001). Formats that could repeat or clash are refused. Changing a format affects new students only. Sign-in accepts any configured format.
- **Fees.** The Accounts office keeps the list of fee items, and every schedule, bill, statement and receipt uses those labels. Schedules are for Ghanaian, international or all students, in cedis or US dollars; international students are billed in dollars. Online dollar payments need USD enabled on the university's Paystack account; otherwise they pay at the bank. Students see a statement (debits, credits, running balance) and a receipt for every payment, both printable or saved as PDF from the browser. The clearance percentage is set by the Registrar.
- **Student dashboard** shows CGPA, fees balance and clearance, and compulsory dues outstanding.
- Diploma index numbers start with D and the programme's initials, set per programme by the Registrar as its index code: DCE (Diploma in Computer Engineering), DBM (Diploma in Biomedical Engineering), DOE (Diploma in Oil and Gas Engineering). The format part {PROG} puts it in the number; each programme has its own sequence, and a code cannot change once students hold numbers with it.
- To confirm: what follows the diploma initials (currently the 2-digit year and a 4-digit running number, DCE260001), the Graduate School format, and whether any dues should affect clearance or registration (they are compulsory but do not block anything yet).
- Done since: server-generated PDFs and exchange rates.

## After the first real run

- **Email through Resend.** `EMAIL_PROVIDER=resend` with `RESEND_API_KEY`; verify the sending domain in Resend so mail does not land in spam. SMTP still works. A failed send is marked failed and appears on **Failed messages** for resending.
- **Student accounts can be suspended**, deactivated and reactivated by the Registry (with a reason and an authenticator check); suspending signs the student out everywhere.
- **Library fines can be paid online** from the student's Library page; the payment settles the fine, and a payment for an already-settled fine is refunded.
- **Hall fees are charged on the fee bill** when a student accepts a university hall place (the room's price), adjusted by the price difference on a move, and credited back on cancellation. Students pay them like other fees, and they count towards the exam clearance percentage. Bills in US dollars are skipped (logged) because room prices are in cedis; charge those at the hostel office.
- **Academic advisors.** Heads of Department (and the Registry) assign students to their own advisor. An advisor with advisees reviews only those students' registrations; one without advisees still reviews the whole department.
- **Photos through Cloudinary (signed uploads).** Vendors add a photo to each dish; private hostel owners add up to 8 photos (first is the cover), shown to students. The browser uploads straight to Cloudinary with a signature the API creates for a fixed folder and image formats; the API only accepts photos from that folder.
- Not yet: deleting replaced photos from Cloudinary (they stay in the account), a size limit enforced by Cloudinary (the browser checks 5 MB; set an upload preset limit in Cloudinary for full enforcement), profile photos.

## Results and exams (second round after the first run)

- **Result amendments.** A published result is corrected by request from the course's lead lecturer or the Exams Office, with the corrected scores and a reason. It is approved by the Head of Department, then the Dean, then applied by the Exams Office or Registrar, regraded on the scale the results were published with. The original stays on record; the student is told the before and after by email, SMS and in-app, and their GPA follows.
- **Carry-over courses.** A course whose latest published attempt was a fail is offered to the student again when it runs, whatever its level, marked "Carry-over" on the registration page. Incomplete (IC) results are not carry-overs; they are settled by an amendment. All attempts count towards the CGPA, as before; say if ANU uses best or latest attempt instead.
- **Exams.** The Exams Office numbers seats (papers sharing a hall at the same time get separate ranges; halls over capacity are listed) and sends each invigilator their duty list. Students see their seat on their exam timetable. Invigilators open the **Exam register** for their papers, mark present, late or absent (or type or scan index numbers), note incidents, and close it (anyone unmarked is recorded absent). Each candidate shows eligibility, fee clearance and any unpaid compulsory departmental dues; these are flags, not blocks.
- QA: `check-wiring.py` now also catches duplicate names in one import (a TypeScript error the syntax check missed); one was found and fixed in the sidebar.

## Money (third round after the first run)

- **Campus dispatcher fee paid by the customer.** At checkout the customer includes the dispatcher's fee in their payment or pays the dispatcher on delivery. Customers can pay online (Paystack, marked paid automatically) or pay the vendor directly in cash or by MoMo; the vendor ticks the order as paid with the MoMo transaction ID and the customer is told. Finance pays dispatchers only for fees paid through Paystack; vendors hand over fees included in a direct payment; customers pay on delivery otherwise. Vendors' settlements no longer lose the dispatch fee, and the commission is taken on the food only.
- **Exchange rates.** The Accounts office adds dated rates (cedis per US dollar). Dollar bills show the cedi equivalent, and a payment made in the other currency is converted at the rate in force on its date, keeping the original amount and rate on the receipt.
- **PDFs generated by the server** for fee receipts, fee statements and dues receipts (the browser print view remains). The PDFs use standard fonts, so money reads GHS and USD rather than the cedi sign; embedding a font can change that.
- **Unpaid dues on exam registers** is off by default; each Head of Department can switch it on for their department. Nothing is ever blocked.

## Hostels and devotion (fourth round after the first run)

- **Morning devotion in course totals** (the Registrar's setting, on by default): assessments add up to 95% and each student's devotion score (out of 5.00) is added to every course. Weekend students are exempt from devotion (no longer expected at services) and their 95 is scaled to 100. Results cannot be submitted until the Chaplaincy has finalised devotion scores. Students see "incl. devotion 4.25" or "scaled from 95" beside each total; amendments keep the devotion part. Results published before this change are untouched.
- **Hostel fees** for university halls and private hostels are now their own account per placement, not a line on the tuition bill (anything charged there before is credited back automatically). The fee is the room's price once a hall place is accepted, or the room type's price once an owner accepts a booking; a move changes it and giving up the place sets it to zero. Students pay online (part or all); the Hostel Manager (halls) or the owner (private hostels) records cash, MoMo or bank payments. Every payment has a receipt and a PDF, sent to the student and to the Hostel Manager or owner. Online private hostel fees are paid out to owners by Finance (**Hostel owner payouts**).

## Documents and small rules (fifth round after the first run)

- **Private documents in Cloudinary.** Hostel forms, signed forms and excuse evidence are uploaded straight from the browser as "authenticated" files (no public address), with a signature that fixes the folder, the formats (PDF, JPG, PNG) and the private type; up to 10 MB. The API only gives a five-minute download link to people allowed to see a document, and records who opened private ones.
- **Hostel forms.** The Hostel Manager (for all halls or one hall) and owners (their hostels) upload blank forms such as the tenancy agreement and registration form. Students placed there download, sign and upload them back; the hostel accepts or returns them with a note.
- **Check-in and check-out.** The Hostel Manager (halls) and owners (private hostels) check residents in and out with a note (keys, room condition). **Residents** shows everyone placed this semester, who is in, and their forms.
- **Excuse requests.** Students ask to be excused for a date range with a reason and a document (required for illness). The Health Centre or Dean of Students office excuses or declines; excusing records the excuse, which corrects class attendance and morning devotion.
- **Individual devotion exemptions** by the Chaplaincy for the semester: exempt students are not expected at services and their course marks out of 95 are scaled to 100, like weekend students.
- **Reopening an approved registration** by the advisor, Head of Department or Registry, with a reason, until results for any of its courses are submitted. The student changes it and submits again.
- Next: the library (graduation clearance, e-books, inter-library loans, course reading lists).
