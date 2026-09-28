export const PERMISSIONS = {
  // Users and access
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  DEVELOPER_ACCESS_MANAGE: 'developer.access.manage',
  // Students
  STUDENTS_READ: 'students.read',
  STUDENTS_REGISTER: 'students.register',
  // Academic structure
  ACADEMICS_READ: 'academics.read',
  ACADEMICS_MANAGE: 'academics.manage',
  // Teaching and course registration (Phase 2)
  /** Create course offerings for a semester and assign lecturers. Limited to the role's department or school. */
  OFFERINGS_MANAGE: 'offerings.manage',
  /** Approve or reject students' course registrations. Limited to the role's department or school. */
  REGISTRATIONS_REVIEW: 'registrations.review',
  /** See the classes you teach and their student lists. */
  TEACHING_READ: 'teaching.read',
  // Grading and results (Phase 2b)
  /** Edit the grading scale (bands, grade points, pass mark). */
  GRADING_MANAGE: 'grading.manage',
  /** First approval of a course's results, for courses in the role's department. */
  RESULTS_APPROVE_DEPARTMENT: 'results.approve.department',
  /** Second approval, for courses in the role's school. */
  RESULTS_APPROVE_SCHOOL: 'results.approve.school',
  /** Publish fully approved results to students. */
  RESULTS_PUBLISH: 'results.publish',
  /** View any course's result sheet without acting on it. */
  RESULTS_READ_ALL: 'results.read_all',
  // Examinations (Phase 2c)
  /** Venues, exam timetable, eligibility rules, lists and publishing. */
  EXAMS_MANAGE: 'exams.manage',
  /** Mark students as financially cleared for exams. */
  FINANCE_CLEARANCE_MANAGE: 'finance.clearance.manage',
  /** Place and lift exam holds on students. */
  EXAM_HOLDS_MANAGE: 'exams.holds.manage',
  // Attendance (Phase 3). Lecturers take attendance through TEACHING_READ for classes they teach.
  /** Record and revoke excused absences, such as medical excuses. */
  ATTENDANCE_EXCUSES_MANAGE: 'attendance.excuses.manage',
  /** Attendance reports for courses in the role's department, school or the whole university. */
  ATTENDANCE_REPORTS_READ: 'attendance.reports.read',
  // Morning devotion (Phase 4)
  /** Run devotion: services, check-in screen, door entry, corrections, rules and finalising scores. */
  DEVOTION_MANAGE: 'devotion.manage',
  /** View devotion scores across all students. */
  DEVOTION_READ: 'devotion.read',
  // Accommodation (Phase 5)
  /** University hostels, rooms, applications and allocation; verifying private hostels and their owners. */
  HOSTELS_MANAGE: 'hostels.manage',
  /** A private hostel owner managing their own listing and bookings. */
  PRIVATE_HOSTEL_OWN: 'private_hostel.own',
  /** Where every student lives this semester. */
  ACCOMMODATION_READ: 'accommodation.read',
  // Library (Phase 6)
  /** Issue, return and renew at the desk; take fine payments; handle reservations. */
  LIBRARY_CIRCULATE: 'library.circulate',
  /** Catalogue, library rules, waiving fines and reports. */
  LIBRARY_MANAGE: 'library.manage',
  // Food marketplace (Phase 7)
  /** A vendor managing their own profile, menu and orders. */
  VENDOR_OWN: 'vendor.own',
  /** Approve and suspend vendors, marketplace settings, settlements and payouts. */
  MARKETPLACE_MANAGE: 'marketplace.manage',
  // Student employment (Phase 8)
  /** Post campus jobs, review applicants, approve and suspend dispatchers, employment rules. */
  EMPLOYMENT_MANAGE: 'employment.manage',
  /** An approved student dispatcher taking and delivering orders. Comes with the Student Dispatcher add-on role. */
  DISPATCH_DELIVER: 'dispatch.deliver',
  // Fees and departmental dues
  /** Fee schedules, bills, recording bank payments, adjustments, clearance rules, dues settlements. */
  FEES_MANAGE: 'fees.manage',
  /** Departmental associations (EHASSA, BACA...), their officers, and voiding dues receipts. */
  ASSOCIATIONS_MANAGE: 'associations.manage',
  /** An elected association officer: set dues, see who has paid, record cash with a receipt. */
  DUES_COLLECT: 'dues.collect',
  /** Assign students to their own academic advisor (Heads of Department within their department, and the Registry). */
  ADVISORS_ASSIGN: 'advisors.assign',
  // Audit
  AUDIT_READ_ALL: 'audit.read_all',
  AUDIT_EXPORT: 'audit.export',
  // Notifications
  NOTIFICATION_TEMPLATES_MANAGE: 'notifications.templates.manage',
  NOTIFICATIONS_FAILED_READ: 'notifications.failed.read',
  // Settings
  SETTINGS_MANAGE: 'settings.manage',
  // Developer tools (only effective while developer access is enabled)
  SYSTEM_DIAGNOSTICS_READ: 'system.diagnostics.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Academic and financial decisions that belong to university offices. Super Admins manage the
 * platform, not results, exams or fees, so these are never part of the Super Admin role.
 */
export const ACADEMIC_DECISION_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.RESULTS_APPROVE_DEPARTMENT,
  PERMISSIONS.RESULTS_APPROVE_SCHOOL,
  PERMISSIONS.RESULTS_PUBLISH,
  PERMISSIONS.EXAMS_MANAGE,
  PERMISSIONS.FINANCE_CLEARANCE_MANAGE,
  PERMISSIONS.EXAM_HOLDS_MANAGE,
  PERMISSIONS.DEVOTION_MANAGE,
  PERMISSIONS.HOSTELS_MANAGE,
  PERMISSIONS.LIBRARY_CIRCULATE,
  PERMISSIONS.LIBRARY_MANAGE,
  PERMISSIONS.MARKETPLACE_MANAGE,
  PERMISSIONS.EMPLOYMENT_MANAGE,
  // Not a decision, but only meaningful for an approved student dispatcher.
  PERMISSIONS.DISPATCH_DELIVER,
  PERMISSIONS.FEES_MANAGE,
  PERMISSIONS.ASSOCIATIONS_MANAGE,
  PERMISSIONS.DUES_COLLECT,
  PERMISSIONS.ADVISORS_ASSIGN,
];

/** Permissions that are only granted while a DeveloperAccessGrant is active. */
export const DEVELOPER_ONLY_PERMISSIONS: PermissionKey[] = [PERMISSIONS.SYSTEM_DIAGNOSTICS_READ];
