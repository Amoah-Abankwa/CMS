import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { generateNumericCode, sha256 } from '../../core/crypto/crypto.util';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import { AccountSetupService } from '../account-setup/account-setup.service';
import { RESET_CODE_MAX_ATTEMPTS, RESET_CODE_MINUTES } from './auth.constants';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly resolver: PermissionResolverService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly setup: AccountSetupService,
  ) {}

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
      select: {
        id: true, type: true, firstName: true, middleName: true, lastName: true, email: true, phone: true,
        indexNumber: true, mustChangePassword: true, primaryRoleKey: true,
        preference: { select: { theme: true, sidebarCollapsed: true } },
        studentProfile: { select: { admissionYear: true, currentLevel: true, programme: { select: { code: true, name: true } } } },
        staffProfile: { select: { staffNumber: true, title: true, department: { select: { name: true } } } },
      },
    });
    const [roles, permissions] = await Promise.all([
      this.resolver.availableRoles(auth.id),
      this.resolver.permissionsFor(auth.id, auth.activeRoleKey),
    ]);
    return {
      ...user,
      activeRoleKey: auth.activeRoleKey,
      roles,
      permissions: [...permissions],
      preference: user.preference ?? { theme: 'SYSTEM', sidebarCollapsed: false },
    };
  }

  async switchRole(auth: AuthUser, roleKey: string) {
    const roles = await this.resolver.availableRoles(auth.id);
    if (!roles.some((r) => r.key === roleKey)) throw new ForbiddenException({ code: 'ROLE_NOT_HELD', message: 'You do not hold that role.' });
    await this.prisma.session.update({ where: { id: auth.sessionId }, data: { activeRoleKey: roleKey } });
    await this.audit.record({ action: 'auth.role.switched', module: 'auth', metadata: { from: auth.activeRoleKey, to: roleKey } });
  }

  async stepUp(auth: AuthUser, code: string) {
    const method = await this.mfa.verify(auth.id, code);
    if (method !== 'totp') {
      await this.audit.record({ action: 'auth.step_up.failed', module: 'auth', result: 'FAILURE' });
      throw new UnauthorizedException({ code: 'MFA_CODE_INVALID', message: 'That code is not valid.' });
    }
    await this.prisma.session.update({ where: { id: auth.sessionId }, data: { mfaVerifiedAt: new Date() } });
    await this.audit.record({ action: 'auth.step_up.success', module: 'auth' });
  }

  async changePassword(auth: AuthUser, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } });
    if (!user.passwordHash || !(await this.passwords.verify(user.passwordHash, current))) {
      await this.audit.record({ action: 'auth.password.change_failed', module: 'auth', result: 'FAILURE' });
      throw new BadRequestException({ code: 'CURRENT_PASSWORD_WRONG', message: 'Your current password is incorrect.' });
    }
    if (current === next) throw new BadRequestException({ code: 'SAME_PASSWORD', message: 'Choose a password you have not just used.' });
    this.passwords.assertPolicy(next, [user.firstName, user.lastName, user.email?.split('@')[0] ?? '', user.indexNumber ?? '']);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(next), mustChangePassword: false } });
    await this.sessions.revokeAllExcept(user.id, auth.sessionId);
    await this.audit.record({ action: 'auth.password.changed', module: 'auth', targetType: 'User', targetId: user.id });
    await this.notifyPasswordChanged(user.id);
  }

  /** Always responds the same way so it cannot be used to discover accounts. */
  async forgotPassword(identifier: string) {
    const user = await this.findByIdentifier(identifier);
    // Someone who lost their welcome email gets a fresh setup link instead of a reset code.
    if (user?.status === 'PENDING_SETUP') {
      await this.setup.sendSetupLink(user.id).catch(() => undefined);
      return;
    }
    if (!user || user.status !== 'ACTIVE') {
      await this.audit.record({ action: 'auth.password.reset_requested', module: 'auth', result: 'FAILURE', metadata: { identifier } });
      return;
    }
    const code = generateNumericCode(6);
    await this.prisma.passwordResetCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.passwordResetCode.create({
      data: { userId: user.id, codeHash: sha256(`${user.id}:${code}`), expiresAt: new Date(Date.now() + RESET_CODE_MINUTES * 60_000) },
    });
    await this.audit.record({ action: 'auth.password.reset_requested', module: 'auth', actor: { id: user.id, label: identifier, roleKey: user.primaryRoleKey } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.PASSWORD_RESET_CODE,
      recipients: [{ userId: user.id, vars: { code } }],
      channels: ['EMAIL', 'SMS'],
      sensitive: true,
    });
  }

  async resetPassword(identifier: string, code: string, newPassword: string) {
    const fail = () => new BadRequestException({ code: 'RESET_CODE_INVALID', message: 'That code is not valid or has expired. Request a new one.' });
    const user = await this.findByIdentifier(identifier);
    if (!user) throw fail();
    const record = await this.prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.attempts >= RESET_CODE_MAX_ATTEMPTS) throw fail();
    if (record.codeHash !== sha256(`${user.id}:${code}`)) {
      await this.prisma.passwordResetCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw fail();
    }
    this.passwords.assertPolicy(newPassword, [user.firstName, user.lastName, user.email?.split('@')[0] ?? '', user.indexNumber ?? '']);
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(newPassword), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
      }),
    ]);
    await this.sessions.revokeAllExcept(user.id);
    await this.audit.record({ action: 'auth.password.reset', module: 'auth', actor: { id: user.id, label: identifier, roleKey: user.primaryRoleKey } });
    await this.notifyPasswordChanged(user.id);
  }

  private findByIdentifier(identifier: string) {
    const value = identifier.trim();
    return value.includes('@')
      ? this.prisma.user.findUnique({ where: { email: value.toLowerCase() } })
      : this.prisma.user.findUnique({ where: { indexNumber: value.toUpperCase() } });
  }

  private notifyPasswordChanged(userId: string) {
    return this.notifications.notify({
      eventKey: EVENT_KEYS.PASSWORD_CHANGED,
      recipients: [{ userId }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { time: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' }) },
    });
  }
}
