import { PdfDoc } from '../../core/pdf/pdf';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { formatCedis, OFFICE_LABEL, receiptNumber, ROLE_KEYS, termActive } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PaymentsService } from '../payments/payments.service';
import { AssociationDto, DuesPayoutDto, LevyDto, OfficerDto } from './dto/fees.dto';

const today = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

/**
 * Departmental associations (EHASSA, BACA...) and their dues. The Dean of Students office records
 * each elected officer for a term; officers set dues and record cash with numbered receipts; students
 * can also pay online. Every receipt is sent to the student, and only the Dean of Students office can
 * cancel one, so cash cannot quietly go missing.
 */
@Injectable()
export class DuesService implements OnModuleInit {
  private readonly logger = new Logger(DuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    this.payments.onSucceeded('DUES', async (p) => {
      if (!p.subjectId) return;
      const levy = await this.prisma.duesLevy.findUnique({ where: { id: p.subjectId }, include: { association: true } });
      if (!levy) return;
      if (await this.prisma.duesPayment.findUnique({ where: { reference: p.reference } })) return;
      const paid = await this.prisma.duesPayment.findFirst({ where: { levyId: levy.id, studentId: p.userId, voidedAt: null } });
      if (paid) {
        // Paid in cash to an officer while the online payment was in progress: give the money back.
        await this.payments.refund(p.id, 'Dues already paid');
        return;
      }
      const receipt = await this.record(levy.id, p.userId, p.amount, 'ONLINE', p.userId, p.reference);
      await this.sendReceipt(receipt.id);
    });
    await this.jobs.work(QUEUES.ASSOCIATION_TERMS, async () => {
  await this.endExpiredTerms();
});
    await this.jobs.schedule(QUEUES.ASSOCIATION_TERMS, '15 0 * * *');
  }

  // ----- Shared helpers -----

  /** Creates a payment with the association's next receipt number, refusing a second payment for the same dues. */
  private async record(levyId: string, studentId: string, amount: number, method: 'ONLINE' | 'CASH', recordedById: string, reference?: string) {
    return this.prisma.$transaction(async (tx) => {
      const levy = await tx.duesLevy.findUniqueOrThrow({ where: { id: levyId }, select: { associationId: true } });
      const existing = await tx.duesPayment.findFirst({ where: { levyId, studentId, voidedAt: null } });
      if (existing) throw new ConflictException({ code: 'PAID', message: `Already paid (receipt ${existing.receiptNumber}).` });
      const a = await tx.association.update({ where: { id: levy.associationId }, data: { receiptSeq: { increment: 1 } }, select: { code: true, receiptSeq: true } });
      return tx.duesPayment.create({ data: { levyId, studentId, amount, method, receiptNumber: receiptNumber(a.code, a.receiptSeq), reference, recordedById } });
    });
  }

  private async sendReceipt(paymentId: string) {
    const p = await this.prisma.duesPayment.findUniqueOrThrow({ where: { id: paymentId }, include: { levy: { include: { association: true } } } });
    const by = await this.prisma.user.findUnique({ where: { id: p.recordedById }, select: { firstName: true, lastName: true } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DUES_RECEIPT,
      recipients: [{ userId: p.studentId }],
      channels: ['IN_APP', 'SMS', 'EMAIL'],
      sharedVars: {
        association: p.levy.association.code, amount: formatCedis(p.amount), levy: p.levy.title, receipt: p.receiptNumber,
        method: p.method === 'CASH' ? 'cash' : 'online', recordedBy: p.method === 'CASH' && by ? `${by.firstName} ${by.lastName}` : 'online payment',
      },
      link: '/dues',
    });
  }

  /** Students whose programme belongs to one of the association's departments. */
  private membersWhere(associationId: string): Prisma.UserWhereInput {
    return { type: 'STUDENT', status: { in: ['ACTIVE', 'PENDING_SETUP'] }, studentProfile: { programme: { department: { associations: { some: { associationId } } } } } };
  }

