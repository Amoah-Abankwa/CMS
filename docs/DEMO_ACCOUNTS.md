# Demo accounts

> These accounts share a published password and authenticator secret. They are for demonstrations only and can never be used in production: the production seed refuses to create them, and the API refuses to start in production if any exist.

All people, emails and phone numbers are fictional. Never load this seed into production.

**Password for every seeded demo account:** `AnuDemo#2025`

Seeded accounts are already set up so you can sign in straight away. Accounts you create during a demo start as "Awaiting setup" and receive a setup link instead of a password. In development the email is printed in the API console; copy the link from there.

## Staff (email sign-in at /staff/login)

Every staff account uses two-step verification. For the demo, all staff share one authenticator secret. Add it to Google Authenticator or Microsoft Authenticator as a manual key:

```
KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD
```

| Email | Name | Role(s) |
| --- | --- | --- |
| superadmin@demo.anu.edu.gh | Kwabena Asante | Super Admin |
| superadmin2@demo.anu.edu.gh | Efua Boateng | Super Admin |
| registrar@demo.anu.edu.gh | Samuel Ofori | Registrar |
| exams@demo.anu.edu.gh | Grace Mensah | Exam Coordinator |
| librarian@demo.anu.edu.gh | Abena Owusu | Librarian |
| hostels@demo.anu.edu.gh | Yaw Darko | Hostel Manager |
| lecturer.cs@demo.anu.edu.gh | Dr Daniel Agyeman | Lecturer, Head of Department of Computer Science (can switch role) |
| lecturer.acc@demo.anu.edu.gh | Dr Comfort Adjei | Lecturer |
| advisor.cs@demo.anu.edu.gh | Dr Mercy Opoku | Lecturer, Academic Advisor for Computer Science |
| coordinator.sba@demo.anu.edu.gh | Joseph Antwi | Programme Coordinator for Accounting and Finance, Lecturer |
| finance@demo.anu.edu.gh | Rita Asamoah | Finance Officer |
| deanofstudents@demo.anu.edu.gh | Rev Francis Nyarko | Dean of Students |
| health@demo.anu.edu.gh | Janet Boakye | Health Services Officer |
| chaplaincy@demo.anu.edu.gh | Rev Samuel Kyei | Chaplaincy Officer |
| hostels.security@demo.anu.edu.gh | Michael Tetteh | Security Officer |
| careers@demo.anu.edu.gh | Gifty Amoako | Career Services Officer (campus jobs and dispatchers) |
| libdesk@demo.anu.edu.gh | Priscilla Asiedu | Library Assistant |
| vc@demo.anu.edu.gh | Prof Emmanuel Kwarteng | Vice-Chancellor |
| admissions@demo.anu.edu.gh | Linda Sarpong | Admissions Officer |
| ict@demo.anu.edu.gh | Isaac Boadu | ICT Support |
| auditor@demo.anu.edu.gh | Patience Ansah | Internal Auditor |
| dev.candidate@demo.anu.edu.gh | Kofi Amponsah | Lecturer. Use him to demonstrate enabling Developer access |

## Private hostel owner (partner sign-in at /staff/login)

| Email | Name | Role |
| --- | --- | --- |
| owner@demo.anu.edu.gh | Comfort Ampofo | Private Hostel Owner: Koforidua Heights Hostel (verified) and Adweso Green Lodge (awaiting verification) |

Same password and authenticator secret as staff.

## Food vendors (partner sign-in at /staff/login)

| Email | Name | Shop |
| --- | --- | --- |
| vendor@demo.anu.edu.gh | Akua Sarfo | ANU Main Cafeteria, Student Centre (approved; pickup, or delivery to halls for GH₵ 5.00 by campus dispatchers; minimum order GH₵ 15.00; Monday to Friday 07:00 to 21:00, Saturday 09:00 to 18:00) |
| vendor2@demo.anu.edu.gh | Esi Mensah | Mama Esi's Kitchen, behind Grace Hall (approved; pickup only; weekdays 11:00 to 15:00 and 17:00 to 20:00) |
| vendor3@demo.anu.edu.gh | Kofi Adu | Campus Snacks Kiosk (waiting for approval) |

Same password and authenticator secret as staff. Payments run in **demo mode** unless Paystack is configured: checkout opens a clearly marked test page where you choose whether the payment succeeds.

