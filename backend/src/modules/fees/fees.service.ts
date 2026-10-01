import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { PdfDoc } from '../../core/pdf/pdf';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { convertMoney, rateAt, billBalance, indexNumbersIn, instalmentPlanProblem, instalmentStatus, type Instalment, FEE_METHOD_LABEL, feeClearanceChange, feeStatement, formatMoney, pickSchedule, scheduleClash, studentGroupOf, type Currency, type FeePaymentMethod, termName } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PaymentsService } from '../payments/payments.service';
import { FeeRulesService } from './fee-rules.service';
import { AdjustmentDto, BillsQuery, CopySchedulesDto, FeeItemDto, RecordFeePaymentDto, ScheduleDto } from './dto/fees.dto';

const BILL_SELECT = {
  id: true, semesterId: true, lines: true, currency: true, charged: true, issuedAt: true,
  semester: { select: { id: true, number: true, academicYear: { select: { label: true } } } },
  student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, email: true, phone: true, studentProfile: { select: { currentLevel: true, nationality: true, programme: { select: { name: true } } } } } },
  adjustments: { orderBy: { createdAt: 'asc' as const }, select: { id: true, amount: true, reason: true, createdAt: true } },
  payments: { orderBy: { createdAt: 'asc' as const }, select: { id: true, amount: true, method: true, reference: true, receiptNumber: true, paidOn: true, createdAt: true, reversedAt: true, reversalReason: true, originalAmount: true, originalCurrency: true, exchangeRate: true } },
} satisfies Prisma.StudentBillSelect;
type BillRow = Prisma.StudentBillGetPayload<{ select: typeof BILL_SELECT }>;

const semesterLabel = (s: { number: number; academicYear: { label: string } }) => `${s.academicYear.label} ${termName(s.number)}`;
const figures = (b: Pick<BillRow, 'charged' | 'adjustments' | 'payments'>) =>
  billBalance({ charged: b.charged, adjustments: b.adjustments.reduce((t, a) => t + a.amount, 0), paid: b.payments.filter((p) => !p.reversedAt).reduce((t, p) => t + p.amount, 0) });