  /** Keeps the Association Officer add-on role in step with whether the student has a current term. */
  private async syncOfficerRole(studentId: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.ASSOCIATION_OFFICER }, select: { id: true } });
    const terms = await this.prisma.associationOfficer.findMany({ where: { studentId, endedAt: null } });
    const active = terms.some((t) => termActive(t));
    const has = await this.prisma.userRole.findFirst({ where: { userId: studentId, roleId: role.id } });
    if (active && !has) await this.prisma.userRole.create({ data: { userId: studentId, roleId: role.id } });
    if (!active && has) await this.prisma.userRole.deleteMany({ where: { userId: studentId, roleId: role.id } });
  }

  // ----- Dean of Students -----

  departments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  }

  async associations() {
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    const list = await this.prisma.association.findMany({
      orderBy: { code: 'asc' },
      include: {
        departments: { select: { department: { select: { id: true, name: true } } } },
        officers: { where: { endedAt: null }, orderBy: { office: 'asc' }, select: { id: true, office: true, startsOn: true, endsOn: true, endedAt: true, student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, phone: true } } } },
        levies: { where: semester ? { semesterId: semester.id } : { id: 'none' }, select: { id: true, title: true, amount: true, isOpen: true, payments: { where: { voidedAt: null }, select: { amount: true, method: true } } } },
      },
    });
    return Promise.all(list.map(async (a) => ({
      ...a,
      departments: a.departments.map((d) => d.department),
      officers: a.officers.map((o) => ({ ...o, current: termActive(o) })),
      members: await this.prisma.user.count({ where: this.membersWhere(a.id) }),
      levies: a.levies.map(({ payments, ...l }) => ({ ...l, paidCount: payments.length, online: payments.filter((p) => p.method === 'ONLINE').reduce((t, p) => t + p.amount, 0), cash: payments.filter((p) => p.method === 'CASH').reduce((t, p) => t + p.amount, 0) })),
    })));
  }

  async saveAssociation(dto: AssociationDto, id?: string) {
    const { departmentIds, ...rest } = dto;
    const data = { ...rest, payoutNumber: rest.payoutNumber ? normaliseGhanaPhone(rest.payoutNumber) : null };
    try {
      const a = await this.prisma.$transaction(async (tx) => {
        const saved = id ? await tx.association.update({ where: { id }, data }) : await tx.association.create({ data });
        await tx.associationDepartment.deleteMany({ where: { associationId: saved.id } });
        await tx.associationDepartment.createMany({ data: departmentIds.map((departmentId) => ({ associationId: saved.id, departmentId })) });
        return saved;
      });
      await this.audit.record({ action: id ? 'dues.association_updated' : 'dues.association_created', module: 'dues', targetType: 'Association', targetId: a.id, after: { code: a.code, name: a.name, departments: departmentIds.length } });
      return a;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'TAKEN', message: 'Another association already uses that code.' });
      throw err;
    }
  }

  async appoint(user: AuthUser, associationId: string, dto: OfficerDto) {
    const [a, student] = await Promise.all([
      this.prisma.association.findUnique({ where: { id: associationId } }),
      this.prisma.user.findUnique({ where: { indexNumber: dto.indexNumber }, select: { id: true, type: true, status: true, firstName: true } }),
    ]);
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Association not found.' });
    if (!student || student.type !== 'STUDENT' || student.status !== 'ACTIVE') throw new BadRequestException({ code: 'STUDENT', message: 'No active student has that index number.' });
    if (!(await this.prisma.user.count({ where: { id: student.id, ...this.membersWhere(a.id) } }))) {
      throw new BadRequestException({ code: 'NOT_MEMBER', message: `This student is not in a department that belongs to ${a.code}.` });
    }
    const startsOn = new Date(dto.startsOn);
    const endsOn = new Date(dto.endsOn);
    if (endsOn <= startsOn) throw new BadRequestException({ code: 'DATES', message: 'The term must end after it starts.' });
    // One current officer per office: the outgoing one's term ends when the new one's starts.
    const outgoing = await this.prisma.associationOfficer.findMany({ where: { associationId, office: dto.office, endedAt: null } });
    for (const o of outgoing) {
      await this.prisma.associationOfficer.update({ where: { id: o.id }, data: { endedAt: startsOn > new Date() ? startsOn : new Date(), endReason: 'Replaced by a newly elected officer' } });
    }
    const officer = await this.prisma.associationOfficer.create({ data: { associationId, studentId: student.id, office: dto.office, startsOn, endsOn, appointedById: user.id } });
    for (const id of new Set([student.id, ...outgoing.map((o) => o.studentId)])) await this.syncOfficerRole(id);
    await this.audit.record({ action: 'dues.officer_appointed', module: 'dues', targetType: 'Association', targetId: associationId, after: { office: dto.office, student: dto.indexNumber, startsOn: dto.startsOn, endsOn: dto.endsOn } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.ASSOCIATION_OFFICE,
      recipients: [{ userId: student.id }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { association: a.code, headline: `you are ${OFFICE_LABEL[dto.office]}`, detail: `The Dean of Students office has recorded you as ${OFFICE_LABEL[dto.office]} of ${a.name} until ${endsOn.toISOString().slice(0, 10)}. You can set dues and record cash payments under Association dues. Every cash payment you record is confirmed to the student by SMS.` },
      link: '/association',
    });
    return officer;
  }

  async endTerm(officerId: string, reason: string) {
    const o = await this.prisma.associationOfficer.findUnique({ where: { id: officerId }, include: { association: true } });
    if (!o || o.endedAt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Officer not found or term already ended.' });
    await this.prisma.associationOfficer.update({ where: { id: officerId }, data: { endedAt: new Date(), endReason: reason } });
    await this.syncOfficerRole(o.studentId);
    await this.audit.record({ action: 'dues.officer_ended', module: 'dues', targetType: 'Association', targetId: o.associationId, after: { office: o.office, reason } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.ASSOCIATION_OFFICE, recipients: [{ userId: o.studentId }], channels: ['IN_APP', 'EMAIL'],
      sharedVars: { association: o.association.code, headline: 'your term has ended', detail: `Your term as ${OFFICE_LABEL[o.office]} has ended. Reason: ${reason}` },
    });
    return { ok: true };
  }

  /** Runs daily: terms past their end date close, and the officer role is removed. */
  async endExpiredTerms() {
    const expired = await this.prisma.associationOfficer.findMany({ where: { endedAt: null, endsOn: { lt: today() } }, select: { id: true, studentId: true } });
    for (const o of expired) {
      await this.prisma.associationOfficer.update({ where: { id: o.id }, data: { endedAt: new Date(), endReason: 'Term ended' } });
      await this.syncOfficerRole(o.studentId).catch((err) => this.logger.error(`Role sync failed: ${(err as Error).message}`));
    }
    // Terms that start today need the role granted.
    const starting = await this.prisma.associationOfficer.findMany({ where: { endedAt: null, startsOn: { lte: new Date() } }, select: { studentId: true }, distinct: ['studentId'] });
    for (const s of starting) await this.syncOfficerRole(s.studentId).catch(() => undefined);
    return expired.length;
  }

  /** Cancels a receipt recorded in error. Online payments are refunded. The student and officers are told. */
  async voidPayment(user: AuthUser, paymentId: string, reason: string) {
    const p = await this.prisma.duesPayment.findUnique({ where: { id: paymentId }, include: { levy: { include: { association: true } } } });
    if (!p || p.voidedAt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Receipt not found or already cancelled.' });
    if (p.method === 'ONLINE' && p.reference) {
      const payment = await this.prisma.payment.findUnique({ where: { reference: p.reference } });
      if (payment) await this.payments.refund(payment.id, `Dues receipt cancelled: ${reason}`);
    }
    await this.prisma.duesPayment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason } });
    await this.audit.record({ action: 'dues.receipt_voided', module: 'dues', targetType: 'DuesPayment', targetId: paymentId, before: { receipt: p.receiptNumber, amount: p.amount, method: p.method }, after: { reason } });
    const officers = await this.prisma.associationOfficer.findMany({ where: { associationId: p.levy.associationId, endedAt: null }, select: { studentId: true } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DUES_VOIDED,
      recipients: [{ userId: p.studentId }, ...officers.map((o) => ({ userId: o.studentId }))],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { association: p.levy.association.code, receipt: p.receiptNumber, amount: formatCedis(p.amount), reason },
      link: '/dues',
    });
    return { ok: true };
  }

  /** Every receipt for an association (Dean of Students view), newest first. */
  async receipts(associationId: string) {
    return this.prisma.duesPayment.findMany({
      where: { levy: { associationId } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true, amount: true, method: true, receiptNumber: true, createdAt: true, voidedAt: true, voidReason: true, recordedById: true, levy: { select: { title: true } }, student: { select: { firstName: true, lastName: true, indexNumber: true } } },
    });
  }

  // ----- Officers -----

  private async officerOf(user: AuthUser, associationId: string) {
    const terms = await this.prisma.associationOfficer.findMany({ where: { studentId: user.id, associationId, endedAt: null } });
    if (!terms.some((t) => termActive(t))) throw new ForbiddenException({ code: 'NOT_OFFICER', message: 'You are not a current officer of this association.' });
  }

  async myOffices(user: AuthUser) {
    const terms = await this.prisma.associationOfficer.findMany({ where: { studentId: user.id, endedAt: null }, include: { association: true } });
    const current = terms.filter((t) => termActive(t));
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, include: { academicYear: true } });
    return Promise.all(current.map(async (t) => ({
      office: t.office,
      endsOn: t.endsOn,
      association: { id: t.association.id, code: t.association.code, name: t.association.name },
      semester: semester ? { id: semester.id, label: `${semester.academicYear.label}, Semester ${semester.number}` } : null,
      members: await this.prisma.user.count({ where: this.membersWhere(t.associationId) }),
      levies: await this.prisma.duesLevy.findMany({
        where: { associationId: t.associationId, ...(semester ? { semesterId: semester.id } : {}) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, amount: true, dueOn: true, isOpen: true, payments: { where: { voidedAt: null }, select: { amount: true, method: true } } },
      }).then((ls) => ls.map(({ payments, ...l }) => ({ ...l, paidCount: payments.length, online: payments.filter((p) => p.method === 'ONLINE').reduce((s, p) => s + p.amount, 0), cash: payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0) }))),
    })));
  }

  async createLevy(user: AuthUser, associationId: string, dto: LevyDto) {
    await this.officerOf(user, associationId);
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true } });
    if (!semester) throw new BadRequestException({ code: 'NO_SEMESTER', message: 'There is no current semester.' });
    const levy = await this.prisma.duesLevy.create({ data: { associationId, semesterId: semester.id, title: dto.title, amount: dto.amount, dueOn: new Date(dto.dueOn), createdById: user.id } });
    await this.audit.record({ action: 'dues.levy_created', module: 'dues', targetType: 'DuesLevy', targetId: levy.id, after: { title: dto.title, amount: dto.amount } });
    return levy;
  }

  async setLevyOpen(user: AuthUser, levyId: string, isOpen: boolean) {
    const levy = await this.prisma.duesLevy.findUnique({ where: { id: levyId } });
    if (!levy) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dues not found.' });
    await this.officerOf(user, levy.associationId);
    await this.prisma.duesLevy.update({ where: { id: levyId }, data: { isOpen } });
    await this.audit.record({ action: isOpen ? 'dues.levy_reopened' : 'dues.levy_closed', module: 'dues', targetType: 'DuesLevy', targetId: levyId });
    return { isOpen };
  }

  /** Every member with whether they have paid, for the officer's list. */
  async levyMembers(user: AuthUser, levyId: string) {
    const levy = await this.prisma.duesLevy.findUnique({ where: { id: levyId }, include: { association: true } });
    if (!levy) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dues not found.' });
    await this.officerOf(user, levy.associationId);
    const [members, paid] = await Promise.all([
      this.prisma.user.findMany({ where: this.membersWhere(levy.associationId), orderBy: { indexNumber: 'asc' }, select: { id: true, firstName: true, lastName: true, indexNumber: true, studentProfile: { select: { currentLevel: true } } } }),
      this.prisma.duesPayment.findMany({ where: { levyId, voidedAt: null }, select: { studentId: true, receiptNumber: true, method: true, createdAt: true } }),
    ]);
    const byStudent = new Map(paid.map((p) => [p.studentId, p]));
    return {
      levy: { id: levy.id, title: levy.title, amount: levy.amount, dueOn: levy.dueOn, isOpen: levy.isOpen, association: { code: levy.association.code, name: levy.association.name } },
      members: members.map((m) => ({ ...m, level: m.studentProfile?.currentLevel ?? null, studentProfile: undefined, payment: byStudent.get(m.id) ?? null })),
    };
  }

  async recordCash(user: AuthUser, levyId: string, indexNumber: string) {
    const levy = await this.prisma.duesLevy.findUnique({ where: { id: levyId } });
    if (!levy) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dues not found.' });
    await this.officerOf(user, levy.associationId);
    if (!levy.isOpen) throw new ConflictException({ code: 'CLOSED', message: 'These dues are closed. Reopen them to record payments.' });
    const student = await this.prisma.user.findFirst({ where: { indexNumber, ...this.membersWhere(levy.associationId) }, select: { id: true, firstName: true, lastName: true } });
    if (!student) throw new BadRequestException({ code: 'NOT_MEMBER', message: 'That index number is not a member of this association.' });
    const p = await this.record(levyId, student.id, levy.amount, 'CASH', user.id);
    await this.audit.record({ action: 'dues.cash_recorded', module: 'dues', targetType: 'DuesPayment', targetId: p.id, after: { receipt: p.receiptNumber, amount: p.amount, student: indexNumber } });
    await this.sendReceipt(p.id);
    return { receiptNumber: p.receiptNumber, amount: p.amount, student: `${student.firstName} ${student.lastName}` };
  }

  // ----- Students -----

  async mine(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Departmental dues are for students.' });
    const associations = await this.prisma.association.findMany({ where: { isActive: true, departments: { some: { department: { programmes: { some: { students: { some: { userId: user.id } } } } } } } }, select: { id: true, code: true, name: true } });
    const [levies, payments] = await Promise.all([
      this.prisma.duesLevy.findMany({ where: { associationId: { in: associations.map((a) => a.id) } }, orderBy: { createdAt: 'desc' }, include: { association: { select: { code: true, name: true } }, semester: { include: { academicYear: true } } } }),
      this.prisma.duesPayment.findMany({ where: { studentId: user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, levyId: true, amount: true, method: true, receiptNumber: true, createdAt: true, voidedAt: true, voidReason: true } }),
    ]);
    return {
      associations,
      provider: this.payments.providerName,
      levies: levies.map((l) => ({
        id: l.id, title: l.title, amount: l.amount, dueOn: l.dueOn, isOpen: l.isOpen, association: l.association,
        semester: `${l.semester.academicYear.label}, Semester ${l.semester.number}`,
        payment: payments.find((p) => p.levyId === l.id && !p.voidedAt) ?? null,
      })),
      cancelled: payments.filter((p) => p.voidedAt),
    };
  }

  async payOnline(user: AuthUser, levyId: string) {
    const mine = await this.mine(user);
    const levy = mine.levies.find((l) => l.id === levyId);
    if (!levy) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dues not found.' });
    if (levy.payment) throw new ConflictException({ code: 'PAID', message: `Already paid (receipt ${levy.payment.receiptNumber}).` });
    if (!levy.isOpen) throw new ConflictException({ code: 'CLOSED', message: 'These dues are closed.' });
    const started = await this.payments.start({ purpose: 'DUES', userId: user.id, subjectId: levyId, amount: levy.amount, returnPath: '/dues', description: `${levy.association.code}: ${levy.title}` });
    return { paymentUrl: started.authorizationUrl };
  }

  // ----- Finance -----

  /** Online dues the university holds for each association, what has been paid out, and what is owed. Cash is shown for reference; officers hold it. */
  async settlements() {
    const list = await this.prisma.association.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true, code: true, name: true, payoutNetwork: true, payoutNumber: true, payoutName: true,
        levies: { select: { payments: { where: { voidedAt: null }, select: { amount: true, method: true } } } },
        payouts: { orderBy: { createdAt: 'desc' }, select: { id: true, amount: true, reference: true, createdAt: true } },
      },
    });
    return list.map(({ levies, payouts, ...a }) => {
      const pays = levies.flatMap((l) => l.payments);
      const online = pays.filter((p) => p.method === 'ONLINE').reduce((t, p) => t + p.amount, 0);
      const paidOut = payouts.reduce((t, p) => t + p.amount, 0);
      return { ...a, online, cash: pays.filter((p) => p.method === 'CASH').reduce((t, p) => t + p.amount, 0), paidOut, owed: online - paidOut, payouts: payouts.slice(0, 5) };
    });
  }

  async recordPayout(user: AuthUser, dto: DuesPayoutDto) {
    const s = (await this.settlements()).find((x) => x.id === dto.associationId);
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Association not found.' });
    if (dto.amount > s.owed) throw new BadRequestException({ code: 'TOO_MUCH', message: `Only ${formatCedis(s.owed)} is owed to ${s.code}.` });
    const p = await this.prisma.duesPayout.create({ data: { associationId: dto.associationId, amount: dto.amount, reference: dto.reference || null, note: dto.note || null, recordedById: user.id } });
    await this.audit.record({ action: 'dues.payout_recorded', module: 'dues', targetType: 'Association', targetId: dto.associationId, after: { amount: dto.amount, reference: dto.reference } });
    return p;
  }

  /** A dues receipt as a PDF, for the student it belongs to, their association's officers, or the Dean of Students office. */
  async receiptPdf(user: AuthUser, paymentId: string, isDean: boolean) {
    const p = await this.prisma.duesPayment.findUnique({ where: { id: paymentId }, include: { levy: { include: { association: true, semester: { include: { academicYear: true } } } }, student: { select: { firstName: true, lastName: true, indexNumber: true } } } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Receipt not found.' });
    const officer = await this.prisma.associationOfficer.count({ where: { studentId: user.id, associationId: p.levy.associationId, endedAt: null } });
    if (p.studentId !== user.id && !officer && !isDean) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Receipt not found.' });
    const d = await PdfDoc.create(`${p.levy.association.code} dues receipt`, p.voidedAt ? `CANCELLED BY THE DEAN OF STUDENTS OFFICE: ${p.voidReason ?? ''}` : p.levy.association.name);
    d.rows([
      ['Receipt number', p.receiptNumber],
      ['Student', `${p.student.firstName} ${p.student.lastName} (${p.student.indexNumber ?? ''})`],
      ['For', `${p.levy.title}, ${p.levy.semester.academicYear.label} Semester ${p.levy.semester.number}`],
      ['Amount', formatCedis(p.amount)],
      ['Paid', p.method === 'CASH' ? 'Cash to an association officer' : 'Online'],
      ['Date', p.createdAt.toISOString().slice(0, 10)],
    ]);
    return { filename: `dues-receipt-${p.receiptNumber}.pdf`, buffer: await d.toBuffer(`Generated ${new Date().toISOString().slice(0, 10)} from the ANU platform.`) };
  }
}