## Students (index number sign-in at /login)

40 students were seeded across all demo programmes: 20 admitted in 2025 (now level 200) and 20 in 2026 (level 100).

- 2025 intake: `ANU25400001` to `ANU25400020`
- 2026 intake: `ANU26400001` to `ANU26400020`

Newly registered students get the next number in sequence, for example `ANU26400021`. Programmes rotate through the seven demo programmes. The Computer Science students, used in the walkthrough, are `ANU25400005`, `ANU25400012` and `ANU25400019` (2025 intake, level 200) and `ANU26400006`, `ANU26400013` and `ANU26400020` (2026 intake, level 100).

Campus jobs and dispatchers: `ANU26400006` is an approved campus dispatcher (no switching roles needed; **Deliveries** appears in their menu). `ANU25400012` has applied to be one. The 2025 Computer Science students are registered this semester, so their CGPA from last year's results decides whether they can work; the 2026 students have no results yet, which the default rules allow.

## Academic year in the demo

Library: 15 titles for the demo courses with barcodes `ANUL000001` onwards. Students get 14 days and 4 books; staff 30 days and 10 books. Fines start at GH₵ 1.00 a day, capped at GH₵ 50.00, and borrowing stops at GH₵ 20.00 owed. All are settings.


Accommodation: Grace Hall and Mercy Hall (female), Faith Hall and Hope Hall (male), 36 rooms in all. Hostel applications are open until 31 October 2026. Demo students now have a gender recorded, since halls are single-gender.


Attendance: CSC 101 meets every Monday at 08:00 from 7 September 2026. The first three classes have registers; the rest are waiting. The minimum is 75%.


Exams: four venues are set up. All students approved this semester are fee-cleared except `ANU26400013`. The draft exam timetable has three papers, two of which clash on purpose.


Grading uses version 1 of the scale: A 80 to 100 (4.0), B+ 75 (3.5), B 70 (3.0), C+ 65 (2.5), C 60 (2.0), D+ 55 (1.5), D 50 (1.0), F below 50, pass mark 50. The Registry can change it.


The current semester is 2026/2027 Semester 1. Course registration is open until 30 November 2026, with 9 to 24 credits allowed. Every first-semester course is already offered. Computer Science and Accounting courses have lecturers; the rest are left without one so you can assign them.

## Suggested walkthrough

**Accounts and roles**

1. Sign in as **registrar**. Register a student and note the new index number.
2. In the API console, find the welcome email and open its setup link. Choose a password, then sign in as that student at /login.
3. Sign in as **superadmin**. Open **Add staff member**, create a lecturer who is also Head of Department of a department without one (not Computer Science). Try giving Head of Department of Computer Science to someone else: the system refuses and names Dr Agyeman.

**Course registration (Phase 2)**

4. Sign in as **lecturer.cs** and switch the sidebar role to **Head of Department**. Open **Course offerings**: only Computer Science and its courses appear. Open a course and add a lecturer or change the seat limit.
5. Sign in as a level 100 Computer Science student who has no registration yet: register a new one as the Registry (choose BSc Computer Science and admission year 2026), since the seeded ones are already approved. Open **Course registration**, tick courses and watch the credit total. Submit.
6. Sign in as **advisor.cs**, switch to **Academic Advisor**, open **Registration approvals** and approve it. The student gets an in-app notice, email and SMS (printed in the API console).
7. Back as the student, print the registration slip.
8. Sign in as **dev.candidate** (a Computer Science lecturer). **My classes** now lists the student in that course; print or download the class list.
9. Sign in as **coordinator.sba**. Offerings and approvals show Accounting and Finance only.

**Marks and results (Phase 2b)**

