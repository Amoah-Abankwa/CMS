import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { ScopeService } from '../rbac/scope.service';

/**
 * Students' own academic advisors. A Head of Department assigns within their department; the Registry
 * anywhere. An advisor with advisees reviews only them; one with none still reviews the whole department.
 */
@Injectable()
export class AdvisorsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly audit: AuditService) {}

  /** Advisors (staff with the Academic Advisor role for this department) and the department's students with their advisor. */
  async department(user: AuthUser, departmentId: string) {
    await this.scope.assertDepartment(user, departmentId);
    const [advisors, students] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: 'ACTIVE', roles: { some: { role: { key: ROLE_KEYS.ACADEMIC_ADVISOR }, scope: departmentId } } },
        orderBy: { lastName: 'asc' },
        select: { id: true, firstName: true, lastName: true, email: true, staffProfile: { select: { title: true } }, _count: { select: { advisees: true } } },
      }),
      this.prisma.user.findMany({
        where: { type: 'STUDENT', status: { in: ['ACTIVE', 'PENDING_SETUP'] }, studentProfile: { programme: { departmentId } } },
        orderBy: { indexNumber: 'asc' },
        select: { id: true, firstName: true, lastName: true, indexNumber: true, studentProfile: { select: { currentLevel: true, programme: { select: { name: true } } } }, advisor: { select: { advisorId: true } } },
      }),
    ]);
    return { advisors: advisors.map(({ staffProfile, ...a }) => ({ ...a, title: staffProfile?.title ?? null })), students: students.map((s) => ({ ...s, advisorId: s.advisor?.advisorId ?? null, advisor: undefined })) };
  }

  async departments(user: AuthUser) {
    return this.prisma.department.findMany({ where: { id: await this.scope.departmentFilter(user) }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  }

  async assign(user: AuthUser, departmentId: string, advisorId: string | null, indexNumbers: string[]) {
    await this.scope.assertDepartment(user, departmentId);
    if (advisorId) {
      const ok = await this.prisma.user.count({ where: { id: advisorId, status: 'ACTIVE', roles: { some: { role: { key: ROLE_KEYS.ACADEMIC_ADVISOR }, scope: departmentId } } } });
      if (!ok) throw new BadRequestException({ code: 'NOT_ADVISOR', message: 'Choose an academic advisor of this department.' });
    }
    const wanted = [...new Set(indexNumbers.map((i) => i.trim().toUpperCase()).filter(Boolean))];
    const students = await this.prisma.user.findMany({ where: { type: 'STUDENT', indexNumber: { in: wanted }, studentProfile: { programme: { departmentId } } }, select: { id: true, indexNumber: true } });
    if (!students.length) throw new NotFoundException({ code: 'NOT_FOUND', message: 'None of those index numbers are students of this department.' });
    await this.prisma.$transaction(
      students.map((s) =>
        advisorId
          ? this.prisma.advisorAssignment.upsert({ where: { studentId: s.id }, create: { studentId: s.id, advisorId, assignedById: user.id }, update: { advisorId, assignedById: user.id } })
          : this.prisma.advisorAssignment.deleteMany({ where: { studentId: s.id } }),
      ),
    );
    await this.audit.record({ action: advisorId ? 'registrations.advisor_assigned' : 'registrations.advisor_removed', module: 'registrations', targetType: 'User', targetId: advisorId ?? undefined, metadata: { students: students.map((s) => s.indexNumber) } });
    const found = new Set(students.map((s) => s.indexNumber));
    return { changed: students.length, notFound: wanted.filter((w) => !found.has(w)) };
  }

  /** For registration review: the students this advisor should see, or null for the whole department. */
  async adviseeFilter(user: AuthUser): Promise<string[] | null> {
    if (user.activeRoleKey !== ROLE_KEYS.ACADEMIC_ADVISOR) return null;
    const mine = await this.prisma.advisorAssignment.findMany({ where: { advisorId: user.id }, select: { studentId: true } });
    return mine.length ? mine.map((m) => m.studentId) : null;
  }
}
