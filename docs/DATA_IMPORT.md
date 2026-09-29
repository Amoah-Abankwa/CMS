# Importing data from the previous system

For the Registry and ICT. The **Import data** page (Registry) brings records over from the old CMS as CSV files. Importing needs the **Data import** permission (Registrar, Super Admin) plus the permission for that kind of record: academic records for structure and courses, user management for staff, student registration for students, and publishing results for past results. Starting an import asks for an authenticator code.

## Before you start

1. **Rehearse on a copy.** Import everything into a test copy of the platform first, check it, then do it for real. Imports can be run again safely, but a rehearsal finds problems in the old data without pressure.
2. **Set up first, by hand:** programme types (with their index formats) under **Programme types**, and the grading scale. The import refers to them by code.
3. **Export from the old system** each list below as a spreadsheet, then in Excel choose File, Save As, **CSV UTF-8**. One file per list; any column order; extra columns are ignored.

## Order

Import in this order, because later lists refer to earlier ones:

1. Schools, departments and programmes
2. Courses and curriculum
3. Staff
4. Students
5. Past results

## How it works

- Choose the list and the file. Each of our fields is matched to a column **by its heading** (common headings such as "Index No", "Surname", "Other Names" and "Programme Code" are recognised); check and correct the matches.
- **Check every row** first: nothing is saved. You see how many rows are new, how many update existing records, and every problem by row number, which you can download.
- **Import** saves the rows that passed; rows with errors are left out and listed. Fix them in the file and import it again: records are matched by **index number** (students), **email** (staff), or **code** (schools, departments, programmes, courses), so running a file again updates rather than duplicates.
- **Accounts:** imported students and staff are created waiting for set-up. When you are ready, use **Send set-up emails** on the import: links go out a few at a time (about 100 a minute) so the email service is not flooded. Students without an email cannot be sent a link until one is added.

## Rules worth knowing

- **Index numbers** are kept as they are, but must start with a letter and use only letters, digits, `/` or `-` (so students can sign in with them). New students registered on the platform continue from the highest existing number.
- **Dates** are read day first (21/03/2004) or as 2004-03-21. **Levels** can be 100, 200... or 1, 2...; **academic years** as 2023/2024 or 2023/24.
- **Students** marked graduated, withdrawn, dismissed or inactive are imported as deactivated. An active account is never switched back to waiting for set-up.
- **Staff roles** are added, never removed. Super Admin, Developer, Heads of Department and Deans are not given by import; set them on the Staff screens. Department roles need the department column.
- **Past results** create the academic years, semesters and course offerings they need, marked as imported. They count towards CGPA, work eligibility and carry-over courses. If both a score and a grade are given and the current scale would grade the score differently, the old system's grade is kept and the row gets a note. Results are never imported into the current semester, and results entered on the platform are never replaced.

## Not imported (enter or carry forward by hand)

Fee balances and payment history (issue this semester's bills and record any balance brought forward as a charge or waiver), departmental dues history, library loans and fines, hostel allocations, attendance and devotion records.

## Columns

### 1. Schools, departments and programmes

| Field | Required | Headings recognised |
| --- | --- | --- |
| School code | Yes | faculty code, school |
| School name |  | faculty, faculty name |
| Department code | Yes | dept code, dept, department |
| Department name |  | dept name |
| Programme code | Yes | program code, programme, program, course of study code |
| Programme name | Yes | program name, course of study, programme title |
| Programme type code | Yes | level code, type, programme type, award |
| Index code (e.g. DCE) |  | index prefix |

### 2. Courses and curriculum

| Field | Required | Headings recognised |
| --- | --- | --- |
| Course code | Yes | course code, course, module code |
| Title | Yes | course title, course name, name, module title |
| Credit hours | Yes | credit, credit hours, units, cr |
| Department code | Yes | dept code, dept, department |
| Programme code (curriculum) |  | program code, programme |
| Level (100, 200...) |  | year, level |
| Semester (1 or 2) |  | sem, semester no |
| Elective (yes/no) |  | elective, optional |

### 3. Staff

| Field | Required | Headings recognised |
| --- | --- | --- |
| Email | Yes | email address, e-mail, official email |
| Title |  | salutation |
| First name | Yes | first name, firstname, given name, other names |
| Middle name |  | middle name, middlename |
| Surname | Yes | last name, lastname, surname, family name |
| Phone |  | phone number, mobile, telephone, contact |
| Staff ID (needed for new staff) |  | staff no, staff number, employee id, employee no |
| Department code |  | dept code, dept, department |
| Roles (separated by ;) |  | role, position, roles |

### 4. Students

| Field | Required | Headings recognised |
| --- | --- | --- |
| Index number | Yes | index no, index, student id, student no, matric no, reg no, registration number |
| First name | Yes | first name, firstname, given name, other names |
| Middle name |  | middle name, middlename |
| Surname | Yes | last name, lastname, surname, family name |
| Email |  | email address, e-mail, personal email |
| Phone |  | phone number, mobile, telephone, contact |
| Programme code | Yes | program code, programme, program, course of study code |
| Current level (100, 200...) | Yes | level, year, current level |
| Year admitted | Yes | admission year, year of admission, entry year, intake |
| Gender |  | sex |
| Date of birth |  | dob, birth date, date of birth |
| Nationality |  | country, citizenship |
| Status (active, graduated, withdrawn) |  | student status, status |
| ID in the old system |  | id, student ref, old id, cms id |

### 5. Past results

| Field | Required | Headings recognised |
| --- | --- | --- |
| Index number | Yes | index no, index, student id, student no, matric no |
| Course code | Yes | course code, course, module code |
| Academic year (2023/2024) | Yes | academic year, session, year |
| Semester (1 or 2) | Yes | sem, semester |
| Total score (0 to 100) |  | total, mark, marks, total score |
| Grade |  | letter grade, grade |
