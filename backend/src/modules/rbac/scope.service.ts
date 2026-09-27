import { ForbiddenException, Injectable } from '@nestjs/common';
import { parseScope } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Which departments the signed-in person's active role covers.
 * - Scoped roles (Head of Department, Programme Coordinator, Academic Advisor): their department.
 * - Dean: every department in their school.
 * - Unscoped roles holding the permission (Registrar, Super Admin): everything, returned as null.
 */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async departmentIds(user: AuthUser): Promise<string[] | null> {
    if (!user.activeRoleKey) return [];
    const now = new Date();
    const grants = await this.prisma.userRole.findMany({
      where: { userId: user.id, role: { key: user.activeRoleKey }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { scope: true },
    });
    if (grants.length === 0) return [];
    if (grants.some((g) => !g.scope)) return null;

    const ids = new Set<string>();
    for (const g of grants) {
      const scope = parseScope(g.scope);
      if (!scope) continue;
      if (scope.type === 'department') ids.add(scope.id);
      else {
        const depts = await this.prisma.department.findMany({ where: { schoolId: scope.id }, select: { id: true } });
        depts.forEach((d) => ids.add(d.id));
      }
    }
    return [...ids];
  }

  /** Throws unless the department is inside the person's scope. */
  async assertDepartment(user: AuthUser, departmentId: string) {
    const ids = await this.departmentIds(user);
    if (ids !== null && !ids.includes(departmentId)) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'That belongs to a department outside your role.' });
    }
  }

  /** Prisma filter helper: `{ in: ids }` or undefined when unrestricted. */
  async departmentFilter(user: AuthUser) {
    const ids = await this.departmentIds(user);
    return ids === null ? undefined : { in: ids };
  }
}
