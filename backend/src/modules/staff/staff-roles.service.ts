import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ROLE_CATEGORY_LABELS, ROLE_KEYS, ROLE_SCOPE, RoleKey, SINGLE_HOLDER_ROLES, STAFF_ASSIGNABLE_ROLES, STAFF_ROLE_CATEGORY, parseScope, scopeValue } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { RoleSetDto } from './dto/staff.dto';

export interface ResolvedRole {
  roleId: string;
  key: string;
  name: string;
  scope: string | null;
}

@Injectable()
export class StaffRolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Roles shown in the role picker, with whether each needs a department or school. */
  async assignable() {
    const roles = await this.prisma.role.findMany({
      where: { key: { in: STAFF_ASSIGNABLE_ROLES } },
      select: { key: true, name: true, description: true },
    });
    const order = new Map(STAFF_ASSIGNABLE_ROLES.map((k, i) => [k as string, i]));
    return roles
      .sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99))
      .map((r) => {
        const category = STAFF_ROLE_CATEGORY[r.key as RoleKey] ?? 'administration';
        return {
          ...r,
          category,
          categoryLabel: ROLE_CATEGORY_LABELS[category],
          scopeType: ROLE_SCOPE[r.key as RoleKey] ?? null,
          singleHolder: SINGLE_HOLDER_ROLES.includes(r.key as RoleKey),
        };
      });
  }

  /**
   * Checks a requested role set and returns what to store. Rules:
   * each role at most once; Head of Department needs a department and Dean a school;
   * only one current holder per department or school; the sign-in role must be in the set.
   */
  async resolve(dto: RoleSetDto, forUserId?: string): Promise<ResolvedRole[]> {
    const keys = dto.roles.map((r) => r.roleKey);
    if (new Set(keys).size !== keys.length) throw new BadRequestException({ code: 'DUPLICATE_ROLE', message: 'Each role can only be given once.' });
    if (!keys.includes(dto.primaryRoleKey)) {
      throw new BadRequestException({ code: 'PRIMARY_NOT_ASSIGNED', message: 'The sign-in role must be one of the selected roles.' });
    }

    const roles = await this.prisma.role.findMany({ where: { key: { in: keys } }, select: { id: true, key: true, name: true } });
    const byKey = new Map(roles.map((r) => [r.key, r]));
    const resolved: ResolvedRole[] = [];

    for (const request of dto.roles) {
      const role = byKey.get(request.roleKey);
      if (!role) throw new BadRequestException({ code: 'ROLE_UNKNOWN', message: `Role ${request.roleKey} does not exist. Run the seed.` });
      const scopeType = ROLE_SCOPE[role.key as RoleKey];
      let scope: string | null = null;

      if (scopeType) {
        if (!request.scopeId) {
          throw new BadRequestException({ code: 'SCOPE_REQUIRED', message: `Choose the ${scopeType} for ${role.name}.` });
        }
        const exists =
          scopeType === 'department'
            ? await this.prisma.department.findUnique({ where: { id: request.scopeId }, select: { id: true } })
            : await this.prisma.school.findUnique({ where: { id: request.scopeId }, select: { id: true } });
        if (!exists) throw new BadRequestException({ code: 'SCOPE_UNKNOWN', message: `That ${scopeType} no longer exists.` });
        scope = scopeValue(scopeType, request.scopeId);
      }

      // Scoped single-holder roles: one per department or school. Unscoped ones: one university-wide.
      if (SINGLE_HOLDER_ROLES.includes(role.key as RoleKey)) {
        const holder = await this.prisma.userRole.findFirst({
          where: { roleId: role.id, scope, user: { status: { not: 'DEACTIVATED' } }, ...(forUserId ? { userId: { not: forUserId } } : {}) },
          select: { user: { select: { firstName: true, lastName: true } } },
        });
        if (holder) {
          throw new ConflictException({
            code: 'ROLE_HELD',
            message: `${holder.user.firstName} ${holder.user.lastName} is already ${role.name}${scope ? ' there' : ''}. Remove that role from them first.`,
          });
        }
      }
      resolved.push({ roleId: role.id, key: role.key, name: role.name, scope });
    }
    return resolved;
  }

  /** Human-readable role list such as "Lecturer, Head of Department (Computer Science)". */
  async describe(roles: Array<{ name: string; scope: string | null }>): Promise<string> {
    const labels = await this.scopeLabels(roles.map((r) => r.scope));
    return roles.map((r) => (r.scope && labels.get(r.scope) ? `${r.name} (${labels.get(r.scope)})` : r.name)).join(', ');
  }

  async scopeLabels(scopes: Array<string | null>): Promise<Map<string, string>> {
    const parsed = scopes.map(parseScope).filter((s): s is NonNullable<typeof s> => !!s);
    const deptIds = parsed.filter((p) => p.type === 'department').map((p) => p.id);
    const schoolIds = parsed.filter((p) => p.type === 'school').map((p) => p.id);
    const [depts, schools] = await Promise.all([
      deptIds.length ? this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }) : [],
      schoolIds.length ? this.prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } }) : [],
    ]);
    return new Map([
      ...depts.map((d) => [scopeValue('department', d.id), d.name] as const),
      ...schools.map((s) => [scopeValue('school', s.id), s.name] as const),
    ]);
  }

  isSuperAdminRole(key: string) {
    return key === ROLE_KEYS.SUPER_ADMIN;
  }
}
