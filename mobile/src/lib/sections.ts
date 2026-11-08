// Generated from frontend/src/lib/nav.ts by scripts/mobile/sync-menu.py. Do not edit here.
import { PERMISSIONS } from '@anu/shared';

export interface SectionItem { href: string; label: string; permission?: string; anyPermission?: string[]; audience?: 'STUDENT' | 'STAFF' | 'MEMBER' }
export interface Section { label: string; items: SectionItem[] }

export const SECTIONS: Section[] = [
  {
    label: "General",
    items: [
      { href: '/dashboard', label: "Dashboard" },
      { href: '/registration', label: "Course registration", audience: 'STUDENT' },
      { href: '/courses', label: "My courses", audience: 'STUDENT' },
      { href: '/results', label: "Results", audience: 'STUDENT' },
      { href: '/attendance', label: "Attendance", audience: 'STUDENT' },
      { href: '/exams', label: "Exams", audience: 'STUDENT' },
      { href: '/devotion', label: "Morning devotion", audience: 'STUDENT' },
      { href: '/accommodation', label: "Accommodation", audience: 'STUDENT' },
      { href: '/library', label: "Library", audience: 'MEMBER' },
      { href: '/food', label: "Food", audience: 'MEMBER' },
      { href: '/food/plans', label: "Meal plans", audience: 'MEMBER' },
      { href: '/fees', label: "Fees", audience: 'STUDENT' },
      { href: '/dues', label: "Departmental dues", audience: 'STUDENT' },
      { href: '/excuses', label: "Excuse requests", audience: 'STUDENT' },
      { href: '/work', label: "My work", audience: 'STUDENT' },
      { href: '/association', label: "Association dues", permission: PERMISSIONS.DUES_COLLECT },
      { href: '/jobs', label: "Campus jobs", audience: 'STUDENT' },
      { href: '/dispatch', label: "Deliveries", permission: PERMISSIONS.DISPATCH_DELIVER },
      { href: '/dispatch/earnings', label: "My earnings", permission: PERMISSIONS.DISPATCH_DELIVER },
      { href: '/my-hostel', label: "My hostel", permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/my-hostel/photos', label: "Hostel photos", permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/my-hostel/fees', label: "Hostel fees", permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/my-hostel/residents', label: "Residents", permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/my-hostel/complaints', label: "Complaints", permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/notifications', label: "Notifications" },
      { href: '/activity', label: "My activity" },
      { href: '/account', label: "Account and security" },
    ],
  },
  {
    label: "Teaching",
    items: [
      { href: '/teaching', label: "My classes", permission: PERMISSIONS.TEACHING_READ },
      { href: '/opportunities', label: "Opportunities", audience: 'STAFF' },
      { href: '/teaching/reading-lists', label: "Reading lists", permission: PERMISSIONS.TEACHING_READ },
    ],
  },
  {
    label: "Academic",
    items: [
      { href: '/academics/offerings', label: "Course offerings", permission: PERMISSIONS.OFFERINGS_MANAGE },
      { href: '/academics/registrations', label: "Registration approvals", permission: PERMISSIONS.REGISTRATIONS_REVIEW },
      { href: '/academics/course-drops', label: "Course drop requests", permission: PERMISSIONS.COURSE_DROPS_APPROVE },
      { href: '/academics/registration-records', label: "Registration records", permission: PERMISSIONS.REGISTRATION_RECORDS_READ },
      { href: '/academics/dues-marker', label: "Dues on exam registers", permission: PERMISSIONS.RESULTS_APPROVE_DEPARTMENT },
      { href: '/dues-patron', label: "Departmental dues", permission: PERMISSIONS.RESULTS_APPROVE_DEPARTMENT },
      { href: '/academics/advisors', label: "Academic advisors", permission: PERMISSIONS.ADVISORS_ASSIGN },
      { href: '/academics/results', label: "Results approval", anyPermission: [PERMISSIONS.RESULTS_APPROVE_DEPARTMENT, PERMISSIONS.RESULTS_APPROVE_SCHOOL, PERMISSIONS.RESULTS_PUBLISH, PERMISSIONS.RESULTS_READ_ALL] },
      { href: '/academics/semesters', label: "Academic calendar", permission: PERMISSIONS.ACADEMICS_MANAGE },
      { href: '/academics/grading', label: "Grading scale", permission: PERMISSIONS.GRADING_MANAGE },
      { href: '/academics/attendance', label: "Attendance reports", permission: PERMISSIONS.ATTENDANCE_REPORTS_READ },
      { href: '/academics/attendance-rules', label: "Attendance rules", permission: PERMISSIONS.ACADEMICS_MANAGE },
    ],
  },
  {
    label: "My shop",
    items: [
      { href: '/vendor', label: "Orders", permission: PERMISSIONS.VENDOR_OWN },
      { href: '/vendor/menu', label: "Menu", permission: PERMISSIONS.VENDOR_OWN },
      { href: '/vendor/meal-plans', label: "Meal plans", permission: PERMISSIONS.VENDOR_OWN },
      { href: '/vendor/ratings', label: "Ratings", permission: PERMISSIONS.VENDOR_OWN },
      { href: '/vendor/profile', label: "Shop settings", permission: PERMISSIONS.VENDOR_OWN },
    ],
  },
  {
    label: "Registry",
    items: [
      { href: '/students', label: "Students", permission: PERMISSIONS.STUDENTS_READ },
      { href: '/students/new', label: "Register student", permission: PERMISSIONS.STUDENTS_REGISTER },
      { href: '/registry/structure', label: "Academic structure", permission: PERMISSIONS.ACADEMICS_MANAGE },
      { href: '/registry/curriculum', label: "Courses and curriculum", permission: PERMISSIONS.CURRICULUM_MANAGE },
      { href: '/registry/import', label: "Import data", permission: PERMISSIONS.DATA_IMPORT },
      { href: '/registry/programme-types', label: "Programme types", permission: PERMISSIONS.ACADEMICS_MANAGE },
    ],
  },
  {
    label: "Fees",
    items: [
      { href: '/finance/fees', label: "Student fees", permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/fees/setup', label: "Fee set-up", permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/fees/items', label: "Fee items", permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/fees/rates', label: "Exchange rates", permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/fees/bank-statement', label: "Bank statement", permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/hostel-owners', label: "Hostel owner payouts", permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/payroll', label: "Student payroll", permission: PERMISSIONS.PAYROLL_MANAGE },
      { href: '/finance/dues', label: "Dues payouts", permission: PERMISSIONS.FEES_MANAGE },
      { href: '/student-affairs/associations', label: "Departmental associations", permission: PERMISSIONS.ASSOCIATIONS_MANAGE },
    ],
  },
  {
    label: "Student employment",
    items: [
      { href: '/employment/jobs', label: "Campus jobs", permission: PERMISSIONS.EMPLOYMENT_MANAGE },
      { href: '/employment/dispatchers', label: "Dispatchers", permission: PERMISSIONS.EMPLOYMENT_MANAGE },
      { href: '/employment/rules', label: "Employment rules", permission: PERMISSIONS.EMPLOYMENT_MANAGE },
    ],
  },
  {
    label: "Food marketplace",
    items: [
      { href: '/marketplace/vendors', label: "Vendors", permission: PERMISSIONS.MARKETPLACE_MANAGE },
      { href: '/marketplace/ratings', label: "Food ratings", permission: PERMISSIONS.MARKETPLACE_MANAGE },
      { href: '/marketplace/settlements', label: "Vendor settlements", permission: PERMISSIONS.MARKETPLACE_MANAGE },
    ],
  },
  {
    label: "Library",
    items: [
      { href: '/library/desk', label: "Circulation desk", permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/overdue', label: "Overdue and reservations", permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/fines', label: "Library fines", permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/clearance', label: "Library clearance", permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/ill', label: "Inter-library loans", permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/reading-lists', label: "Reading lists", permission: PERMISSIONS.LIBRARY_MANAGE },
      { href: '/library/catalogue', label: "Catalogue", permission: PERMISSIONS.LIBRARY_MANAGE },
      { href: '/library/rules', label: "Library rules", permission: PERMISSIONS.LIBRARY_MANAGE },
    ],
  },
  {
    label: "Accommodation",
    items: [
      { href: '/hostels', label: "University hostels", permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/allocation', label: "Applications and allocation", permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/fees', label: "Hall fees", permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/residents', label: "Hall residents", permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/complaints', label: "Hostel complaints", permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/private', label: "Private hostels", permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/residence', label: "Where students live", permission: PERMISSIONS.ACCOMMODATION_READ },
    ],
  },
  {
    label: "Chaplaincy",
    items: [
      { href: '/chaplaincy/services', label: "Devotion services", permission: PERMISSIONS.DEVOTION_MANAGE },
      { href: '/chaplaincy/scores', label: "Devotion scores", permission: PERMISSIONS.DEVOTION_READ },
      { href: '/chaplaincy/rules', label: "Devotion rules", permission: PERMISSIONS.DEVOTION_MANAGE },
      { href: '/chaplaincy/exemptions', label: "Devotion exemptions", permission: PERMISSIONS.DEVOTION_MANAGE },
    ],
  },
  {
    label: "Student services",
    items: [
      { href: '/attendance/excuses', label: "Excused absences", permission: PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE },
      { href: '/attendance/excuse-requests', label: "Excuse requests", permission: PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE },
    ],
  },
  {
    label: "Examinations",
    items: [
      { href: '/exams/timetable', label: "Exam timetable", permission: PERMISSIONS.EXAMS_MANAGE },
      { href: '/exams/eligibility', label: "Exam eligibility", permission: PERMISSIONS.EXAMS_MANAGE },
      { href: '/exams/register', label: "Exam register", audience: 'STAFF' },
      { href: '/exams/malpractice', label: "Exam malpractice", permission: PERMISSIONS.EXAMS_MANAGE },
      { href: '/results/amendments', label: "Result amendments", audience: 'STAFF' },
      { href: '/exams/venues', label: "Exam venues", permission: PERMISSIONS.EXAMS_MANAGE },
      { href: '/exams/clearance', label: "Fee clearance", permission: PERMISSIONS.FINANCE_CLEARANCE_MANAGE },
      { href: '/exams/holds', label: "Exam holds", permission: PERMISSIONS.EXAM_HOLDS_MANAGE },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: '/staff', label: "Staff", permission: PERMISSIONS.USERS_READ },
      { href: '/staff/new', label: "Add staff member", permission: PERMISSIONS.USERS_MANAGE },
      { href: '/admin/activity', label: "All activity", permission: PERMISSIONS.AUDIT_READ_ALL },
      { href: '/admin/developer-access', label: "Developer access", permission: PERMISSIONS.DEVELOPER_ACCESS_MANAGE },
      { href: '/admin/retention', label: "Records retention", permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
  {
    label: "Developer",
    items: [
      { href: '/system', label: "System diagnostics", permission: PERMISSIONS.SYSTEM_DIAGNOSTICS_READ },
    ],
  },
];
