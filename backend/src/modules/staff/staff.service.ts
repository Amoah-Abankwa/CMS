import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import { loadEnv } from '../../core/config/env';
import { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { AccountSetupService } from '../account-setup/account-setup.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { StaffRolesService } from './staff-roles.service';
import { CreateStaffDto, ListStaffDto, RoleSetDto } from './dto/staff.dto';

const STAFF_SELECT = {
  id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, status: true,
  primaryRoleKey: true, lastLoginAt: true, createdAt: true, isDemo: true,
  staffProfile: { select: { staffNumber: true, title: true, isTeaching: true, department: { select: { id: true, name: true } } } },
  roles: { select: { scope: true, role: { select: { key: true, name: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: StaffRolesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly setup: AccountSetupService,
  ) {}

  async create(dto: CreateStaffDto) {
    const phone = this.phone(dto.phone);
    if (dto.departmentId) await this.assertDepartment(dto.departmentId);
    const resolved = await this.roles.resolve(dto);

    let created;
    try {
      created = await this.prisma.user.create({
        data: {
          type: 'STAFF',
          status: 'PENDING_SETUP',
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          email: dto.email,
          phone,
          primaryRoleKey: dto.primaryRoleKey,
          isDemo: loadEnv().DEMO_MODE,
          staffProfile: { create: { staffNumber: dto.staffNumber, title: dto.title, departmentId: dto.departmentId, isTeaching: dto.isTeaching } },
          roles: { create: resolved.map((r) => ({ roleId: r.roleId, scope: r.scope })) },
        },
        select: STAFF_SELECT,
      });
    } catch (err) {
      throw this.uniqueError(err);
    }

    await this.audit.record({ action: 'staff.created', module: 'staff', targetType: 'User', targetId: created.id, after: created });
    await this.setup.sendSetupLink(created.id, { roles: await this.roles.describe(resolved) });
    return this.present(created);
  }

  async list(q: ListStaffDto) {
    const where: Prisma.UserWhereInput = {
      type: 'STAFF',
      deletedAt: null,
      ...(q.status ? { status: q.status as Prisma.UserWhereInput['status'] } : {}),
      ...(q.roleKey ? { roles: { some: { role: { key: q.roleKey } } } } : {}),
      ...(q.departmentId ? { staffProfile: { departmentId: q.departmentId } } : {}),
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' as const } },
              { lastName: { contains: q.search, mode: 'insensitive' as const } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
              { staffProfile: { staffNumber: { contains: q.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: STAFF_SELECT }),
      this.prisma.user.count({ where }),
    ]);
    const labels = await this.roles.scopeLabels(rows.flatMap((r) => r.roles.map((x) => x.scope)));
    return { items: rows.map((r) => this.present(r, labels)), total, page: q.page, pageSize: q.pageSize };
  }

  async get(id: string) {
    const staff = await this.prisma.user.findFirst({ where: { id, type: 'STAFF' }, select: STAFF_SELECT });
    if (!staff) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Staff member not found.' });
    const labels = await this.roles.scopeLabels(staff.roles.map((r) => r.scope));
    return this.present(staff, labels);
  }

  /** Replaces the person's roles with the given set. */
  async updateRoles(actor: AuthUser, id: string, dto: RoleSetDto) {
    if (actor.id === id) {
      throw new ForbiddenException({ code: 'SELF_ROLE_CHANGE', message: 'Another Super Admin must change your own roles.' });
    }
    const before = await this.prisma.user.findFirst({ where: { id, type: 'STAFF' }, select: STAFF_SELECT });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Staff member not found.' });

    const resolved = await this.roles.resolve(dto, id);
    const losingSuperAdmin = before.roles.some((r) => r.role.key === ROLE_KEYS.SUPER_ADMIN) && !resolved.some((r) => r.key === ROLE_KEYS.SUPER_ADMIN);
    if (losingSuperAdmin) {
      const others = await this.prisma.userRole.count({ where: { role: { key: ROLE_KEYS.SUPER_ADMIN }, userId: { not: id }, user: { status: 'ACTIVE' } } });
      if (others === 0) throw new BadRequestException({ code: 'LAST_SUPER_ADMIN', message: 'The university must keep at least one active Super Admin.' });
    }

    const keys = resolved.map((r) => r.key);
    const after = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: resolved.map((r) => ({ userId: id, roleId: r.roleId, scope: r.scope })) });
      // Sessions working in a role that was removed fall back to the sign-in role.
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null, activeRoleKey: { notIn: [...keys, ROLE_KEYS.DEVELOPER] } },
        data: { activeRoleKey: dto.primaryRoleKey },
      });
      return tx.user.update({ where: { id }, data: { primaryRoleKey: dto.primaryRoleKey }, select: STAFF_SELECT });
    });

    await this.audit.record({
      action: 'staff.roles.updated',
      module: 'staff',
      targetType: 'User',
      targetId: id,
      before: { roles: before.roles, primaryRoleKey: before.primaryRoleKey },
      after: { roles: after.roles, primaryRoleKey: after.primaryRoleKey },
    });
    if (before.status === 'ACTIVE') {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.STAFF_ROLES_UPDATED,
        recipients: [{ userId: id }],
        channels: ['IN_APP', 'EMAIL'],
        sharedVars: { actor: actor.label, roles: await this.roles.describe(resolved) },
      });
    }
    return this.get(id);
  }

  async resendSetup(id: string) {
    const staff = await this.prisma.user.findFirst({ where: { id, type: 'STAFF' }, select: { id: true, roles: { select: { scope: true, role: { select: { name: true } } } } } });
    if (!staff) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Staff member not found.' });
    await this.setup.sendSetupLink(id, { roles: await this.roles.describe(staff.roles.map((r) => ({ name: r.role.name, scope: r.scope }))) });
  }

  private present(u: Prisma.UserGetPayload<{ select: typeof STAFF_SELECT }>, labels = new Map<string, string>()) {
    return {
      ...u,
      roles: u.roles.map((r) => ({ key: r.role.key, name: r.role.name, scope: r.scope, scopeLabel: r.scope ? labels.get(r.scope) ?? null : null })),
    };
  }

  private phone(value?: string) {
    if (!value) return undefined;
    try {
      return normaliseGhanaPhone(value);
    } catch (e) {
      throw new BadRequestException({ code: 'PHONE_INVALID', message: (e as Error).message });
    }
  }

  private async assertDepartment(id: string) {
    const d = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!d) throw new BadRequestException({ code: 'DEPARTMENT_UNKNOWN', message: 'Choose a valid department.' });
  }

  private uniqueError(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String((err.meta as { target?: unknown } | undefined)?.target ?? '');
      return new ConflictException(
        target.includes('staffNumber')
          ? { code: 'STAFF_NUMBER_TAKEN', message: 'Another staff member already has this staff number.' }
          : { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' },
      );
    }
    return err;
  }

  /**
   * Suspend (temporary), deactivate (left the university) or reactivate a staff or partner account.
   * Suspending or deactivating ends every session at once; the sign-in check refuses the account
   * from its next request. Nobody can lock themselves out, and the last Super Admin cannot be locked out.
   */
  async setStatus(actor: AuthUser, id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED', reason: string) {
    if (actor.id === id) throw new ForbiddenException({ code: 'SELF', message: 'Another administrator must change your own account.' });
    const user = await this.prisma.user.findFirst({ where: { id, type: { in: ['STAFF', 'PARTNER'] } }, select: { id: true, status: true, firstName: true, lastName: true, roles: { select: { role: { select: { key: true } } } } } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Account not found.' });
    if (user.status === 'PENDING_SETUP' && status === 'ACTIVE') throw new BadRequestException({ code: 'PENDING', message: 'This person has not set up their account yet. Resend the setup link instead.' });
    if (user.status === status) return { status };
    if (status !== 'ACTIVE' && user.roles.some((r) => r.role.key === ROLE_KEYS.SUPER_ADMIN)) {
      const others = await this.prisma.user.count({ where: { id: { not: id }, status: 'ACTIVE', roles: { some: { role: { key: ROLE_KEYS.SUPER_ADMIN } } } } });
      if (others === 0) throw new ConflictException({ code: 'LAST_ADMIN', message: 'This is the only active Super Admin. Add another before locking this account.' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status, ...(status === 'ACTIVE' ? { failedLoginCount: 0, lockedUntil: null } : {}) } });
      if (status !== 'ACTIVE') await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    await this.audit.record({ action: 'staff.status_changed', module: 'staff', targetType: 'User', targetId: id, before: { status: user.status }, after: { status, reason } });
    return { status };
  }
}
