import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { formatCedis, hoursProblems, PAY_UNIT_LABEL, PERMISSIONS, timesheetAmount, weekOf } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PdfDoc } from '../../core/pdf/pdf';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { TransfersService } from '../payments/transfers.service';

const SELECT = {
  id: true, period: true, status: true, amount: true, note: true, submittedAt: true, approvedAt: true, returnNote: true, paidAt: true, paidReference: true,
  entries: { orderBy: { date: 'asc' as const }, select: { id: true, date: true, quantity: true, note: true } },
  application: {
    select: {
      id: true, studentId: true, payoutNetwork: true, payoutNumber: true, payoutName: true,
      student: { select: { firstName: true, lastName: true, indexNumber: true } },
      job: { select: { id: true, title: true, unit: true, kind: true, payRate: true, payUnit: true, hoursPerWeek: true, supervisorId: true, createdById: true } },
    },
  },
} satisfies Prisma.TimesheetSelect;
type Row = Prisma.TimesheetGetPayload<{ select: typeof SELECT }>;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Timesheets and payroll for paid campus work, teaching and research assistantships. A hired student
 * keeps a monthly timesheet; their supervisor approves it; Finance or HR pays it (Paystack or by hand).
 */
@Injectable()
export class TimesheetsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
    private readonly transfers: TransfersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.transfers.register('PAYROLL', {
      recipient: async (timesheetId) => {
        const t = await this.load(timesheetId);
        return { network: t.application.payoutNetwork, number: t.application.payoutNumber, name: t.application.payoutName, owed: t.status === 'APPROVED' ? t.amount : 0, label: `${t.application.student.firstName} ${t.application.student.lastName} (${t.application.job.title}, ${t.period})` };
      },
      record: async (actorId, timesheetId, _amount, reference) => {
        await this.markPaid({ id: actorId } as AuthUser, timesheetId, reference);
      },
    });
  }

  private async load(id: string) {
    const t = await this.prisma.timesheet.findUnique({ where: { id }, select: SELECT });
    if (!t) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Timesheet not found.' });
    return t;
  }

  private present(t: Row) {
    return { ...t, entries: t.entries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })) };
  }

  private async perms(user: AuthUser) {
    return this.resolver.permissionsFor(user.id, user.activeRoleKey);
  }

  // ----- Students -----

  /** The student's paid jobs, each with its timesheets. */
  async mine(user: AuthUser) {
    const hires = await this.prisma.jobApplication.findMany({
      where: { studentId: user.id, status: { in: ['HIRED', 'ENDED'] }, job: { payRate: { gt: 0 } } },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, startedAt: true, endedAt: true, payoutNetwork: true, payoutNumber: true, payoutName: true, job: { select: { title: true, unit: true, kind: true, payRate: true, payUnit: true, hoursPerWeek: true } }, timesheets: { orderBy: { period: 'desc' }, take: 12, select: SELECT } },
    });
    return hires.map((h) => ({ ...h, timesheets: h.timesheets.map((t) => this.present(t)) }));
  }

  async setPayout(user: AuthUser, applicationId: string, dto: { network: string; number: string; name: string }) {
    const app = await this.prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { studentId: true } });
    if (!app || app.studentId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found.' });
    await this.prisma.jobApplication.update({ where: { id: applicationId }, data: { payoutNetwork: dto.network, payoutNumber: dto.number, payoutName: dto.name } });
    return { ok: true };
  }

  /** Opens (or returns) the student's timesheet for a month. */
  async open(user: AuthUser, applicationId: string, period: string) {
    if (!PERIOD.test(period)) throw new BadRequestException({ code: 'PERIOD', message: 'Choose a month.' });
    const app = await this.prisma.jobApplication.findUnique({ where: { id: applicationId }, select: { studentId: true, status: true, startedAt: true, job: { select: { payRate: true } } } });
    if (!app || app.studentId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found.' });
    if (app.job.payRate <= 0) throw new BadRequestException({ code: 'UNPAID', message: 'This opportunity is unpaid.' });
    if (period > new Date().toISOString().slice(0, 7)) throw new BadRequestException({ code: 'FUTURE', message: 'You can only log work for this month or earlier.' });
    if (app.startedAt && period < app.startedAt.toISOString().slice(0, 7)) throw new BadRequestException({ code: 'BEFORE', message: 'That is before you started this job.' });
    const t = await this.prisma.timesheet.upsert({ where: { applicationId_period: { applicationId, period } }, create: { applicationId, period }, update: {}, select: SELECT });
    return this.present(t);
  }

  async saveEntries(user: AuthUser, id: string, dto: { entries: Array<{ date: string; quantity: number; note?: string }>; note?: string }) {
    const t = await this.load(id);
    if (t.application.studentId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Timesheet not found.' });
    if (t.status !== 'DRAFT' && t.status !== 'RETURNED') throw new ConflictException({ code: 'LOCKED', message: 'This timesheet has been sent. Ask your supervisor to return it if something is wrong.' });
    const job = t.application.job;
    const entries = job.payUnit === 'MONTH' ? [] : dto.entries;
    if (entries.some((e) => !e.date.startsWith(t.period))) throw new BadRequestException({ code: 'MONTH', message: `Every date must be in ${t.period}.` });
    if (entries.some((e) => e.date.slice(0, 10) > new Date().toISOString().slice(0, 10))) throw new BadRequestException({ code: 'FUTURE', message: 'You cannot log days that have not happened yet.' });
    if (job.payUnit === 'HOUR') {
      // Weekly limits count the student's other jobs in the same weeks.
      const weeks = [...new Set(entries.map((e) => weekOf(e.date)))];
      const others = weeks.length ? await this.prisma.timesheetEntry.findMany({ where: { timesheet: { application: { studentId: user.id }, id: { not: id } }, date: { gte: new Date(`${weeks.sort()[0]}T00:00:00Z`) } }, select: { date: true, quantity: true, timesheet: { select: { application: { select: { job: { select: { payUnit: true } } } } } } } }) : [];
      const otherHours: Record<string, number> = {};
      for (const o of others) if (o.timesheet.application.job.payUnit === 'HOUR') otherHours[weekOf(o.date)] = (otherHours[weekOf(o.date)] ?? 0) + o.quantity;
      const problems = hoursProblems(entries.map((e) => ({ date: e.date.slice(0, 10), quantity: e.quantity })), job.hoursPerWeek, otherHours);
      if (problems.length) throw new BadRequestException({ code: 'HOURS', message: problems.join(' ') });
    }
    await this.prisma.$transaction([
      this.prisma.timesheetEntry.deleteMany({ where: { timesheetId: id } }),
      this.prisma.timesheetEntry.createMany({ data: entries.map((e) => ({ timesheetId: id, date: new Date(`${e.date.slice(0, 10)}T00:00:00Z`), quantity: e.quantity, note: e.note || null })) }),
      this.prisma.timesheet.update({ where: { id }, data: { amount: timesheetAmount(job.payUnit, job.payRate, entries), note: dto.note || null } }),
    ]);
    return this.present(await this.load(id));
  }

  async submit(user: AuthUser, id: string) {
    const t = await this.load(id);
    if (t.application.studentId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Timesheet not found.' });
    if (t.status !== 'DRAFT' && t.status !== 'RETURNED') throw new ConflictException({ code: 'LOCKED', message: 'Already sent.' });
    if (t.application.job.payUnit !== 'MONTH' && !t.entries.length) throw new BadRequestException({ code: 'EMPTY', message: 'Add the work you did first.' });
    await this.prisma.timesheet.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date(), returnNote: null } });
    const supervisor = t.application.job.supervisorId ?? t.application.job.createdById;
    await this.notifications.notify({ eventKey: EVENT_KEYS.TIMESHEET_UPDATE, recipients: [{ userId: supervisor }], channels: ['IN_APP', 'EMAIL'], sharedVars: { headline: `${t.application.student.firstName} ${t.application.student.lastName} sent a timesheet`, detail: `${t.application.job.title}, ${t.period}: ${formatCedis(t.amount)}. Approve it under Opportunities.` }, link: '/opportunities' });
    return { status: 'SUBMITTED' };
  }

  // ----- Supervisors -----

  async toApprove(user: AuthUser) {
    const perms = await this.perms(user);
    const rows = await this.prisma.timesheet.findMany({
      where: { status: 'SUBMITTED', ...(perms.has(PERMISSIONS.EMPLOYMENT_MANAGE) ? {} : { application: { job: { OR: [{ supervisorId: user.id }, { supervisorId: null, createdById: user.id }] } } }) },
      orderBy: { submittedAt: 'asc' },
      select: SELECT,
    });
    return rows.map((t) => this.present(t));
  }

  async review(user: AuthUser, id: string, approve: boolean, note?: string) {
    const t = await this.load(id);
    const job = t.application.job;
    const perms = await this.perms(user);
    if ((job.supervisorId ?? job.createdById) !== user.id && !perms.has(PERMISSIONS.EMPLOYMENT_MANAGE)) throw new ForbiddenException({ code: 'NOT_SUPERVISOR', message: 'Only the supervisor approves this timesheet.' });
    if (t.status !== 'SUBMITTED') throw new ConflictException({ code: 'NOT_SENT', message: 'This timesheet is not waiting for approval.' });
    if (!approve && !note) throw new BadRequestException({ code: 'NOTE', message: 'Tell the student what to correct.' });
    await this.prisma.timesheet.update({ where: { id }, data: approve ? { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() } : { status: 'RETURNED', returnNote: note } });
    await this.audit.record({ action: approve ? 'employment.timesheet_approved' : 'employment.timesheet_returned', module: 'employment', targetType: 'Timesheet', targetId: id, metadata: { period: t.period, amount: t.amount, note } });
    await this.notifications.notify({ eventKey: EVENT_KEYS.TIMESHEET_UPDATE, recipients: [{ userId: t.application.studentId }], channels: ['IN_APP', 'EMAIL', 'SMS'], sharedVars: { headline: `Your ${t.period} timesheet was ${approve ? 'approved' : 'returned'}`, detail: approve ? `${formatCedis(t.amount)} will be paid by Finance.` : `Correct it and send it again: ${note}` }, link: '/work' });
    return { status: approve ? 'APPROVED' : 'RETURNED' };
  }

  // ----- Payroll (Finance and HR) -----

  payroll(status: 'APPROVED' | 'PAID') {
    return this.prisma.timesheet.findMany({ where: { status }, orderBy: status === 'PAID' ? { paidAt: 'desc' } : { approvedAt: 'asc' }, take: 300, select: SELECT }).then((r) => r.map((t) => this.present(t)));
  }

  async markPaid(user: AuthUser, id: string, reference: string) {
    const moved = await this.prisma.timesheet.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'PAID', paidAt: new Date(), paidReference: reference, paidById: user.id } });
    if (moved.count !== 1) throw new ConflictException({ code: 'NOT_APPROVED', message: 'Only an approved, unpaid timesheet can be paid.' });
    const t = await this.load(id);
    await this.audit.record({ action: 'employment.timesheet_paid', module: 'employment', targetType: 'Timesheet', targetId: id, metadata: { amount: t.amount, reference } });
    await this.notifications.notify({ eventKey: EVENT_KEYS.TIMESHEET_UPDATE, recipients: [{ userId: t.application.studentId }], channels: ['IN_APP', 'SMS'], sharedVars: { headline: `You have been paid ${formatCedis(t.amount)}`, detail: `${t.application.job.title}, ${t.period}. Reference ${reference}. Your payslip is under My work.` }, link: '/work' });
    return { status: 'PAID' };
  }

  async payslip(user: AuthUser, id: string) {
    const t = await this.load(id);
    const perms = await this.perms(user);
    const job = t.application.job;
    const allowed = t.application.studentId === user.id || perms.has(PERMISSIONS.PAYROLL_MANAGE) || (job.supervisorId ?? job.createdById) === user.id;
    if (!allowed) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Timesheet not found.' });
    const d = await PdfDoc.create(`Payslip: ${job.title}, ${t.period}`, t.status === 'PAID' ? `Paid ${t.paidAt!.toISOString().slice(0, 10)}, reference ${t.paidReference}` : 'NOT YET PAID');
    d.rows([
      ['Student', `${t.application.student.firstName} ${t.application.student.lastName} (${t.application.student.indexNumber ?? ''})`],
      ['Job', `${job.title}, ${job.unit}`],
      ['Rate', `${formatCedis(job.payRate)} ${PAY_UNIT_LABEL[job.payUnit]}`],
      ['Status', t.status],
    ]);
    if (t.entries.length) {
      d.gap();
      d.table(['Date', 'Work', job.payUnit === 'HOUR' ? 'Hours' : 'Tasks'], t.entries.map((e) => [e.date.toISOString().slice(0, 10), e.note ?? '', String(e.quantity)]), [0.2, 0.6, 0.2], [2]);
    }
    d.gap();
    d.text(`Amount: ${formatCedis(t.amount)}`, { bold: true, size: 12 });
    return { filename: `payslip-${t.application.student.indexNumber ?? 'student'}-${t.period}.pdf`, buffer: await d.toBuffer(`Generated ${new Date().toISOString().slice(0, 10)} from the ANU platform.`) };
  }
}
