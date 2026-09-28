import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { checkEligibility, formatCedis, ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { EligibilityService } from './eligibility.service';
import { EmploymentRulesService } from './employment-rules.service';
import { DispatcherApplyDto, DispatcherReviewDto } from './dto/employment.dto';

const ACTIVE_DELIVERY = ['ASSIGNED', 'PICKED_UP'] as const;

/**
 * Students apply to deliver; Career Services (or the Dean of Students) approves them. Approval adds the
 * Student Dispatcher role on top of the Student role. Anyone who stops meeting the rules is suspended
 * by the daily check once they have no delivery in hand.
 */
@Injectable()
export class DispatchersService {
  private readonly logger = new Logger(DispatchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: EligibilityService,
    private readonly rules: EmploymentRulesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ----- Students -----

  async mine(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Dispatching is for students.' });
    const [profile, elig, rules] = await Promise.all([
      this.prisma.dispatcherProfile.findUnique({ where: { studentId: user.id }, select: { id: true, status: true, statement: true, transport: true, payoutNetwork: true, payoutNumber: true, payoutName: true, statusNote: true, createdAt: true, reviewedAt: true } }),
      this.eligibility.check(user.id),
      this.rules.get(),
    ]);
    return { profile, eligibility: elig, feePerDelivery: rules.dispatchFee };
  }

  async apply(user: AuthUser, dto: DispatcherApplyDto) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Dispatching is for students.' });
    const elig = await this.eligibility.check(user.id);
    if (!elig.eligible) throw new ForbiddenException({ code: 'NOT_ELIGIBLE', message: elig.reasons.join(' ') });
    const existing = await this.prisma.dispatcherProfile.findUnique({ where: { studentId: user.id } });
    if (existing && ['PENDING', 'ACTIVE', 'SUSPENDED'].includes(existing.status)) {
      throw new ConflictException({ code: 'EXISTS', message: existing.status === 'SUSPENDED' ? 'Your dispatcher account is suspended. Contact Career Services.' : 'You have already applied.' });
    }
    const data = { ...dto, payoutNumber: normaliseGhanaPhone(dto.payoutNumber), status: 'PENDING' as const, cgpaAtApply: elig.cgpa, statusNote: null, reviewedAt: null, reviewedById: null, online: false };
    const profile = existing
      ? await this.prisma.dispatcherProfile.update({ where: { id: existing.id }, data })
      : await this.prisma.dispatcherProfile.create({ data: { ...data, studentId: user.id } });
    await this.audit.record({ action: 'employment.dispatcher_applied', module: 'employment', targetType: 'DispatcherProfile', targetId: profile.id });
    return profile;
  }

  /** Dispatchers keep their payout details up to date themselves. */
  async updatePayout(user: AuthUser, dto: Pick<DispatcherApplyDto, 'payoutNetwork' | 'payoutNumber' | 'payoutName' | 'transport'>) {
    const profile = await this.prisma.dispatcherProfile.findUnique({ where: { studentId: user.id } });
    if (!profile) throw new NotFoundException({ code: 'NOT_FOUND', message: 'You have not applied to deliver.' });
    await this.prisma.dispatcherProfile.update({ where: { id: profile.id }, data: { payoutNetwork: dto.payoutNetwork, payoutNumber: normaliseGhanaPhone(dto.payoutNumber), payoutName: dto.payoutName, transport: dto.transport } });
    await this.audit.record({ action: 'employment.dispatcher_payout_changed', module: 'employment', targetType: 'DispatcherProfile', targetId: profile.id });
    return { ok: true };
  }

  // ----- Career Services -----

  async list(status?: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const profiles = await this.prisma.dispatcherProfile.findMany({
      where: status ? { status: status as never } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, status: true, statement: true, transport: true, payoutNetwork: true, payoutNumber: true, payoutName: true, cgpaAtApply: true, online: true, lastSeenAt: true, statusNote: true, createdAt: true, reviewedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, phone: true, email: true, studentProfile: { select: { currentLevel: true, programme: { select: { name: true } } } } } },
        deliveries: { where: { status: 'DELIVERED', deliveredAt: { gte: since } }, select: { fee: true } },
      },
    });
    const [standing, rules] = await Promise.all([this.eligibility.standing(profiles.map((p) => p.student.id)), this.rules.get()]);
    return profiles.map(({ deliveries, ...p }) => {
      const s = standing.get(p.student.id)!;
      return { ...p, cgpa: s.cgpa, eligibility: checkEligibility(s, rules), deliveriesLast30Days: deliveries.length, earnedLast30Days: deliveries.reduce((t, d) => t + d.fee, 0) };
    });
  }

  async review(user: AuthUser, id: string, dto: DispatcherReviewDto) {
    const p = await this.prisma.dispatcherProfile.findUnique({ where: { id }, include: { student: { select: { id: true, indexNumber: true } } } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dispatcher not found.' });
    const allowed: Record<string, string[]> = { PENDING: ['ACTIVE', 'REJECTED'], ACTIVE: ['SUSPENDED', 'ENDED'], SUSPENDED: ['ACTIVE', 'ENDED'], REJECTED: [], ENDED: [] };
    if (!allowed[p.status].includes(dto.status)) throw new ConflictException({ code: 'NOT_ALLOWED', message: `A dispatcher who is ${p.status.toLowerCase()} cannot be ${dto.status === 'ACTIVE' ? 'approved' : dto.status.toLowerCase()}.` });
    if (dto.status !== 'ACTIVE' && !dto.note) throw new BadRequestException({ code: 'REASON', message: 'Give a reason. The student sees it.' });
    if (dto.status === 'ACTIVE') {
      const elig = await this.eligibility.check(p.studentId);
      if (!elig.eligible) throw new ConflictException({ code: 'NOT_ELIGIBLE', message: `This student does not meet the rules: ${elig.reasons.join(' ')}` });
    } else if (await this.prisma.delivery.count({ where: { dispatcherId: id, status: { in: [...ACTIVE_DELIVERY] } } })) {
      throw new ConflictException({ code: 'BUSY', message: 'This dispatcher is carrying a delivery. Wait until it is finished.' });
    }
    await this.setStatus(p.id, p.studentId, dto.status, dto.note ?? null, user.id);
    await this.audit.record({ action: `employment.dispatcher_${dto.status.toLowerCase()}`, module: 'employment', targetType: 'DispatcherProfile', targetId: id, before: { status: p.status }, after: { status: dto.status, note: dto.note }, metadata: { student: p.student.indexNumber } });
    const rules = await this.rules.get();
    const messages = {
      ACTIVE: p.status === 'SUSPENDED'
        ? ['you can deliver again', 'Your suspension has been lifted. Go online on the Deliveries page to take orders.', 'Your suspension has been lifted.']
        : ['you are approved', `You earn ${formatCedis(rules.dispatchFee)} for each delivery. Open Deliveries and go online to start.`, `Approved. You earn ${formatCedis(rules.dispatchFee)} a delivery.`],
      REJECTED: ['application not approved', dto.note ?? '', 'Check your email for the reason.'],
      SUSPENDED: ['you are suspended', dto.note ?? '', 'Check your email for the reason.'],
      ENDED: ['your dispatcher role has ended', dto.note ?? '', 'Check your email for details.'],
    }[dto.status];
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DISPATCHER_UPDATE,
      recipients: [{ userId: p.studentId }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { headline: messages[0], detail: messages[1], smsDetail: messages[2] },
      link: dto.status === 'ACTIVE' ? '/dispatch' : '/jobs',
    });
    return { ok: true };
  }

  /** Changes status and keeps the Student Dispatcher role in step with it. */
  private async setStatus(profileId: string, studentId: string, status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ENDED', note: string | null, reviewerId: string | null) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.STUDENT_DISPATCHER }, select: { id: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.dispatcherProfile.update({ where: { id: profileId }, data: { status, statusNote: note, reviewedAt: new Date(), reviewedById: reviewerId, online: false } });
      if (status === 'ACTIVE') {
        const has = await tx.userRole.findFirst({ where: { userId: studentId, roleId: role.id } });
        if (!has) await tx.userRole.create({ data: { userId: studentId, roleId: role.id } });
      } else {
        await tx.userRole.deleteMany({ where: { userId: studentId, roleId: role.id } });
      }
    });
  }

  /**
   * Runs daily. Active dispatchers who no longer meet the rules (for example after new results are
   * published) are suspended, once they have no delivery in hand, and told why.
   */
  async sweep() {
    const active = await this.prisma.dispatcherProfile.findMany({ where: { status: 'ACTIVE' }, select: { id: true, studentId: true } });
    if (!active.length) return 0;
    const [standing, rules] = await Promise.all([this.eligibility.standing(active.map((a) => a.studentId)), this.rules.get()]);
    let suspended = 0;
    for (const p of active) {
      const elig = checkEligibility(standing.get(p.studentId)!, rules);
      if (elig.eligible) continue;
      if (await this.prisma.delivery.count({ where: { dispatcherId: p.id, status: { in: [...ACTIVE_DELIVERY] } } })) continue;
      try {
        const note = `No longer meets the rules: ${elig.reasons.join(' ')}`;
        await this.setStatus(p.id, p.studentId, 'SUSPENDED', note, null);
        await this.audit.record({ action: 'employment.dispatcher_auto_suspended', module: 'employment', targetType: 'DispatcherProfile', targetId: p.id, actor: { id: p.studentId, label: 'System', roleKey: null }, metadata: { reasons: elig.reasons } });
        await this.notifications.notify({
          eventKey: EVENT_KEYS.DISPATCHER_UPDATE,
          recipients: [{ userId: p.studentId }],
          channels: ['IN_APP', 'EMAIL', 'SMS'],
          sharedVars: { headline: 'you are suspended', detail: `${elig.reasons.join(' ')} When you meet the rules again, ask Career Services to lift the suspension.`, smsDetail: 'You no longer meet the rules. Check your email.' },
          link: '/jobs',
        });
        suspended++;
      } catch (err) {
        this.logger.error(`Could not suspend dispatcher ${p.id}: ${(err as Error).message}`);
      }
    }
    return suspended;
  }
}
