import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ROLE_KEYS } from '@anu/shared';

@Injectable()
export class DeveloperAccessService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
  ) {}

  async onModuleInit() {
    await this.jobs.work(QUEUES.DEVELOPER_ACCESS_EXPIRE, () => this.expireGrants());
    await this.jobs.schedule(QUEUES.DEVELOPER_ACCESS_EXPIRE, '*/5 * * * *');
  }

  async list(search?: string) {
    const now = new Date();
    const staff = await this.prisma.user.findMany({
      where: {
        type: 'STAFF',
        deletedAt: null,
        ...(search
          ? { OR: [{ firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }
          : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        primaryRoleKey: true,
        developerGrants: {
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { id: true, enabledAt: true, expiresAt: true, reason: true, grantedBy: { select: { firstName: true, lastName: true } } },
          take: 1,
        },
      },
    });
    return staff.map(({ developerGrants, ...u }) => ({ ...u, activeGrant: developerGrants[0] ?? null }));
  }

  async enable(actor: AuthUser, userId: string, reason: string, expiresAt?: string) {
    if (actor.id === userId) throw new BadRequestException({ code: 'SELF_GRANT', message: 'Another Super Admin must enable Developer access on your account.' });
    const expiry = expiresAt ? new Date(expiresAt) : null;
    if (expiry && expiry <= new Date()) throw new BadRequestException({ code: 'EXPIRY_PAST', message: 'Choose an expiry time in the future.' });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, type: true, status: true } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Staff account not found.' });
    if (user.type !== 'STAFF') throw new BadRequestException({ code: 'NOT_STAFF', message: 'Developer access can only be enabled for staff accounts.' });

    const existing = await this.prisma.developerAccessGrant.findFirst({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (existing) throw new BadRequestException({ code: 'ALREADY_ENABLED', message: 'Developer access is already enabled for this account.' });

    const grant = await this.prisma.developerAccessGrant.create({
      data: { userId, grantedById: actor.id, reason, expiresAt: expiry },
    });
    await this.audit.record({ action: 'developer.access.enabled', module: 'rbac', targetType: 'User', targetId: userId, after: grant });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DEVELOPER_ACCESS_CHANGED,
      recipients: [{ userId }],
      channels: ['IN_APP', 'EMAIL'],
      sharedVars: { state: 'enabled', actor: actor.label, time: new Date().toISOString(), reason },
    });
    return grant;
  }

  async disable(actor: AuthUser, userId: string, reason: string) {
    const grant = await this.prisma.developerAccessGrant.findFirst({ where: { userId, revokedAt: null }, orderBy: { enabledAt: 'desc' } });
    if (!grant) throw new NotFoundException({ code: 'NOT_ENABLED', message: 'Developer access is not enabled for this account.' });

    const updated = await this.prisma.developerAccessGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date(), revokedById: actor.id, revokeReason: reason },
    });
    await this.endDeveloperSessions(userId);
    await this.audit.record({ action: 'developer.access.disabled', module: 'rbac', targetType: 'User', targetId: userId, before: grant, after: updated });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DEVELOPER_ACCESS_CHANGED,
      recipients: [{ userId }],
      channels: ['IN_APP', 'EMAIL'],
      sharedVars: { state: 'disabled', actor: actor.label, time: new Date().toISOString(), reason },
    });
    return updated;
  }

  /** Runs every 5 minutes. */
  async expireGrants() {
    const due = await this.prisma.developerAccessGrant.findMany({ where: { revokedAt: null, expiresAt: { lte: new Date() } } });
    for (const grant of due) {
      await this.prisma.developerAccessGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date(), revokeReason: 'Expired' } });
      await this.endDeveloperSessions(grant.userId);
      await this.audit.record({
        action: 'developer.access.expired',
        module: 'rbac',
        targetType: 'User',
        targetId: grant.userId,
        before: grant,
        actor: { id: grant.grantedById, label: 'System (scheduled expiry)', roleKey: ROLE_KEYS.SUPER_ADMIN },
      });
    }
  }

  /** Sessions working as Developer are moved back to the user's primary role. */
  private async endDeveloperSessions(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { primaryRoleKey: true } });
    await this.prisma.session.updateMany({
      where: { userId, activeRoleKey: ROLE_KEYS.DEVELOPER, revokedAt: null },
      data: { activeRoleKey: user?.primaryRoleKey ?? null },
    });
  }
}
