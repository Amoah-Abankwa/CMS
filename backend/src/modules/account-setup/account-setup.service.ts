import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { loadEnv } from '../../core/config/env';
import { randomToken, sha256 } from '../../core/crypto/crypto.util';
import { AuditService } from '../audit/audit.service';
import { NotificationsService, type Channel } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PasswordService } from '../auth/password.service';

export const SETUP_LINK_HOURS = 72;

const INVALID = () =>
  new BadRequestException({
    code: 'SETUP_LINK_INVALID',
    message: 'This setup link is invalid, expired or already used. Ask the Registry (students) or ICT (staff) to send a new one.',
  });

/**
 * New accounts never receive a password. They receive a one-time link and choose their own.
 */
@Injectable()
export class AccountSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Creates a fresh link (older unused links stop working) and emails it. */
  async sendSetupLink(userId: string, extraVars: Record<string, string> = {}) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, type: true, status: true, email: true, indexNumber: true },
    });
    if (user.status !== 'PENDING_SETUP') {
      throw new BadRequestException({ code: 'ALREADY_SET_UP', message: 'This account has already been set up. The owner can use "Forgot password" instead.' });
    }
    if (!user.email) throw new BadRequestException({ code: 'NO_EMAIL', message: 'Add an email address to this account first.' });

    const raw = randomToken(32);
    await this.prisma.$transaction([
      this.prisma.accountSetupToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.accountSetupToken.create({
        data: { userId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + SETUP_LINK_HOURS * 3_600_000) },
      }),
    ]);

    const isStudent = user.type === 'STUDENT';
    const channels: Channel[] = isStudent ? ['EMAIL', 'SMS'] : ['EMAIL'];
    await this.notifications.notify({
      eventKey: isStudent ? EVENT_KEYS.STUDENT_ACCOUNT_CREATED : user.type === 'PARTNER' ? EVENT_KEYS.PARTNER_ACCOUNT_CREATED : EVENT_KEYS.STAFF_ACCOUNT_CREATED,
      recipients: [
        {
          userId,
          vars: {
            setupUrl: `${loadEnv().WEB_ORIGIN}/setup-account?token=${raw}`,
            expiresHours: SETUP_LINK_HOURS,
            email: user.email,
            indexNumber: user.indexNumber ?? '',
            ...extraVars,
          },
        },
      ],
      channels,
      // The link grants account access, so its text is removed from the database after sending.
      sensitive: true,
    });
    await this.audit.record({ action: 'account.setup_link.sent', module: 'accounts', targetType: 'User', targetId: userId });
  }

  /** Lets the setup page greet the person and show which identifier they will sign in with. */
  async describe(raw: string) {
    const token = await this.findValid(raw);
    const u = token.user;
    return {
      firstName: u.firstName,
      type: u.type,
      signInWith: u.type === 'STUDENT' ? u.indexNumber : u.email,
    };
  }

  async complete(raw: string, password: string) {
    const token = await this.findValid(raw);
    const u = token.user;
    this.passwords.assertPolicy(password, [u.firstName, u.lastName, u.email?.split('@')[0] ?? '', u.indexNumber ?? '']);
    const passwordHash = await this.passwords.hash(password);

    // Marking the token used inside the same transaction stops a double submit from succeeding twice.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.accountSetupToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw INVALID();
      await tx.user.update({ where: { id: u.id }, data: { passwordHash, status: 'ACTIVE', mustChangePassword: false } });
    });

    await this.audit.record({
      action: 'account.setup.completed',
      module: 'accounts',
      targetType: 'User',
      targetId: u.id,
      actor: { id: u.id, label: `${u.firstName} ${u.lastName} (${u.indexNumber ?? u.email})`, roleKey: u.primaryRoleKey },
    });
    return { type: u.type, signInWith: u.type === 'STUDENT' ? u.indexNumber : u.email };
  }

  private async findValid(raw: string) {
    if (!raw || raw.length < 20 || raw.length > 100) throw INVALID();
    const token = await this.prisma.accountSetupToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: {
        user: { select: { id: true, type: true, status: true, firstName: true, lastName: true, email: true, indexNumber: true, primaryRoleKey: true } },
      },
    });
    if (!token || token.usedAt || token.expiresAt < new Date() || token.user.status !== 'PENDING_SETUP') throw INVALID();
    return token;
  }
}
