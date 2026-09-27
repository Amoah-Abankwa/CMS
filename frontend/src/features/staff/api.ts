import { api } from '@/lib/axios';

export interface AssignableRole {
  key: string;
  name: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  scopeType: 'department' | 'school' | null;
  singleHolder: boolean;
}

export interface SchoolNode {
  id: string;
  code: string;
  name: string;
  departments: Array<{ id: string; code: string; name: string }>;
}

export interface RoleChoice {
  roleKey: string;
  scopeId?: string;
}

export interface RoleSelection {
  roles: RoleChoice[];
  primaryRoleKey: string;
}

export interface StaffRole {
  key: string;
  name: string;
  scope: string | null;
  scopeLabel: string | null;
}

export interface StaffMember {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  primaryRoleKey: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  isDemo: boolean;
  staffProfile: { staffNumber: string; title: string | null; isTeaching: boolean; department: { id: string; name: string } | null } | null;
  roles: StaffRole[];
}

export interface CreateStaffInput extends RoleSelection {
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  staffNumber: string;
  departmentId?: string;
  isTeaching: boolean;
}

export const staffApi = {
  assignableRoles: () => api.get<AssignableRole[]>('/staff/assignable-roles').then((r) => r.data),
  structure: () => api.get<SchoolNode[]>('/academics/structure').then((r) => r.data),
  list: (params: { page: number; pageSize?: number; search?: string; roleKey?: string; status?: string }) =>
    api.get<{ items: StaffMember[]; total: number; page: number; pageSize: number }>('/staff', { params }).then((r) => r.data),
  get: (id: string) => api.get<StaffMember>(`/staff/${id}`).then((r) => r.data),
  create: (input: CreateStaffInput) => api.post<StaffMember>('/staff', input).then((r) => r.data),
  updateRoles: (id: string, selection: RoleSelection) => api.put<StaffMember>(`/staff/${id}/roles`, selection).then((r) => r.data),
  resendSetup: (id: string) => api.post(`/staff/${id}/resend-setup`),
  setStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED', reason: string) => api.post<{ status: string }>(`/staff/${id}/status`, { status, reason }).then((r) => r.data),
};

/** Turns a stored role list back into picker state. */
export function toSelection(member: StaffMember): RoleSelection {
  return {
    roles: member.roles.map((r) => ({ roleKey: r.key, scopeId: r.scope?.split(':')[1] })),
    primaryRoleKey: member.primaryRoleKey ?? member.roles[0]?.key ?? '',
  };
}

/** Returns a message for the first problem in a role selection, or null if it is complete. */
export function selectionProblem(selection: RoleSelection, roles: AssignableRole[]): string | null {
  if (selection.roles.length === 0) return 'Give the staff member at least one role.';
  for (const choice of selection.roles) {
    const role = roles.find((r) => r.key === choice.roleKey);
    if (role?.scopeType && !choice.scopeId) return `Choose the ${role.scopeType} for ${role.name}.`;
  }
  if (!selection.roles.some((r) => r.roleKey === selection.primaryRoleKey)) return 'Choose which role they sign in to.';
  return null;
}
