export const ROLE_KEYS = {
  // Platform administration
  SUPER_ADMIN: 'super_admin',
  DEVELOPER: 'developer',
  // University leadership
  VICE_CHANCELLOR: 'vice_chancellor',
  PRO_VICE_CHANCELLOR: 'pro_vice_chancellor',
  // Academic
  DEAN: 'dean',
  HEAD_OF_DEPARTMENT: 'head_of_department',
  PROGRAMME_COORDINATOR: 'programme_coordinator',
  ACADEMIC_ADVISOR: 'academic_advisor',
  LECTURER: 'lecturer',
  TEACHING_ASSISTANT: 'teaching_assistant',
  // Registry, admissions and examinations
  REGISTRAR: 'registrar',
  ADMISSIONS_OFFICER: 'admissions_officer',
  EXAM_COORDINATOR: 'exam_coordinator',
  QA_OFFICER: 'qa_officer',
  // Student services
  DEAN_OF_STUDENTS: 'dean_of_students',
  COUNSELLOR: 'counsellor',
  CHAPLAINCY_OFFICER: 'chaplaincy_officer',
  HEALTH_OFFICER: 'health_officer',
  CAREER_SERVICES_OFFICER: 'career_services_officer',
  HOSTEL_MANAGER: 'hostel_manager',
  // Library
  LIBRARIAN: 'librarian',
  LIBRARY_ASSISTANT: 'library_assistant',
  // Operations and support
  FINANCE_OFFICER: 'finance_officer',
  HR_OFFICER: 'hr_officer',
  ICT_SUPPORT: 'ict_support',
  SECURITY_OFFICER: 'security_officer',
  INTERNAL_AUDITOR: 'internal_auditor',
  // External partners (not staff)
  EXTERNAL_EXAMINER: 'external_examiner',
  PRIVATE_HOSTEL_OWNER: 'private_hostel_owner',
  VENDOR: 'vendor',
  // Students
  STUDENT: 'student',
  STUDENT_DISPATCHER: 'student_dispatcher',
  ASSOCIATION_OFFICER: 'association_officer',
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export type RoleScopeType = 'department' | 'school';

/** Roles that must be tied to a department or school when assigned. */
export const ROLE_SCOPE: Partial<Record<RoleKey, RoleScopeType>> = {
  [ROLE_KEYS.HEAD_OF_DEPARTMENT]: 'department',
  [ROLE_KEYS.PROGRAMME_COORDINATOR]: 'department',
  [ROLE_KEYS.ACADEMIC_ADVISOR]: 'department',
  [ROLE_KEYS.DEAN]: 'school',
};

/**
 * Roles only one person may hold at a time: per department or school for scoped roles,
 * university-wide for the others.
 */
export const SINGLE_HOLDER_ROLES: RoleKey[] = [
  ROLE_KEYS.HEAD_OF_DEPARTMENT,
  ROLE_KEYS.DEAN,
  ROLE_KEYS.VICE_CHANCELLOR,
  ROLE_KEYS.DEAN_OF_STUDENTS,
];

/**
 * Add-on roles extend another role instead of being switched into. A student approved as a dispatcher
 * keeps working as a student and gains the dispatcher's permissions, so they never have to switch
 * roles in the middle of a delivery.
 */
export const ADD_ON_ROLES: Partial<Record<RoleKey, RoleKey[]>> = {
  [ROLE_KEYS.STUDENT]: [ROLE_KEYS.STUDENT_DISPATCHER, ROLE_KEYS.ASSOCIATION_OFFICER],
};
export const IS_ADD_ON_ROLE = (key: string) => Object.values(ADD_ON_ROLES).some((list) => list?.includes(key as RoleKey));

export type RoleCategory = 'leadership' | 'academic' | 'registry' | 'student_services' | 'library' | 'operations' | 'administration';

export const ROLE_CATEGORY_LABELS: Record<RoleCategory, string> = {
  leadership: 'University leadership',
  academic: 'Academic',
  registry: 'Registry, admissions and examinations',
  student_services: 'Student services',
  library: 'Library',
  operations: 'Finance, HR, ICT and security',
  administration: 'Platform administration',
};

/**
 * Roles a Super Admin can give to a staff account, in the order the role picker shows them.
 * Developer is excluded (granted separately and temporarily), as are student and partner roles.
 */
export const STAFF_ROLE_CATEGORY: Partial<Record<RoleKey, RoleCategory>> = {
  [ROLE_KEYS.VICE_CHANCELLOR]: 'leadership',
  [ROLE_KEYS.PRO_VICE_CHANCELLOR]: 'leadership',
  [ROLE_KEYS.DEAN]: 'academic',
  [ROLE_KEYS.HEAD_OF_DEPARTMENT]: 'academic',
  [ROLE_KEYS.PROGRAMME_COORDINATOR]: 'academic',
  [ROLE_KEYS.ACADEMIC_ADVISOR]: 'academic',
  [ROLE_KEYS.LECTURER]: 'academic',
  [ROLE_KEYS.TEACHING_ASSISTANT]: 'academic',
  [ROLE_KEYS.REGISTRAR]: 'registry',
  [ROLE_KEYS.ADMISSIONS_OFFICER]: 'registry',
  [ROLE_KEYS.EXAM_COORDINATOR]: 'registry',
  [ROLE_KEYS.QA_OFFICER]: 'registry',
  [ROLE_KEYS.DEAN_OF_STUDENTS]: 'student_services',
  [ROLE_KEYS.COUNSELLOR]: 'student_services',
  [ROLE_KEYS.CHAPLAINCY_OFFICER]: 'student_services',
  [ROLE_KEYS.HEALTH_OFFICER]: 'student_services',
  [ROLE_KEYS.CAREER_SERVICES_OFFICER]: 'student_services',
  [ROLE_KEYS.HOSTEL_MANAGER]: 'student_services',
  [ROLE_KEYS.LIBRARIAN]: 'library',
  [ROLE_KEYS.LIBRARY_ASSISTANT]: 'library',
  [ROLE_KEYS.FINANCE_OFFICER]: 'operations',
  [ROLE_KEYS.HR_OFFICER]: 'operations',
  [ROLE_KEYS.ICT_SUPPORT]: 'operations',
  [ROLE_KEYS.SECURITY_OFFICER]: 'operations',
  [ROLE_KEYS.INTERNAL_AUDITOR]: 'operations',
  [ROLE_KEYS.SUPER_ADMIN]: 'administration',
};

export const STAFF_ASSIGNABLE_ROLES = Object.keys(STAFF_ROLE_CATEGORY) as RoleKey[];

/** Roles for accounts of type PARTNER (created in a later phase). */
export const PARTNER_ROLES: RoleKey[] = [ROLE_KEYS.EXTERNAL_EXAMINER, ROLE_KEYS.PRIVATE_HOSTEL_OWNER, ROLE_KEYS.VENDOR];

export function scopeValue(type: RoleScopeType, id: string) {
  return `${type}:${id}`;
}

export function parseScope(scope: string | null | undefined): { type: RoleScopeType; id: string } | null {
  if (!scope) return null;
  const [type, id] = scope.split(':');
  return (type === 'department' || type === 'school') && id ? { type, id } : null;
}