const newReceipt = () => `ANU-F-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Fee schedules, student bills and fee payments. After every payment, reversal or adjustment the
 * bill's percentage paid is checked against the clearance rule, and the student's fee clearance
 * for that semester is updated, unless Finance has decided it by hand.
 */
@Injectable()
export class FeesService implements OnModuleInit {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: FeeRulesService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
  ) {}

  async onModuleInit() {
    await this.jobs.work( QUEUES.FEES_LATE_CHARGES, async () => { await this.applyLateCharges();},);
    await this.jobs.schedule(QUEUES.FEES_LATE_CHARGES, '30 6 * * *');
    this.payments.onSucceeded('FEES', async (p) => {
      if (!p.subjectId) return;
      // The unique (method, reference) makes this safe to run twice.
      const exists = await this.prisma.feePayment.findUnique({ where: { method_reference: { method: 'ONLINE', reference: p.reference } } });
      if (exists) return;
      await this.prisma.feePayment.create({
        data: { billId: p.subjectId, amount: p.amount, method: 'ONLINE', reference: p.reference, receiptNumber: newReceipt(), paidOn: p.paidAt ?? new Date(), recordedById: p.userId },
      });
      await this.afterChange(p.subjectId, p.userId, { amount: p.amount, method: 'ONLINE' });
    });
  }

  /** Semesters and programmes for Finance's pickers. */
  async options() {
    const [semesters, programmes] = await Promise.all([
      this.prisma.semester.findMany({ orderBy: { startDate: 'desc' }, take: 12, select: { id: true, number: true, isCurrent: true, academicYear: { select: { label: true } } } }),
      this.prisma.programme.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);
    return { semesters: semesters.map((s) => ({ id: s.id, label: semesterLabel(s), isCurrent: s.isCurrent })), programmes };
  }

  // ----- Exchange rates (the Accounts office) -----

  rates() {
    return this.prisma.exchangeRate.findMany({ orderBy: { effectiveFrom: 'desc' }, take: 50, select: { id: true, cedisPerDollar: true, effectiveFrom: true, note: true, createdAt: true } });
  }

  async currentRate() {
    return rateAt(await this.prisma.exchangeRate.findMany({ where: { effectiveFrom: { lte: new Date() } }, orderBy: { effectiveFrom: 'desc' }, take: 1 }));
  }

  async addRate(user: AuthUser, dto: { cedisPerDollar: number; effectiveFrom: string; note?: string }) {
    const r = await this.prisma.exchangeRate.create({ data: { cedisPerDollar: dto.cedisPerDollar, effectiveFrom: new Date(dto.effectiveFrom), note: dto.note || null, createdById: user.id } });
    await this.audit.record({ action: 'fees.rate_added', module: 'fees', targetType: 'ExchangeRate', targetId: r.id, after: { cedisPerDollar: dto.cedisPerDollar, effectiveFrom: dto.effectiveFrom } });
    return r;
  }

  /** Rates are corrected by adding a new one; a rate is only removed if it has not been used for a payment. */
  async deleteRate(id: string) {
    const r = await this.prisma.exchangeRate.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Rate not found.' });
    const used = await this.prisma.feePayment.count({ where: { exchangeRate: r.cedisPerDollar, createdAt: { gte: r.effectiveFrom } } });
    if (used) throw new ConflictException({ code: 'IN_USE', message: 'Payments were converted at this rate. Add a new rate instead.' });
    await this.prisma.exchangeRate.delete({ where: { id } });
    await this.audit.record({ action: 'fees.rate_deleted', module: 'fees', targetType: 'ExchangeRate', targetId: id, before: { cedisPerDollar: r.cedisPerDollar } });
    return { ok: true };
  }

  // ----- Fee items (the Accounts office's labels) -----

  items() {
    return this.prisma.feeItem.findMany({ orderBy: [{ isActive: 'desc' }, { position: 'asc' }, { name: 'asc' }], select: { id: true, name: true, description: true, isActive: true, _count: { select: { lines: true } } } });
  }

  async saveItem(dto: FeeItemDto, id?: string) {
    try {
      const item = id
        ? await this.prisma.feeItem.update({ where: { id }, data: dto })
        : await this.prisma.feeItem.create({ data: { ...dto, position: await this.prisma.feeItem.count() } });
      await this.audit.record({ action: id ? 'fees.item_updated' : 'fees.item_created', module: 'fees', targetType: 'FeeItem', targetId: item.id, after: dto });
      return item;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'TAKEN', message: 'There is already a fee item with that name.' });
      throw err;
    }
  }

  // ----- Schedules -----

  async schedules(semesterId: string) {
    return this.prisma.feeSchedule.findMany({
      where: { semesterId },
      orderBy: [{ programmeId: 'asc' }, { level: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, programmeId: true, level: true, studentGroup: true, currency: true, programme: { select: { name: true } }, lines: { orderBy: { position: 'asc' }, select: { id: true, feeItemId: true, name: true, amount: true } }, _count: { select: { bills: true } } },
    });
  }

  async saveSchedule(user: AuthUser, dto: ScheduleDto, id?: string) {
    const target = { id: id ?? '', programmeId: dto.programmeId ?? null, level: dto.level ?? null, studentGroup: dto.studentGroup };
    const others = await this.prisma.feeSchedule.findMany({ where: { semesterId: dto.semesterId }, select: { id: true, programmeId: true, level: true, studentGroup: true } });
    if (others.some((o) => scheduleClash(o, target))) throw new ConflictException({ code: 'CLASH', message: 'There is already a schedule for exactly these students this semester. Edit that one instead.' });
    const items = await this.prisma.feeItem.findMany({ where: { id: { in: dto.lines.map((l) => l.feeItemId) } }, select: { id: true, name: true, isActive: true } });
    const byId = new Map(items.map((i) => [i.id, i]));
    if (dto.lines.some((l) => !byId.get(l.feeItemId)?.isActive)) throw new BadRequestException({ code: 'ITEM', message: 'Choose each item from the fee items list.' });
    const lines = dto.lines.map((l, i) => ({ feeItemId: l.feeItemId, name: byId.get(l.feeItemId)!.name, amount: l.amount, position: i }));
    const data = { semesterId: dto.semesterId, name: dto.name, programmeId: dto.programmeId ?? null, level: dto.level ?? null, studentGroup: dto.studentGroup, currency: dto.currency };
    const schedule = id
      ? await this.prisma.$transaction(async (tx) => {
          await tx.feeScheduleLine.deleteMany({ where: { scheduleId: id } });
          return tx.feeSchedule.update({ where: { id }, data: { ...data, lines: { create: lines } } });
        })
      : await this.prisma.feeSchedule.create({ data: { ...data, createdById: user.id, lines: { create: lines } } });
    await this.audit.record({ action: id ? 'fees.schedule_updated' : 'fees.schedule_created', module: 'fees', targetType: 'FeeSchedule', targetId: schedule.id, after: { name: dto.name, total: formatMoney(lines.reduce((t, l) => t + l.amount, 0), dto.currency), lines: lines.length } });
    return schedule;
  }

  async deleteSchedule(id: string) {
    const s = await this.prisma.feeSchedule.findUnique({ where: { id }, select: { name: true, _count: { select: { bills: true } } } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found.' });
    if (s._count.bills) throw new ConflictException({ code: 'IN_USE', message: 'Bills have been issued from this schedule, so it is kept for the record.' });
    await this.prisma.feeSchedule.delete({ where: { id } });
    await this.audit.record({ action: 'fees.schedule_deleted', module: 'fees', targetType: 'FeeSchedule', targetId: id, before: { name: s.name } });
    return { ok: true };
  }

  /** Starts a new semester from last semester's schedules. Skips any that would clash. */
  async copySchedules(user: AuthUser, dto: CopySchedulesDto) {
    const [from, existing] = await Promise.all([
      this.prisma.feeSchedule.findMany({ where: { semesterId: dto.fromSemesterId }, include: { lines: { orderBy: { position: 'asc' } } } }),
      this.prisma.feeSchedule.findMany({ where: { semesterId: dto.toSemesterId }, select: { id: true, programmeId: true, level: true, studentGroup: true } }),
    ]);
    let copied = 0;
    for (const s of from) {
      if (existing.some((e) => scheduleClash({ ...e, id: 'x' }, { ...s, id: 'y' }))) continue;
      await this.prisma.feeSchedule.create({ data: { semesterId: dto.toSemesterId, name: s.name, programmeId: s.programmeId, level: s.level, studentGroup: s.studentGroup, currency: s.currency, createdById: user.id, lines: { create: s.lines.map((l) => ({ feeItemId: l.feeItemId, name: l.name, amount: l.amount, position: l.position })) } } });
      copied++;
    }
    await this.audit.record({ action: 'fees.schedules_copied', module: 'fees', metadata: { copied, skipped: from.length - copied } });
    return { copied, skipped: from.length - copied };
  }

  // ----- Bills -----

  /** Issues a bill to every active student who has none yet this semester. Safe to run again after adding students. */
  async issueBills(user: AuthUser, semesterId: string) {
    const semester = await this.prisma.semester.findUniqueOrThrow({ where: { id: semesterId }, include: { academicYear: true } });
    const [schedules, students, billed, rules] = await Promise.all([
      this.prisma.feeSchedule.findMany({ where: { semesterId }, include: { lines: { orderBy: { position: 'asc' } } } }),
      this.prisma.user.findMany({ where: { type: 'STUDENT', status: { in: ['ACTIVE', 'PENDING_SETUP'] }, studentProfile: { isNot: null } }, select: { id: true, studentProfile: { select: { programmeId: true, currentLevel: true, nationality: true } } } }),
      this.prisma.studentBill.findMany({ where: { semesterId }, select: { studentId: true } }),
      this.rules.get(),
    ]);
    if (!schedules.length) throw new BadRequestException({ code: 'NO_SCHEDULES', message: 'Add at least one fee schedule for this semester first.' });
    const already = new Set(billed.map((b) => b.studentId));
    const issued: Array<{ studentId: string; scheduleId: string; currency: Currency; total: number; lines: Array<{ name: string; amount: number }> }> = [];
    let noSchedule = 0;
    for (const st of students) {
      if (already.has(st.id)) continue;
      const s = pickSchedule(schedules, { programmeId: st.studentProfile!.programmeId, level: st.studentProfile!.currentLevel, group: studentGroupOf(st.studentProfile!.nationality) });
      if (!s) { noSchedule++; continue; }
      const lines = s.lines.map((l) => ({ name: l.name, amount: l.amount }));
      issued.push({ studentId: st.id, scheduleId: s.id, currency: s.currency, total: lines.reduce((t, l) => t + l.amount, 0), lines });
    }
    for (let i = 0; i < issued.length; i += 200) {
      const batch = issued.slice(i, i + 200);
      await this.prisma.studentBill.createMany({
        data: batch.map((b) => ({ studentId: b.studentId, semesterId, scheduleId: b.scheduleId, lines: b.lines, currency: b.currency, charged: b.total, issuedById: user.id })),
        skipDuplicates: true,
      });
    }
    const label = semesterLabel(semester);
    await this.audit.record({ action: 'fees.bills_issued', module: 'fees', metadata: { semester: label, issued: issued.length, alreadyBilled: already.size, noSchedule } });
    for (const b of issued) {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.FEES_BILL_ISSUED,
        recipients: [{ userId: b.studentId }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { semester: label, total: formatMoney(b.total, b.currency), lines: b.lines.map((l) => `${l.name}: ${formatMoney(l.amount, b.currency)}`).join('\n'), percent: rules.clearancePercent },
        link: '/fees',
      }).catch((err) => this.logger.error(`Bill notice failed: ${(err as Error).message}`));
    }
    return { issued: issued.length, alreadyBilled: already.size, noSchedule };
  }

  async bills(q: BillsQuery) {
    const semester = q.semesterId ? { id: q.semesterId } : await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!semester) return { items: [], total: 0, page: q.page, pageSize: q.pageSize, summary: null, clearancePercent: (await this.rules.get()).clearancePercent };
    const search = q.search?.trim();
    const where: Prisma.StudentBillWhereInput = {
      semesterId: semester.id,
      ...(search ? { student: { OR: [{ indexNumber: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } } : {}),
    };
    // Status filters need the computed balance, so filtering happens after loading this semester's bills.
    const [rows, rules, clearances] = await Promise.all([
      this.prisma.studentBill.findMany({ where, orderBy: { student: { indexNumber: 'asc' } }, select: BILL_SELECT }),
      this.rules.get(),
      this.prisma.financialClearance.findMany({ where: { semesterId: semester.id }, select: { studentId: true, cleared: true, source: true } }),
    ]);
    const cl = new Map(clearances.map((c) => [c.studentId, c]));
    const all = rows.map((b) => ({ ...b, ...figures(b), clearance: cl.get(b.student.id) ?? null }));
    const filtered = all.filter((b) => {
      if (!q.status) return true;
      if (q.status === 'UNPAID') return b.percentPaid === 0 && b.due > 0;
      if (q.status === 'PAID') return b.balance <= 0;
      if (q.status === 'CLEARED') return !!b.clearance?.cleared;
      return b.percentPaid > 0 && b.balance > 0;
    });
    // Cedi and dollar bills are never added together.
    const currencies = [...new Set(all.map((b) => b.currency))] as Currency[];
    const summary = {
      bills: all.length,
      cleared: all.filter((b) => b.clearance?.cleared).length,
      byCurrency: currencies.map((c) => {
        const bs = all.filter((b) => b.currency === c);
        return { currency: c, bills: bs.length, due: bs.reduce((t, b) => t + b.due, 0), collected: bs.reduce((t, b) => t + (b.due - b.balance), 0) };
      }),
    };
    const start = (q.page - 1) * q.pageSize;
    return { items: filtered.slice(start, start + q.pageSize), total: filtered.length, page: q.page, pageSize: q.pageSize, summary, clearancePercent: rules.clearancePercent, semesterId: semester.id };
  }

  async bill(id: string) {
    const b = await this.prisma.studentBill.findUnique({ where: { id }, select: BILL_SELECT });
    if (!b) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Bill not found.' });
    const clearance = await this.prisma.financialClearance.findUnique({ where: { studentId_semesterId: { studentId: b.student.id, semesterId: b.semesterId } }, select: { cleared: true, source: true, note: true } });
    const rate = await this.currentRate();
    return { ...b, ...figures(b), clearance, clearancePercent: (await this.rules.get()).clearancePercent, cedisPerDollar: rate?.cedisPerDollar ?? null };
  }

  async recordPayment(user: AuthUser, billId: string, dto: RecordFeePaymentDto) {
    const b = await this.bill(billId);
    if (new Date(dto.paidOn) > new Date()) throw new BadRequestException({ code: 'FUTURE', message: 'The payment date cannot be in the future.' });
    // Paid in the other currency: convert at the rate in force on the day it was paid.
    let amount = dto.amount;
    let original: { originalAmount: number; originalCurrency: Currency; exchangeRate: number } | null = null;
    if (dto.paidCurrency && dto.paidCurrency !== b.currency) {
      const rates = await this.prisma.exchangeRate.findMany({ where: { effectiveFrom: { lte: new Date(dto.paidOn + 'T23:59:59Z') } }, orderBy: { effectiveFrom: 'desc' }, take: 1 });
      const rate = rateAt(rates, new Date(dto.paidOn + 'T23:59:59Z'));
      if (!rate) throw new BadRequestException({ code: 'NO_RATE', message: 'No exchange rate was in force on that date. The Accounts office sets rates under Exchange rates.' });
      amount = convertMoney(dto.amount, dto.paidCurrency, b.currency, rate.cedisPerDollar);
      original = { originalAmount: dto.amount, originalCurrency: dto.paidCurrency, exchangeRate: rate.cedisPerDollar };
    }
    try {
      const p = await this.prisma.feePayment.create({
        data: { billId, amount, method: dto.method, reference: dto.reference, receiptNumber: newReceipt(), paidOn: new Date(dto.paidOn), recordedById: user.id, ...(original ?? {}) },
      });
      await this.audit.record({ action: 'fees.payment_recorded', module: 'fees', targetType: 'StudentBill', targetId: billId, after: { amount, method: dto.method, reference: dto.reference, receipt: p.receiptNumber, ...(original ?? {}) } });
      await this.afterChange(billId, user.id, { amount, method: dto.method, receipt: p.receiptNumber });
      return this.bill(billId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'DUPLICATE', message: `A ${FEE_METHOD_LABEL[dto.method].toLowerCase()} with reference ${dto.reference} has already been recorded.` });
      }
      throw err;
    }
  }

  async adjust(user: AuthUser, billId: string, dto: AdjustmentDto) {
    await this.bill(billId);
    await this.prisma.feeAdjustment.create({ data: { billId, amount: dto.amount, reason: dto.reason, createdById: user.id } });
    await this.audit.record({ action: dto.amount < 0 ? 'fees.waiver_added' : 'fees.charge_added', module: 'fees', targetType: 'StudentBill', targetId: billId, after: { amount: dto.amount, reason: dto.reason } });
    await this.afterChange(billId, user.id);
    return this.bill(billId);
  }

  /** A bounced cheque or a slip recorded against the wrong student. The record stays, marked reversed. */
  async reverse(user: AuthUser, paymentId: string, reason: string) {
    const p = await this.prisma.feePayment.findUnique({ where: { id: paymentId } });
    if (!p || p.reversedAt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payment not found or already reversed.' });
    if (p.method === 'ONLINE') throw new ForbiddenException({ code: 'ONLINE', message: 'Online payments are refunded through Paystack, not reversed here. Contact ICT.' });
    await this.prisma.feePayment.update({ where: { id: paymentId }, data: { reversedAt: new Date(), reversedById: user.id, reversalReason: reason } });
    await this.audit.record({ action: 'fees.payment_reversed', module: 'fees', targetType: 'StudentBill', targetId: p.billId, before: { amount: p.amount, receipt: p.receiptNumber }, after: { reason } });
    await this.afterChange(p.billId, user.id);
    return this.bill(p.billId);
  }

  /** Applies the clearance rule to one bill, and tells the student about payments and clearance changes. */
  async afterChange(billId: string, actorId: string, paid?: { amount: number; method: FeePaymentMethod; receipt?: string }) {
    const b = await this.bill(billId);
    const current = b.clearance ? { cleared: b.clearance.cleared, source: b.clearance.source } : null;
    const change = feeClearanceChange(current, b.percentPaid, b.clearancePercent);
    const label = semesterLabel(b.semester);
    if (change) {
      await this.prisma.financialClearance.upsert({
        where: { studentId_semesterId: { studentId: b.student.id, semesterId: b.semesterId } },
        create: { studentId: b.student.id, semesterId: b.semesterId, cleared: change.cleared, source: 'FEES', note: `Fee rule: ${b.percentPaid}% paid`, updatedById: actorId },
        update: { cleared: change.cleared, source: 'FEES', note: `Fee rule: ${b.percentPaid}% paid`, updatedById: actorId },
      });
      await this.audit.record({ action: change.cleared ? 'fees.auto_cleared' : 'fees.auto_uncleared', module: 'fees', targetType: 'User', targetId: b.student.id, metadata: { semester: label, percentPaid: b.percentPaid, threshold: b.clearancePercent } });
      await this.notifications.notify({
        eventKey: EVENT_KEYS.FEES_CLEARED,
        recipients: [{ userId: b.student.id }],
        channels: ['IN_APP', 'SMS', 'EMAIL'],
        sharedVars: change.cleared
          ? { semester: label, headline: 'you are cleared', detail: `You have paid ${b.percentPaid}% of your fees, so you are fee-cleared for exams. Your balance is ${formatMoney(Math.max(0, b.balance), b.currency)}.` }
          : { semester: label, headline: 'clearance withdrawn', detail: `After a correction to your fees you have paid ${b.percentPaid}%, below the ${b.clearancePercent}% needed. Contact the Finance Office.` },
        link: '/fees',
      });
    }
    if (paid) {
      const receipt = paid.receipt ?? b.payments.filter((p) => p.method === paid.method && p.amount === paid.amount).at(-1)?.receiptNumber ?? '';
      await this.notifications.notify({
        eventKey: EVENT_KEYS.FEES_PAYMENT_RECEIVED,
        recipients: [{ userId: b.student.id }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { amount: formatMoney(paid.amount, b.currency), method: FEE_METHOD_LABEL[paid.method], receipt, semester: label, balance: formatMoney(Math.max(0, b.balance), b.currency), percentPaid: b.percentPaid },
        link: '/fees',
      });
    }
  }

  /** After the clearance percentage changes, applies the new rule to this semester's bills. */
  async reapplyRule(actorId: string) {
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!semester) return 0;
    const bills = await this.prisma.studentBill.findMany({ where: { semesterId: semester.id }, select: { id: true } });
    for (const b of bills) await this.afterChange(b.id, actorId).catch((err) => this.logger.error(`Clearance recheck failed for ${b.id}: ${(err as Error).message}`));
    return bills.length;
  }

  // ----- Students -----

  async mine(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Fees are for students.' });
    const [bills, rules] = await Promise.all([
      this.prisma.studentBill.findMany({ where: { studentId: user.id }, orderBy: { issuedAt: 'desc' }, select: BILL_SELECT }),
      this.rules.get(),
    ]);
    const clearances = await this.prisma.financialClearance.findMany({ where: { studentId: user.id }, select: { semesterId: true, cleared: true } });
    const cl = new Map(clearances.map((c) => [c.semesterId, c.cleared]));
    const plans = new Map((await this.prisma.feeInstalmentPlan.findMany({ where: { semesterId: { in: bills.map((b) => b.semesterId) } } })).map((p) => [p.semesterId, p.instalments as unknown as Instalment[]]));
    const rate = await this.currentRate();
    return {
      rules,
      cedisPerDollar: rate?.cedisPerDollar ?? null,
      provider: this.payments.providerName,
      bills: bills.map((b) => ({ ...b, ...figures(b), instalments: this.instalmentsFor(plans, b), semesterLabel: semesterLabel(b.semester), cleared: cl.get(b.semesterId) ?? false, statement: feeStatement({ ...b, lines: b.lines as Array<{ name: string; amount: number }> }), student: undefined })),
    };
  }

  async payOnline(user: AuthUser, billId: string, amount: number) {
    const b = await this.prisma.studentBill.findFirst({ where: { id: billId, studentId: user.id }, select: BILL_SELECT });
    if (!b) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Bill not found.' });
    const { balance } = figures(b);
    const rules = await this.rules.get();
    const min = b.currency === 'USD' ? rules.minOnlinePaymentUsd : rules.minOnlinePayment;
    if (balance <= 0) throw new ConflictException({ code: 'PAID', message: 'This bill is fully paid.' });
    if (amount > balance) throw new BadRequestException({ code: 'TOO_MUCH', message: `The balance is ${formatMoney(balance, b.currency)}.` });
    if (amount < Math.min(min, balance)) throw new BadRequestException({ code: 'TOO_LITTLE', message: `The smallest online payment is ${formatMoney(min, b.currency)}.` });
    const started = await this.payments.start({ purpose: 'FEES', userId: user.id, subjectId: billId, amount, currency: b.currency, returnPath: '/fees', description: `Fees for ${semesterLabel(b.semester)}` });
    return { paymentUrl: started.authorizationUrl };
  }

  /** A receipt for one payment, for the student (their own only) or Finance. */
  async receipt(paymentId: string, user?: AuthUser) {
    const p = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      select: { id: true, amount: true, method: true, reference: true, receiptNumber: true, paidOn: true, createdAt: true, reversedAt: true, reversalReason: true, billId: true, originalAmount: true, originalCurrency: true, exchangeRate: true,},
    });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Receipt not found.' });
    const b = await this.bill(p.billId);
    if (user && b.student.id !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Receipt not found.' });
    // Balance straight after this payment, as a receipt would have shown it.
    const statement = feeStatement({ ...b, lines: b.lines as Array<{ name: string; amount: number }> });
    const at = statement.findIndex((e) => e.receipt === p.receiptNumber && e.credit > 0);
    return { 
      ...p,
      originalAmount: p.originalAmount,
      originalCurrency: p.originalCurrency,
      exchangeRate: p.exchangeRate,
      currency: b.currency, 
      semester: semesterLabel(b.semester), 
      student: { 
        name: `${b.student.firstName} ${b.student.lastName}`, 
        indexNumber: b.student.indexNumber, 
        programme: b.student.studentProfile?.programme.name ?? null, 
        level: b.student.studentProfile?.currentLevel ?? null, 
      }, 
      balanceAfter: at >= 0 ? statement[at].balance : b.balance, 
      balanceNow: b.balance, 
    };
  }

  // ----- PDFs generated by the server -----

  async receiptPdf(paymentId: string, user?: AuthUser) {
    const r = await this.receipt(paymentId, user);
    const d = await PdfDoc.create('Official receipt: school fees', r.reversedAt ? 'THIS PAYMENT WAS REVERSED. THIS RECEIPT IS NOT VALID.' : undefined);
    d.rows([
      ['Receipt number', r.receiptNumber],
      ['Student', `${r.student.name} (${r.student.indexNumber ?? ''})`],
      ['Programme', `${r.student.programme ?? ''}${r.student.level ? `, level ${r.student.level}` : ''}`],
      ['Fees for', r.semester],
      ['Amount received', formatMoney(r.amount, r.currency)],
      ...(r.originalAmount && r.originalCurrency ? [ [ 'Paid as', `${formatMoney(r.originalAmount, r.originalCurrency)} at ${r.exchangeRate} cedis per dollar`, ] as [string, string], ] : []),
      ['Paid by', FEE_METHOD_LABEL[r.method]],
      ['Reference', r.reference],
      ['Date paid', new Date(r.paidOn).toISOString().slice(0, 10)],
      ['Balance after this payment', formatMoney(Math.max(0, r.balanceAfter), r.currency)],
    ]);
    return { filename: `receipt-${r.receiptNumber}.pdf`, buffer: await d.toBuffer(`Generated ${new Date().toISOString().slice(0, 10)} from the ANU platform. Check it at the Finance Office by its receipt number.`) };
  }

  async statementPdf(billId: string, user?: AuthUser) {
    const b = await this.bill(billId);
    if (user && b.student.id !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Statement not found.' });
    const entries = feeStatement({ ...b, lines: b.lines as Array<{ name: string; amount: number }> });
    const m = (n: number) => (n ? formatMoney(n, b.currency) : '');
    const d = await PdfDoc.create(`Fees statement: ${semesterLabel(b.semester)}`, `${b.student.firstName} ${b.student.lastName} (${b.student.indexNumber ?? ''})${b.student.studentProfile ? `, ${b.student.studentProfile.programme.name}, level ${b.student.studentProfile.currentLevel}` : ''}`);
    d.table(['Date', 'Details', 'Debit', 'Credit', 'Balance'], entries.map((e) => [e.date.slice(0, 10), e.receipt ? `${e.description} (receipt ${e.receipt})` : e.description, m(e.debit), m(e.credit), formatMoney(e.balance, b.currency)]), [0.14, 0.44, 0.14, 0.14, 0.14], [2, 3, 4]);
    d.gap(6);
    d.text(`Balance ${b.balance < 0 ? 'in your favour' : 'owed'}: ${formatMoney(Math.abs(b.balance), b.currency)}. Paid: ${b.percentPaid}%.`, { bold: true });
    return { filename: `fees-statement-${b.student.indexNumber ?? b.id}.pdf`, buffer: await d.toBuffer(`Generated ${new Date().toISOString().slice(0, 10)} from the ANU platform.`) };
  }

  // ----- Instalments and late payment charges -----

  private instalmentsFor(plans: Map<string, Instalment[]>, b: Pick<BillRow, 'semesterId' | 'charged' | 'adjustments' | 'payments'>) {
    const plan = plans.get(b.semesterId);
    if (!plan) return null;
    const f = figures(b);
    return { plan, ...instalmentStatus(f.due, f.due - f.balance, plan, new Date().toISOString().slice(0, 10)) };
  }

  async instalmentPlan(semesterId: string) {
    const p = await this.prisma.feeInstalmentPlan.findUnique({ where: { semesterId } });
    return { semesterId, instalments: (p?.instalments as unknown as Instalment[]) ?? [] };
  }

  async setInstalmentPlan(user: AuthUser, semesterId: string, instalments: Instalment[]) {
    if (instalments.length) {
      const problem = instalmentPlanProblem(instalments);
      if (problem) throw new BadRequestException({ code: 'PLAN', message: problem });
      await this.prisma.feeInstalmentPlan.upsert({ where: { semesterId }, create: { semesterId, instalments: instalments as never, updatedById: user.id }, update: { instalments: instalments as never, updatedById: user.id } });
    } else {
      await this.prisma.feeInstalmentPlan.deleteMany({ where: { semesterId } });
    }
    await this.audit.record({ action: 'fees.instalments_set', module: 'fees', targetType: 'Semester', targetId: semesterId, after: { instalments } });
    return this.instalmentPlan(semesterId);
  }

  /**
   * Daily: when the Finance Office has turned late charges on, adds the charge once for each
   * instalment a bill missed. Nothing happens while they are off (the default).
   */
  async applyLateCharges() {
    const rules = await this.rules.get();
    if (!rules.lateFeeEnabled) return { charged: 0 };
    const today = new Date().toISOString().slice(0, 10);
    let charged = 0;
    for (const plan of await this.prisma.feeInstalmentPlan.findMany()) {
      const instalments = plan.instalments as unknown as Instalment[];
      if (!instalments.some((i) => i.dueDate < today)) continue;
      const bills = await this.prisma.studentBill.findMany({ where: { semesterId: plan.semesterId }, select: BILL_SELECT });
      const done = await this.prisma.feeLateCharge.findMany({ where: { billId: { in: bills.map((b) => b.id) } }, select: { billId: true, instalmentIndex: true } });
      for (const b of bills) {
        const f = figures(b);
        const { missed } = instalmentStatus(f.due, f.due - f.balance, instalments, today);
        for (const m of missed) {
          if (done.some((d) => d.billId === b.id && d.instalmentIndex === m.index)) continue;
          const amount = b.currency === 'USD' ? rules.lateFeeUsd : rules.lateFee;
          if (amount <= 0) continue;
          const adj = await this.prisma.feeAdjustment.create({ data: { billId: b.id, amount, reason: `Late payment: instalment ${m.index + 1} (due ${m.dueDate})`, createdById: plan.updatedById } });
          await this.prisma.feeLateCharge.create({ data: { billId: b.id, instalmentIndex: m.index, adjustmentId: adj.id } });
          await this.afterChange(b.id, plan.updatedById);
          charged++;
        }
      }
    }
    if (charged) await this.audit.record({ action: 'fees.late_charges_added', module: 'fees', metadata: { charged } });
    return { charged };
  }

  // ----- Bank statements -----

  /** Suggests which bill each statement line pays, from index numbers in the narration. */
  async matchStatement(semesterId: string | null, currency: 'GHS' | 'USD', rows: Array<{ date: string; amount: number; reference: string; narration: string }>) {
    const semester = semesterId ?? (await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } }))?.id;
    const refs = await this.prisma.feePayment.findMany({ where: { method: 'BANK', reference: { in: rows.map((r) => r.reference.toUpperCase()) } }, select: { reference: true } });
    const seen = new Set(refs.map((r) => r.reference));
    const indexes = [...new Set(rows.flatMap((r) => indexNumbersIn(r.narration)))];
    const bills = await this.prisma.studentBill.findMany({ where: { semesterId: semester, student: { indexNumber: { in: indexes } } }, select: { id: true, currency: true, student: { select: { indexNumber: true, firstName: true, lastName: true } } } });
    return rows.map((r, i) => {
      const found = indexNumbersIn(r.narration).map((x) => bills.find((b) => b.student.indexNumber === x)).filter(Boolean);
      const bill = found.length === 1 ? found[0]! : null;
      const why = seen.has(r.reference.toUpperCase()) ? 'Already recorded.' : found.length > 1 ? 'More than one student named.' : !bill ? 'No index number with a bill this semester.' : null;
      return { line: i + 1, ...r, bill: why ? null : bill, problem: why };
    });
  }

  async applyStatement(user: AuthUser, currency: 'GHS' | 'USD', items: Array<{ billId: string; amount: number; reference: string; paidOn: string }>) {
    const out: Array<{ reference: string; ok: boolean; message?: string }> = [];
    for (const it of items) {
      try {
        await this.recordPayment(user, it.billId, { amount: it.amount, method: 'BANK', reference: it.reference, paidOn: it.paidOn.slice(0, 10), paidCurrency: currency } as never);
        out.push({ reference: it.reference, ok: true });
      } catch (err) {
        out.push({ reference: it.reference, ok: false, message: (err as { response?: { message?: string } }).response?.message ?? (err as Error).message });
      }
    }
    await this.audit.record({ action: 'fees.statement_imported', module: 'fees', metadata: { recorded: out.filter((o) => o.ok).length, failed: out.filter((o) => !o.ok).length } });
    return out;
  }
}
