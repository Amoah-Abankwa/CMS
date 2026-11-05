import { sha256 } from '../../core/crypto/crypto.util';
import { randomInt } from 'node:crypto';
import { resetAuthenticator } from './mfa-reset';
import { maskEmail } from './mask-email';
import { ForbiddenException, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PasswordService } from './password.service';
import { SessionService, IssuedTokens } from './session.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { LOCK_MINUTES, MAX_FAILED_LOGINS } from './auth.constants';

type LoginUser = {
  id: string;
  type: 'STUDENT' | 'STAFF' | 'PARTNER';
  status: string;
  passwordHash: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  primaryRoleKey: string | null;
  mustChangePassword: boolean;
  firstName: string;
  lastName: string;
  email: string | null;
  indexNumber: string | null;
};

export type StudentLoginResult = { status: 'signed_in'; mustChangePassword: boolean; tokens: IssuedTokens };
export type StaffLoginResult = { status: 'mfa_required' | 'mfa_enrolment_required'; challengeToken: string };

const SELECT = {
  id: true, type: true, status: true, passwordHash: true, failedLoginCount: true, lockedUntil: true,
  primaryRoleKey: true, mustChangePassword: true, firstName: true, lastName: true, email: true, indexNumber: true,
} as const;

@Injectable()
export class LoginService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async studentLogin(indexNumber: string, password: string): Promise<StudentLoginResult> {
    const user = (await this.prisma.user.findUnique({ where: { indexNumber }, select: SELECT })) as LoginUser | null;
    await this.checkCredentials(user && user.type === 'STUDENT' ? user : null, password, indexNumber, 'Index number or password is incorrect.');
    const u = user!;
    await this.recordSuccess(u);
    const tokens = await this.sessions.create(u.id, u.primaryRoleKey, false);
    return { status: 'signed_in', mustChangePassword: u.mustChangePassword, tokens };
  }

  async staffLogin(email: string, password: string): Promise<StaffLoginResult> {
    const user = (await this.prisma.user.findUnique({ where: { email }, select: SELECT })) as LoginUser | null;
    await this.checkCredentials(user && user.type !== 'STUDENT' ? user : null, password, email, 'Email or password is incorrect.');
    const u = user!;
    const enrolled = await this.mfa.isEnrolled(u.id);
    await this.audit.record({ action: 'auth.login.password_ok', module: 'auth', metadata: { next: enrolled ? 'mfa' : 'mfa_enrolment' }, actor: this.actor(u) });
    return {
      status: enrolled ? 'mfa_required' : 'mfa_enrolment_required',
      challengeToken: await this.tokens.signChallenge(u.id, enrolled ? 'verify' : 'enrol'),
    };
  }

  /** Second step for staff. Accepts a TOTP code or a recovery code. */
  async completeMfa(challengeToken: string, code: string) {
    const challenge = await this.tokens.verifyChallenge(challengeToken);
    if (!challenge || challenge.purpose !== 'verify') {
      throw new UnauthorizedException({ code: 'CHALLENGE_EXPIRED', message: 'Your sign-in attempt expired. Start again.' });
    }
    const user = (await this.prisma.user.findUnique({ where: { id: challenge.sub }, select: SELECT })) as LoginUser;
    this.assertNotLocked(user);
    const method = await this.mfa.verify(user.id, code);
    if (!method) {
      await this.registerFailure(user, 'auth.mfa.failed');
      throw new UnauthorizedException({ code: 'MFA_CODE_INVALID', message: 'That code is not valid. Try the latest code in your app.' });
    }
    await this.recordSuccess(user, { mfaMethod: method });
    const tokens = await this.sessions.create(user.id, user.primaryRoleKey, true);
    return { mustChangePassword: user.mustChangePassword, usedRecoveryCode: method === 'recovery', tokens };
  }

  // ----- Signing in with an emailed code when the authenticator cannot be used -----

  /** Emails a one-time code, after the password step. At most three an hour; a new code replaces the last. */
  async sendMfaEmailCode(challengeToken: string) {
    const user = await this.verifyStepUser(challengeToken);
    if (!user.email) throw new BadRequestException({ code: 'NO_EMAIL', message: 'Your account has no email address. Ask ICT support to reset your authenticator.' });
    const lastHour = await this.prisma.mfaEmailCode.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
    if (lastHour >= 3) throw new BadRequestException({ code: 'TOO_MANY_CODES', message: 'Three codes have been sent in the last hour. Use the latest one, or try again later.' });
    await this.prisma.mfaEmailCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.mfaEmailCode.create({ data: { userId: user.id, codeHash: sha256(`${user.id}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await this.notifications.notify({ eventKey: EVENT_KEYS.MFA_EMAIL_CODE, recipients: [{ userId: user.id }], channels: ['EMAIL'], sharedVars: { code }, sensitive: true });
    await this.audit.record({ action: 'auth.mfa.email_code_sent', module: 'auth', targetType: 'User', targetId: user.id, actor: this.actor(user) });
    return { sentTo: maskEmail(user.email) };
  }

  /**
   * Accepts the emailed code instead of an authenticator code. The old authenticator and recovery
   * codes are removed, and the person must set up a new authenticator before they are signed in.
   */
  async verifyMfaEmailCode(challengeToken: string, code: string) {
    const user = await this.verifyStepUser(challengeToken);
    const row = await this.prisma.mfaEmailCode.findFirst({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!row) throw new UnauthorizedException({ code: 'CODE_EXPIRED', message: 'That code has expired or been used. Send a new one.' });
    if (row.codeHash !== sha256(`${user.id}:${code.trim()}`)) {
      const attempts = row.attempts + 1;
      await this.prisma.mfaEmailCode.update({ where: { id: row.id }, data: { attempts, ...(attempts >= 5 ? { usedAt: new Date() } : {}) } });
      await this.registerFailure(user, 'auth.mfa.email_code_failed');
      throw new UnauthorizedException({ code: 'CODE_INVALID', message: attempts >= 5 ? 'Too many wrong tries. Send a new code.' : 'That code is not right. Check the latest email.' });
    }
    await this.prisma.mfaEmailCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await resetAuthenticator(this.prisma, user.id);
    await this.audit.record({ action: 'auth.mfa.email_fallback', module: 'auth', targetType: 'User', targetId: user.id, actor: this.actor(user) });
    await this.notifications.notify({ eventKey: EVENT_KEYS.MFA_RESET_BY_EMAIL, recipients: [{ userId: user.id }], channels: ['EMAIL', 'IN_APP'], sharedVars: { time: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' }) } });
    return { status: 'mfa_enrolment_required' as const, challengeToken: await this.tokens.signChallenge(user.id, 'enrol') };
  }

  /** The person who passed the password step (a 'verify' challenge), if not locked. */
  private async verifyStepUser(challengeToken: string) {
    const challenge = await this.tokens.verifyChallenge(challengeToken);
    if (!challenge || challenge.purpose !== 'verify') throw new UnauthorizedException({ code: 'CHALLENGE_EXPIRED', message: 'Your sign-in attempt expired. Start again.' });
    const user = (await this.prisma.user.findUnique({ where: { id: challenge.sub }, select: SELECT })) as LoginUser;
    this.assertNotLocked(user);
    return user;
  }

  async startEnrolment(challengeToken: string) {
    const user = await this.enrolmentUser(challengeToken);
    return this.mfa.startEnrolment(user.id, user.email ?? user.id);
  }

  async confirmEnrolment(challengeToken: string, code: string) {
    const user = await this.enrolmentUser(challengeToken);
    const recoveryCodes = await this.mfa.confirmEnrolment(user.id, code);
    await this.audit.record({ action: 'auth.mfa.enrolled', module: 'auth', targetType: 'User', targetId: user.id, actor: this.actor(user) });
    await this.recordSuccess(user, { mfaMethod: 'enrolment' });
    const tokens = await this.sessions.create(user.id, user.primaryRoleKey, true);
    return { recoveryCodes, mustChangePassword: user.mustChangePassword, tokens };
  }

  private async enrolmentUser(challengeToken: string) {
    const challenge = await this.tokens.verifyChallenge(challengeToken);
    if (!challenge || challenge.purpose !== 'enrol') {
      throw new UnauthorizedException({ code: 'CHALLENGE_EXPIRED', message: 'Your sign-in attempt expired. Start again.' });
    }
    const user = (await this.prisma.user.findUnique({ where: { id: challenge.sub }, select: SELECT })) as LoginUser;
    this.assertNotLocked(user);
    return user;
  }

  private async checkCredentials(user: LoginUser | null, password: string, identifier: string, message: string) {
    if (!user || user.status === 'DEACTIVATED') {
      // Spend the same time as a real check so response timing does not reveal which accounts exist.
      this.dummyHash ??= this.passwords.hash('timing-equaliser-password');
      await this.passwords.verify(await this.dummyHash, password);
      await this.audit.record({ action: 'auth.login.failed', module: 'auth', result: 'FAILURE', metadata: { identifier, reason: 'unknown_account' } });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message });
    }
    if (user.status === 'PENDING_SETUP' || !user.passwordHash) {
      await this.audit.record({ action: 'auth.login.failed', module: 'auth', result: 'FAILURE', metadata: { reason: 'setup_pending' }, actor: this.actor(user) });
      throw new ForbiddenException({
        code: 'SETUP_PENDING',
        message: 'This account is not set up yet. Use the link in your welcome email, or choose "Forgot password" to get a new link.',
      });
    }
    this.assertNotLocked(user);
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'This account is suspended. Contact the Registry or ICT.' });
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.registerFailure(user, 'auth.login.failed');
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message });
    }
  }

  private assertNotLocked(user: LoginUser) {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException({ code: 'ACCOUNT_LOCKED', message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
    }
  }

  private async registerFailure(user: LoginUser, action: string) {
    const count = user.failedLoginCount + 1;
    const lock = count >= MAX_FAILED_LOGINS;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : count, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined },
    });
    await this.audit.record({ action, module: 'auth', result: 'FAILURE', metadata: { attempt: count }, actor: this.actor(user) });
    if (lock) {
      await this.audit.record({ action: 'auth.account.locked', module: 'auth', result: 'FAILURE', targetType: 'User', targetId: user.id, actor: this.actor(user) });
      await this.notifications.notify({
        eventKey: EVENT_KEYS.ACCOUNT_LOCKED,
        recipients: [{ userId: user.id }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { time: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' }) },
      });
    }
  }

  private async recordSuccess(user: LoginUser, metadata?: Record<string, unknown>) {
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.record({ action: 'auth.login.success', module: 'auth', metadata, actor: this.actor(user) });
  }

  private actor(user: LoginUser) {
    return { id: user.id, label: `${user.firstName} ${user.lastName} (${user.indexNumber ?? user.email})`, roleKey: user.primaryRoleKey };
  }
}
