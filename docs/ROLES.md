# Roles

A **staff member can hold several roles** (for example Lecturer and Head of Department) and switches between them in the sidebar. Only a Super Admin assigns roles. Each session acts in one role at a time, and every action is logged under that role's group.

"Today" is what the role can do in Phase 1. The "Tools arrive" column is when its main module is built. Permissions are added to the same roles as each phase lands, so nobody needs to be re-assigned.

## Staff roles (assigned by a Super Admin)

| Area | Role | Tied to | One holder only | Purpose | Today | Tools arrive |
| --- | --- | --- | --- | --- | --- | --- |
| University leadership | Vice-Chancellor | | Yes, university-wide | University-wide oversight and reports | View students, staff and all activity | Phase 2 onward (reports) |
| | Pro Vice-Chancellor | | | Academic oversight and reports | View students and staff | Phase 2 onward |
| Academic | Dean | School | Yes, per school | Oversees one school, approves its results | Course offerings, registration approvals and second approval of results for the school | Now |
| | Head of Department | Department | Yes, per department | Assigns courses, approves department results | Course offerings, lecturers, registration approvals and first approval of results | Now |
| | Programme Coordinator | Department | | Programme structure and course registration | Course offerings and registration approvals for the department | Now |
| | Academic Advisor | Department | | Advises students, approves course registration | Registration approvals for the department | Now |
| | Lecturer | | | Teaching, attendance, internal marks | Attendance (self check-in and registers), class lists, marks, sharing marks, submitting results (lead lecturer) | Now |
| | Teaching Assistant | | | Helps with attendance and assessment | Attendance, class lists and marks entry | Now |
| Registry and exams | Registrar | | | Student records, academic structure | Register students, semesters, grading scale, all offerings and approvals, publish results | Now |
| | Admissions Officer | | | Admissions, registering new students | Register and view students | Phase 1 (now) |
| | Exam Coordinator | | | Exam timetable, eligibility, results publishing | Exam venues, timetable, eligibility, exam holds, publishing results | Now |
| | QA Officer | | | Quality assurance, lecturer evaluations | View students | Phase 9 |
| Student services | Dean of Students | | Yes, university-wide | Welfare, conduct and discipline | Exam holds and excused absences; approving and suspending food vendors; campus jobs and dispatchers; departmental associations, their elected officers, and cancelling dues receipts | Later phase (welfare, discipline cases) |
| | Counsellor | | | Confidential counselling | View students | Later phase |
| | Chaplaincy Officer | | | Morning devotion | Schedules services, projector code, door entry, corrections, rules and final scores out of 5.00 | Now |
| | Health Services Officer | | | Clinic visits, medical excuses for absence | Records excused absences, which cover classes and morning devotion | Now |
| | Career Services Officer | | | Internships, campus jobs, dispatcher approval | Post campus jobs, review and hire applicants against CGPA rules, approve and suspend dispatchers, employment rules | Internships later |
| | Hostel Manager | | | University hostels and allocations | Halls and rooms, applications, allocation and offers, verifying private hostels, owner accounts | Now |
| Library | Librarian | | | Catalogue, policies and fines | Catalogue, circulation desk, fines including waivers, library rules | Now |
| | Library Assistant | | | Issues and receives books | Circulation desk, reservations shelf, taking fine payments | Now |
| Finance, HR, ICT, security | Finance Officer | | | Fees, payments, financial clearance | Fee clearance for exams, including pasted lists of index numbers; food vendor settlements and payouts, including dispatcher payouts; fee schedules, bills, bank payments, waivers, the fee clearance rule, and dues payouts to associations | Online fee payments later |
| | HR Officer | | | Staff records | View staff | Later phase |
| | ICT Support | | | Sign-in help, failed messages | View students and staff, failed messages | Phase 1 (now) |
| | Security Officer | | | Campus and hostel access records | Where every student lives this semester | Now |
| | Internal Auditor | | | Read-only review of activity | View and export all activity | Phase 1 (now) |
| Platform administration | Super Admin | | At least one must always remain | Accounts, roles, settings, Developer access | Everything except diagnostics | Phase 1 (now) |

## Roles that are not assigned from the staff screen

| Role | Who | How they get it |
| --- | --- | --- |
| Developer | ICT staff working on the platform | A Super Admin enables it temporarily, with a reason and optional expiry |
| Student | Every registered student | Automatically at registration |
| Association Officer | Elected president or treasurer of a departmental association (EHASSA, BACA...) | Recorded by the Dean of Students office for a term; added on top of the Student role and removed automatically when the term ends |
| Student Dispatcher | Students who deliver campus orders, paid per delivery | Added on top of the Student role when Career Services approves them (CGPA, registration and hold checks). Never switched into; removed on suspension |
| External Examiner | Examiners from other universities | Partner accounts (later phase) |
| Private Hostel Owner | Owners listing rooms for students | Account created by the Hostel Manager; listings verified before students see them |
| Cafeteria Manager / Vendor | Food vendors on campus | Account created by the Dean of Students office or Finance; the shop is hidden until approved. Manages their own menu, hours and orders only |

## Activity log groups

Super Admins (and the Vice-Chancellor and Internal Auditor) see all activity grouped as: Students, Lecturers and academic staff, Library staff, Non-teaching staff, University management, External partners, Developers, and Super Admins.

## Adding a role later

1. Add the key to `ROLE_KEYS` and its area to `STAFF_ROLE_CATEGORY` in `shared/src/roles.ts`.
2. Add its log group in `shared/src/log-groups.ts` (TypeScript refuses to build until you do).
3. Add its name, description and permissions to `ROLE_DEFS` in `backend/prisma/seed/data.ts`, then run `pnpm db:seed`.

Super Admins manage accounts and settings but cannot approve or publish results. Academic decisions stay with academic roles.