10. Sign in as **registrar**, open **Grading scale**, and look at the preview of how totals become grades. Change a band and save: it becomes version 2, and anything already published keeps its version 1 grades.
11. Sign in as **lecturer.cs** (Lecturer role). Open **My classes**, then **CSC 101**. Marks for the three level 100 students are already entered. Change one, save, then use **Share with students** on the mid-semester test.
12. Sign in as `ANU26400006`. **Results** shows the shared mid-semester mark, and the API console shows the email and SMS.
13. Back as **lecturer.cs**, choose **Submit results**. Switch the sidebar role to **Head of Department**, open **Results approval** and approve (or return it with a note to see the lecturer's side).
14. There is no Dean of the School of Engineering in the demo. As **superadmin**, open **Staff**, give someone the **Dean** role for that school, sign in as them and approve. (Super Admins cannot approve or publish results themselves.)
15. Sign in as **exams** (Exam Coordinator) and publish. The three students get an email, SMS and in-app notice.
16. Sign in as `ANU25400005` (2025 intake): **Results** shows last year's published grades and a cumulative GPA, with a printable statement. `ANU25400012` has an IC (incomplete) grade in one course.

**Exams (Phase 2c)**

17. Sign in as **exams** (Exam Coordinator) and open **Exam timetable**. The draft has a deliberate clash: CSC 101 and GNS 101 overlap on Monday 7 December and the same three students take both. Publishing is blocked. Open GNS 101 and move it to the afternoon; the clash disappears. Schedule a few unscheduled papers, then publish. Students are notified (see the API console).
18. Move one paper to another day and choose **Publish changes**. Only students taking that paper are notified, with what changed.
19. Open **Exam eligibility** and choose **Generate list**. `ANU26400013` is not eligible because fees are not cleared.
20. Sign in as **deanofstudents**, open **Exam holds**, and place a disciplinary hold on `ANU26400020` for CSC 103 only.
21. Sign in as **finance**, open **Fee clearance**, and clear `ANU26400013` (or paste several index numbers with **Clear a list of students**).
22. Back as **exams**, choose **Recalculate**: `ANU26400013` is now eligible and `ANU26400020` is blocked for CSC 103 only. Click a course chip to override a decision with a reason. Publish; each student gets a summary by email, SMS and in-app, and the SMS never states the reason.
23. Sign in as `ANU26400020`. **Exams** lists each paper with date, time, venue and eligibility, and prints an exam entry slip. The blocked paper shows "Disciplinary hold (Dean of Students)" but not the internal reason.

**Attendance (Phase 3)**

24. Sign in as **lecturer.cs**, open **My classes**, then **CSC 101**. The **Attendance** tab shows a weekly Monday lecture for the semester; three classes already have registers. `ANU26400020` has attended one of three (33.3%), below the 75% minimum.
25. For any class that has started, choose **Take attendance**, then **Start self check-in**. A large code and QR code appear, changing every 30 seconds. In another browser, sign in as `ANU26400006`, open **Attendance** and enter the code. The lecturer's count goes up. Close check-in: anyone who did not check in is marked absent.
26. Or mark the register by hand: Present, Late or Absent for each student, then **Save register**. Once three classes are recorded, students below the minimum get one email, SMS and in-app warning.
27. Sign in as **health**, open **Excused absences**, and record a medical excuse for `ANU26400020` covering 7 to 14 September 2026. Their two absences become excused and their attendance rises to 100%.
28. Sign in as **registrar**: **Attendance rules** sets the minimum (75%), the late threshold and when students are warned. **Attendance reports** shows every course, classes still missing a register, and students below the minimum. Heads of Department see only their department.
29. Sign in as **exams**: **Exam eligibility** now has an attendance rule. Recalculate: students below the minimum in a course are not eligible for that paper.

**Morning devotion (Phase 4)**

30. Sign in as **chaplaincy**. **Devotion services** lists every Monday, Tuesday, Thursday and Friday of the semester; services up to 25 September already have records. **Devotion scores** shows each student's running score out of 5.00, lowest first: one demo student is early every time (5.00), one is often late, one has missed several.
31. **Devotion rules** shows the times (early 7:30 to 7:50, late 7:50 to 8:00, absent after), the 5.00 total and late earning 50%, with a worked example that updates as you change a setting.
32. On a devotion morning (or add a special service for today), open **Screen** on the projector: a code and QR code that change every 30 seconds, with live early and late counts. Students check in under **Morning devotion**; the time decides early or late.
33. Open **Door entry** for the same service and type an index number, then Enter. It is recorded with the arrival time; the field clears for the next student. A barcode scanner on a student ID card works the same way.
34. After 8:00 the service closes by itself (or choose **Close service**): everyone expected who was not recorded becomes absent, or excused if Health Services recorded an excuse for that day. Use **Correct** to fix a mistake, with a reason.
35. At the end of the semester, choose **Finalise semester scores** on **Devotion scores**. Every student gets their score out of 5.00 by email, SMS and in-app. **Download CSV** gives the Registry the full list.

**Accommodation (Phase 5)**

36. Sign in as **hostels** (Hostel Manager). **University hostels** shows four halls (two female, two male) with rooms. Open one to see its rooms, or add a range of rooms in one go.
37. **Applications and allocation**: applications are open for 2026/2027 Semester 1 and twelve students have applied. One describes a medical need; choose **Confirm need** so they are placed first.
38. Choose **Run allocation**. The summary shows how many got their first choice. Look at **Places**: they are provisional and students cannot see them. Move or cancel one to try it.
39. Choose **Publish offers**. Each student gets an email and SMS with their hall and room, and has 5 days to accept. Students without a bed are told they are on the waiting list.
40. Sign in as one of the placed students (the API console shows who got an offer) and open **Accommodation**. Accept the room.
41. As **hostels**, open **Private hostels**. Approve **Adweso Green Lodge** (or reject it with a reason). The owner is told.
42. Sign in as a female student without a room, open **Accommodation**, then **Private hostels**, and ask **Koforidua Heights Hostel** for a bed.
43. Sign in as **owner@demo.anu.edu.gh**. **My hostel** shows the request; accept it. The student is told to contact the hostel about payment, and a bed is taken off the free count.
44. As a student with no hostel, open **Where I live** and enter an off-campus address with a GhanaPost digital address.
45. Sign in as **deanofstudents** or **hostels.security**. **Where students live** shows everyone enrolled this semester, how many are in university halls, private hostels, off campus or have not said, with a CSV download.

**Library (Phase 6)**

46. Sign in as **libdesk** (Library Assistant) and open **Circulation desk**. In **Return**, scan or type `ANUL000007` (Discrete Mathematics, overdue since 14 September): it is returned and a fine at GH₵ 1.00 a day, capped at GH₵ 50.00, is charged to `ANU25400002`, who is told by email and SMS.
47. In **Return**, type `ANUL000014` (Clean Code). Two students are queued for it, so it is kept for `ANU25400004`, who is told to collect it within 3 days. The desk is told to put it on the reservations shelf.
48. In **Borrow**, find `ANU25400004`. The waiting reservation shows; scan `ANUL000014` to issue it. Then find `ANU25400006`: they owe GH₵ 12.00 but can still borrow, because the limit is GH₵ 20.00.
49. Open **Library fines**, find `ANU25400006` and take payment by mobile money with a transaction number. Sign in as **librarian** to see the **Waive** option as well.
50. Sign in as `ANU25400001` and open **Library**. Two books are out; renew one. Under **Find a book**, search "robbins" (an author) or "accounting" (a subject); a title with every copy out can be reserved.
51. As **librarian**, **Catalogue** lists 15 titles. Open one to add copies by scanning new barcodes, or mark a copy damaged. **Library rules** changes loan lengths, limits and fines, with a worked example.
52. **Overdue and reservations** lists late books with the fine so far (and a CSV), what is waiting on the reservations shelf, and totals. Reminders go out automatically 2 days before a book is due, the day after it is overdue, and weekly after that.

**Food marketplace**

Vendors only take orders in their opening hours (Ghana time). If you are running the demo outside them, sign in as the vendor and add hours for today in **Shop settings**.

53. Sign in as `ANU25400001` and open **Food**. Open **ANU Main Cafeteria**, add Jollof rice with chicken and a drink, and **Check out**. Choose **Pick it up** and **Pay now**. (The cafeteria's deliveries go to campus dispatchers; steps 67 to 69 show those.)
54. The test checkout opens, showing the amount and a payment reference. Choose **Pay (test)**. You return to the order, which is confirmed with the server before it shows as placed. A 4-digit code is shown. (Choosing **Payment fails (test)** leaves the order waiting for payment, with a button to try again; unpaid orders are cancelled after 30 minutes.)
55. Sign in as **vendor** in another browser. **Orders** shows the new order under **New**, with the customer, dishes, "Pickup" and "paid online". The board refreshes every 10 seconds. **Accept** it: the student sees "Preparing" and an expected time.
56. Choose **Ready for pickup**: the student is told by SMS where to collect it, with their code. Choose **Handed over** and type a wrong code: it is refused. Type the student's code to complete the order. The customer's code is never shown on the vendor's screen.
57. One order from a student is already waiting under **New** (pay at the counter). **Decline** it with a reason: the student is told why by SMS. Had it been paid online, the payment would be refunded automatically.
58. Still as vendor, open **Menu** and untick **Available** on a dish: customers see it as sold out. **Pause new orders** on the board closes the shop to new orders at once.
59. Sign in as `ANU25400002`, order from **Mama Esi's Kitchen** (pickup only), and choose **Pay at the counter**. Cancel it from the order page before the vendor accepts. A customer can have at most 3 orders on the go.
60. Sign in as **deanofstudents** and open **Vendors**. Approve **Campus Snacks Kiosk**; its owner is told by email and SMS. Set a commission under **Marketplace settings** if the university takes a share of online sales.
61. Sign in as **finance** and open **Vendor settlements**. Set **From** to 21 September 2026 to include the demo orders: ANU Main Cafeteria has online sales to be paid out and some counter sales (shown for reference). **Record payout** with a mobile money transaction ID; the amount owed drops. Download the CSV.

**Student employment and dispatchers**

62. Sign in as `ANU25400005` and open **Campus jobs**. Your CGPA is shown, with the rules. Two jobs are open; you have applied for both. The **Campus dispatcher** card explains the pay per delivery and whether you can apply.
63. Sign in as **careers** and open **Campus jobs**, then **ICT help desk assistant** (it asks for a CGPA of 3.00). Each applicant shows their programme, level and CGPA, and anyone who does not meet the rules is flagged with the reason and cannot be hired. Shortlist one, then hire someone who meets the rules: they get an email, SMS and in-app message, and the supervisor (ict) is told.
64. **Chapel media assistant** (closed) has `ANU26400020` hired. If you placed the disciplinary hold in step 20, they are now flagged **No longer meets the rules**; ending the job, with a reason, is Career Services' decision.
65. **Employment rules**: raise the minimum CGPA to 3.50 and watch the example sentence change; the flags on applicants follow on reload. Set it back to 2.50. The dispatcher fee (GH₵ 4.00 a delivery) is set here too.
66. **Dispatchers**: `ANU25400012` is waiting, with their CGPA and statement. Approve them if they meet the rules (the button is disabled otherwise). Approval adds deliveries to their student account; they do not switch roles.
67. Now a delivery. Sign in as `ANU26400006` in one browser, open **Deliveries** and choose **Go online**. In another, sign in as `ANU25400001`, order from **ANU Main Cafeteria** with **Deliver it**: the cafeteria uses campus dispatchers, so paying online is the only option. Complete the test payment.
68. As **vendor**, **Accept** the order, then **Ready for a dispatcher**. On the dispatcher's screen the delivery appears within 15 seconds, showing only the hall and the GH₵ 4.00 fee. **Take it**: the full address and phone numbers appear, and the vendor's board shows who is coming.
69. As the dispatcher choose **I have collected it**: the customer is told by SMS who is bringing the food. Choose **Delivered** and type the code shown on the customer's order page. A wrong code is refused. The order completes and the dispatcher sees what they earned.
70. If nobody takes a delivery within 15 minutes, the vendor is alerted and can choose **Send with our own staff**. A dispatcher can **Hand it back** before collecting it, or **Report a problem**, which the vendor sees on the board.
71. As `ANU26400006`, **My earnings** lists two earlier deliveries (23 and 24 September) plus any new ones, and what is waiting to be paid.
72. Sign in as **finance**, open **Vendor settlements** and set **From** to 21 September. ANU Main Cafeteria now has a **Dispatcher fees** column, taken from what it is owed. Under **Campus dispatchers**, **Record payout** to `ANU26400006` with a transaction ID; they get an SMS.

**Fees and departmental dues**

This semester's fees are issued from the Accounts office's fee items: GH₵ 3,800.00 for most Ghanaian students, GH₵ 4,050.00 for Ghanaian first years, and US$ 1,842.00 for international students (`ANU25400008` is the demo international student). The clearance rule is 70% paid, set by the Registrar. EHASSA (Engineering and Health and Allied Science Students Association) covers Computer Science, Electrical Engineering, Biomedical Engineering, Oil and Gas Engineering and Nursing; BACA (Business and Accounting Students Association) covers Accounting and Management. Dues are compulsory.

73. Sign in as `ANU26400013` and open **Fees**: 40% paid, not yet cleared, with the bill's items, a bank payment and its receipt. Choose **Pay online**, pay part of the balance on the test checkout, and see the payment and receipt appear.
74. Sign in as **finance** and open **Student fees**: totals for the semester, and every student's balance. Open `ANU26400013` and **Record a payment**: bank deposit, GH₵ 1,300.00 (taking them from 40% to over 72%), any slip number. The student passes 70% and is **cleared for exams automatically**, and told by SMS. Try recording the same slip number again: it is refused.
75. Still as finance, open `ANU25400019`: a 25% scholarship reduces the bill. Add an extra charge, or **Reverse** a bank payment (for a bounced cheque); if that takes a student below 70%, the automatic clearance is withdrawn. Clearances set by hand on **Fee clearance** are never changed by the rule.
76. **Fee set-up**: two schedules this semester, the first-year one taking priority for level 100. Change the clearance percentage: this semester's bills are rechecked straight away.
77. Sign in as `ANU25400005`, who is EHASSA president. **Association dues** shows EHASSA dues of GH₵ 50.00 (set by the patron, Dr Agyeman) with two paid, one online and one in cash. Open **Members and cash** and record cash from `ANU25400019`: a receipt number (EHASSA-000003) is issued and the student is sent it by SMS. Officers collect and receipt dues but do not set them: the association's patron does (step 77a).
77a. Sign in as **lecturer.cs** (Head of Computer Science, EHASSA's patron) and open **Departmental dues**: set new dues with an amount and due date. The EHASSA officers are told, and students see them. The patron can close or reopen collection.
78. Sign in as `ANU25400019` and open **Departmental dues**: the receipt is there. As `ANU26400020` (not yet paid), pay EHASSA dues online.
79. Sign in as **deanofstudents** and open **Departmental associations**. Open EHASSA's **Receipts** and cancel one with a reason: the student and the president are told. Record an elected president for BACA (for example `ANU25400002` if they are in a BACA department, or change BACA's departments first). When a term ends, the officer loses the dues screen automatically. Use **Name patron** on BACA to name its patron: it must be a Head of Department of Accounting or Management.
80. As **finance**, **Dues payouts** shows the online dues held for EHASSA. Record a payout to the association's mobile money number.

**Registry: programmes, departments and index numbers**

83. Sign in as **registrar** and open **Academic structure**. Add a department to a school, then a programme in it (for example BSc Computer Engineering already sits under Electrical and Electronic Engineering). Programmes with students cannot be removed, only marked as not admitting.
84. Open **Programme types**: Bachelor's regular (8 semesters), Bachelor's weekend (12), Diploma and Graduate School, each with its index number format. Edit Graduate School's format and watch the example number change as you type; formats that could repeat or clash are refused. New students get numbers in the new format; existing numbers never change.
85. On the same page, **Exam fee clearance** sets the percentage of fees paid for automatic clearance.
86. Register a student on **MSc Computer Science** (Students, Register): their index number follows the Graduate School format, for example ANUGS260001, and they can sign in with it. Register one on **Diploma in Computer Engineering**: diploma numbers start with D and the programme's initials, so theirs is DCE260001 (Diploma in Biomedical Engineering gives DBM…, Oil and Gas DOE…). Each diploma programme has its own index code, set by the Registrar, and its own sequence. Adding a diploma programme asks for its code, suggested from the name.

**Student dashboard, statements and receipts**

87. Sign in as `ANU25400005`: the dashboard shows CGPA, fees balance and clearance, and compulsory dues outstanding.
88. Open **Fees**, then **Statement**: each fee item as a debit, payments and the scholarship or waivers as credits, and the running balance. Print it, or choose "Save as PDF". Each payment has a **Receipt** that prints the same way. Finance can reprint any receipt from the student's bill.
89. Sign in as `ANU25400008` (international): the bill is in US dollars.

**After the first run: advisors, hall fees, fines, photos, suspending students**

92. As **lecturer.cs** (Head of Department for Computer Science; switch to that role), open **Academic advisors**, choose **advisor.cs** and paste some Computer Science index numbers. Signed in as **advisor.cs**, **Registration approvals** now shows only those students.
93. As a student who accepts a university hall place (step 40), open **Fees**: the hall fee is on the bill and the statement. If the Hostel Manager moves or cancels the place, the bill is adjusted.
94. As `ANU25400006` (owes a GH₵ 12.00 fine), open **Library**, then **Fines**, and **Pay online**.
95. As **vendor**, open **Menu**, edit a dish and add a photo; customers see it. As **owner**, open **Hostel photos**. (Needs the Cloudinary settings.)
96. As **registrar**, open **Students**, choose **Account** on a student and suspend them with a reason: they are signed out at once and cannot sign in until reactivated.

**Result amendments, carry-overs and the exam register**

97. As **exams**, open the published **Exam timetable** and choose **Number seats**, then **Send invigilator duties**. Students see their seat on **Exams**.
98. As an invigilator of a paper (or **exams**, who sees every paper), open **Exam register**: seat, student, flags (not eligible, fees not cleared, unpaid EHASSA or BACA dues), and Present, Late or Absent. Type an index number to mark present quickly. **Close register** records everyone unmarked as absent.
99. As **lecturer.cs** (lead lecturer), open **Result amendments**, find a student's published CSC result, and request an amendment with corrected scores and a reason. Switch to Head of Department and approve; then the Dean approves and **exams** applies. The student is told the old and new grade.
100. As a 2025 Computer Science student who failed a first-semester course last year, open **Course registration**: that course is offered again, marked **Carry-over**.

**Money: dispatcher fees, paying the vendor, exchange rates, PDFs**

101. As `ANU25400002`, order a delivery from **ANU Main Cafeteria** (campus dispatchers): choose to **include the dispatcher's fee** or **pay the dispatcher on delivery**, and **Pay the vendor** (cash or MoMo). As **vendor**, **Mark paid** with a MoMo transaction ID; the customer is told. The dispatcher sees who pays their fee.
102. As **finance**, open **Exchange rates** and add a rate. Open `ANU25400008`'s bill (dollars) and record a bank payment **in cedis**: it is converted at the rate, and the receipt shows both.
103. As any student with a payment, open **Fees**: **Statement as PDF** and each receipt's **PDF** download files generated by the server. Dues receipts download the same way.
104. As **lecturer.cs** (Head of Department), open **Dues on exam registers** and switch it on for Computer Science: invigilators now see unpaid-dues markers for those students.

**Devotion in results, and hostel fees**

105. As **registrar**, open **Programme types**: **Morning devotion in course totals** is on. As **lecturer.cs**, the suggested assessments now add up to 95%. Submitting results before the Chaplaincy finalises devotion scores is refused with an explanation.
106. As a student who accepts a hall place (step 40), open **Accommodation**: **Hostel fees** shows the room's price. Pay part online; the receipt (PDF) arrives, and the Hostel Manager is sent a copy.
107. As **hostels**, open **Hall fees**: record a cash payment for that student. As **owner**, **Hostel fees** does the same for Koforidua Heights bookings.
108. As **finance**, **Hostel owner payouts** shows online fees held for each private hostel.

**Documents, residents, excuses and small rules**

109. As **hostels**, open **Hall residents**: upload a blank **Tenancy agreement** for every university hall. Check in a resident with a note. (Documents need the Cloudinary settings.)
110. As that resident, open **Accommodation**: download the form, then upload a signed copy. As **hostels**, open it from **Hall residents** and accept or return it.
111. As `ANU25400002`, open **Excuse requests**: ask to be excused for illness with a medical note attached. As **health**, open **Excuse requests**, open the note and **Excuse**: attendance and devotion are corrected for those days.
112. As **chaplaincy**, open **Devotion exemptions** and exempt a student with a reason; their results are scaled from 95 like weekend students.
113. As **advisor.cs**, open **Registration approvals**, the **Approved** tab, and **Reopen** a registration with a reason; the student can change it and submit again.

**Library: clearance, e-books, inter-library loans, reading lists**

114. As `ANU25400006` (owes a fine), open **Library**: **Library clearance** says what stops clearance. As **libdesk**, open **Library clearance**, paste `ANU25400001 ANU25400006` and check: issue a certificate for the clear student and download the PDF.
115. As **librarian**, open a catalogue title and add an **E-book** link (or upload a PDF). Members see **Read e-book** in the catalogue.
116. As a student, request an **inter-library loan** on the Library page. As **libdesk**, open **Inter-library loans**: Ordered, then Arrived (the student is told), then Issued with a due date.
117. As **lecturer.cs**, open **Reading lists**, choose a course, add books from the catalogue (essential or recommended) and a web reference, and save. Students on the course see it with shelf availability; **librarian** sees essential books short of copies under **Reading lists**.

**Food: ratings, schedules, meal plans, payouts, tracking**

118. As `ANU25400002`, open a completed order under **My food orders** and rate the vendor (and the dispatcher, if one delivered). Vendor cards show the average; **vendor** sees them under **Ratings**.
119. Order from a vendor while it is closed and choose a time under **When**: the vendor sees the scheduled time.
120. As **vendor**, add a **Meal plan** covering some dishes. As a student, buy it on the vendor's menu (demo checkout), then choose it at checkout: one meal covers a dish.
121. As **finance**, open **Vendor settlements** and press **Pay now** (asks for your authenticator code): in demo mode the transfer succeeds at once and the payout is recorded. The same button is on dues and hostel owner payouts.
122. As the dispatcher `ANU26400006`, collect an order on a phone and allow location: the customer's order page shows when the location was last updated, with a map link.

**Opportunities, timesheets and payroll**

123. As **lecturer.cs**, open **Opportunities** and post a **Teaching assistant** for CSC 101 at GH₵ 12 an hour, 6 hours a week. As any staff member, post an **Internship** with an organisation. Both wait for Career Services.
124. As **careers**, open **Jobs**: approve and open them. Students see them on the jobs board, marked by kind.
125. As a student, apply for the assistantship. As **lecturer.cs**, open **Opportunities**, then **Applicants**, and take the student on.
126. As that student, open **My work**: add a mobile money number, open this month's timesheet, log some hours (try more than 6 in a week to see the limit) and send it. As **lecturer.cs**, approve it under **Timesheets to approve**.
127. As **finance**, open **Student payroll**: **Pay now** (demo transfer) or **Paid another way**. The student is told and downloads the payslip.

**Importing from the previous system**

128. As **registrar**, open **Import data**, choose **Students**, and download the blank template. Fill in a few rows (use an existing programme code such as BSC-CS and an index number like ANU19400001), save as CSV and choose the file. Check the column matches, **Check every row**, then **Import**. Run the same file again: the rows are updated, not duplicated.
129. Import **Past results** for those students (course code, 2023/2024, semester 1, a score): their CGPA appears on their dashboard. Then **Send set-up emails** for the student import.

**Roommates, complaints, instalments, bank statements**

130. As two female students (for example `ANU25400002` and `ANU25400004`), apply for a hall naming each other as roommate: each sees "Matched". As **hostels**, run the allocation: they share a room.
131. As a student, open **Accommodation**, **Report a problem** about a private hostel. As **hostels**, open **Hostel complaints**: look into it, then resolve it with a note. As **owner**, the complaint shows under **Complaints** without the student's name unless they allowed it.
132. As **finance**, open **Fee setup**: add instalments (50% by one date, 100% by a later one). Students see what is due next. Turn on **Charge for late payment** to see the setting; it is off by default.
133. As **finance**, open **Bank statement** and upload a CSV with a line whose narration includes `ANU25400001`: it is matched to that bill; record it and a receipt is issued.

**Photos, PDFs, security and retention**

134. As any account, open **Account and security** and add a **Profile photo**: it shows in the sidebar. Replace it: the old one is deleted from Cloudinary. (Needs the Cloudinary settings.)
135. Download any receipt or statement PDF: amounts print with the cedi sign.
136. As **superadmin**, open **Records retention**: see the defaults (the activity log is kept for good).

**Oversight**

137. As **superadmin** or **auditor**, open **All activity** to see every step above, grouped by user type.
138. As superadmin, enable **Developer access** for Kofi Amponsah; as dev.candidate switch to Developer to see **System diagnostics**.
