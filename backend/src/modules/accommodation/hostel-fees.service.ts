import { TransfersService } from '../payments/transfers.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { formatCedis, PERMISSIONS, ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PdfDoc } from '../../core/pdf/pdf';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PaymentsService } from '../payments/payments.service';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { HallChargesService } from '../fees/hall-charges.service';

const METHOD_LABEL = { ONLINE: 'Online (Paystack)', CASH: 'Cash', MOBILE_MONEY: 'Mobile money', BANK: 'Bank deposit' } as const;
const newReceipt = () => `ANU-H-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

const FEE_SELECT = {
  id: true, description: true, amount: true, semesterId: true, createdAt: true, allocationId: true, bookingId: true,
  hostel: { select: { id: true, name: true, kind: true, ownerId: true } },
  student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, phone: true } },
  payments: { orderBy: { createdAt: 'asc' as const }, select: { id: true, amount: true, method: true, reference: true, receiptNumber: true, paidOn: true, createdAt: true, reversedAt: true, reversalReason: true } },
} satisfies Prisma.HostelFeeSelect;
type FeeRow = Prisma.HostelFeeGetPayload<{ select: typeof FEE_SELECT }>;
const paidOf = (f: FeeRow) => f.payments.filter((p) => !p.reversedAt).reduce((t, p) => t + p.amount, 0);
const withBalance = (f: FeeRow) => ({ ...f, paid: paidOf(f), balance: f.amount - paidOf(f) });

/**
 * Hostel fees for university halls and private hostels, in their own account per placement (not on the
 * tuition bill). Students pay online; the Hostel Manager (halls) or the owner (private) records cash,
 * MoMo or bank payments. Every payment has a receipt, sent to the student and to the Hostel Manager or owner.
 */
@Injectable()
export class HostelFeesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly resolver: PermissionResolverService,
    private readonly hallCharges: HallChargesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly transfers: TransfersService,
  ) {}

  onModuleInit() {
    this.transfers.register('HOSTEL_OWNER', {
      recipient: async (hostelId) => {
        const h = await this.prisma.hostel.findUniqueOrThrow({ where: { id: hostelId }, select: { name: true, payoutNetwork: true, payoutNumber: true, payoutName: true } });
        const row = (await this.ownerSettlements()).find((x) => x.id === hostelId);
        return { network: h.payoutNetwork, number: h.payoutNumber, name: h.payoutName, owed: row?.owed ?? 0, label: h.name };
      },
      record: async (actorId, hostelId, amount, reference) => {
        await this.recordOwnerPayout({ id: actorId } as AuthUser, { hostelId, amount, reference });
      },
    });
    this.payments.onSucceeded('HOSTEL_FEE', async (p) => {
      if (!p.subjectId || (await this.prisma.hostelFeePayment.findUnique({ where: { reference: p.reference } }))) return;
      const pay = await this.prisma.hostelFeePayment.create({ data: { feeId: p.subjectId, amount: p.amount, method: 'ONLINE', reference: p.reference, receiptNumber: newReceipt(), paidOn: p.paidAt ?? new Date(), recordedById: p.userId } });
      await this.sendReceipt(pay.id);
    });
  }

  // ----- Keeping the account in step with the placement -----

  /** A university room: the room's price while the offer is accepted, nothing otherwise. */
  async syncAllocation(allocationId: string, actorId: string) {
    const a = await this.prisma.roomAllocation.findUnique({ where: { id: allocationId }, select: { status: true, studentId: true, semesterId: true, room: { select: { number: true, pricePerSemester: true, hostel: { select: { id: true, name: true } } } } } });
    if (!a) return;
    // Any hall fee charged on the tuition bill before hostel fee accounts existed is credited back there.
    await this.hallCharges.sync(allocationId, actorId);
    const amount = a.status === 'ACCEPTED' ? a.room.pricePerSemester : 0;
    await this.upsert({ allocationId }, { studentId: a.studentId, semesterId: a.semesterId, hostelId: a.room.hostel.id, description: `${a.room.hostel.name}, room ${a.room.number}`, amount });
  }

  /** A private hostel bed: the room type's price once the owner accepts, nothing if cancelled. */
  async syncBooking(bookingId: string) {
    const b = await this.prisma.privateBooking.findUnique({ where: { id: bookingId }, select: { status: true, studentId: true, semesterId: true, roomType: { select: { name: true, pricePerSemester: true, hostel: { select: { id: true, name: true } } } } } });
    if (!b) return;
    const amount = b.status === 'ACCEPTED' ? b.roomType.pricePerSemester : 0;
    await this.upsert({ bookingId }, { studentId: b.studentId, semesterId: b.semesterId, hostelId: b.roomType.hostel.id, description: `${b.roomType.hostel.name}, ${b.roomType.name}`, amount });
  }

  private async upsert(where: { allocationId: string } | { bookingId: string }, data: { studentId: string; semesterId: string; hostelId: string; description: string; amount: number }) {
    const existing = await this.prisma.hostelFee.findUnique({ where: where as Prisma.HostelFeeWhereUniqueInput });
    if (!existing && data.amount === 0) return;
    if (existing) await this.prisma.hostelFee.update({ where: { id: existing.id }, data });
    else await this.prisma.hostelFee.create({ data: { ...data, ...where } });
  }

  // ----- Who may act on a fee -----

  private async canManage(user: AuthUser, fee: { hostel: { kind: string; ownerId: string | null } }) {
    if (fee.hostel.kind === 'PRIVATE') return fee.hostel.ownerId === user.id;
    return (await this.resolver.permissionsFor(user.id, user.activeRoleKey)).has(PERMISSIONS.HOSTELS_MANAGE);
  }

  private async load(id: string) {
    const f = await this.prisma.hostelFee.findUnique({ where: { id }, select: FEE_SELECT });
    if (!f) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel fee not found.' });
    return f;
  }

  // ----- Students -----

  async mine(user: AuthUser) {
    const fees = await this.prisma.hostelFee.findMany({ where: { studentId: user.id }, orderBy: { createdAt: 'desc' }, select: FEE_SELECT });
    return { provider: this.payments.providerName, fees: fees.map(withBalance) };
  }

  async payOnline(user: AuthUser, feeId: string, amount: number) {
    const f = await this.load(feeId);
    if (f.student.id !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel fee not found.' });
    const balance = f.amount - paidOf(f);
    if (balance <= 0) throw new ConflictException({ code: 'PAID', message: 'These hostel fees are fully paid.' });
    if (amount > balance || amount < Math.min(1000, balance)) throw new BadRequestException({ code: 'AMOUNT', message: `Pay between ${formatCedis(Math.min(1000, balance))} and ${formatCedis(balance)}.` });
    const started = await this.payments.start({ purpose: 'HOSTEL_FEE', userId: user.id, subjectId: feeId, amount, returnPath: '/accommodation', description: `Hostel fees: ${f.description}` });
    return { paymentUrl: started.authorizationUrl };
  }

  // ----- Hostel Manager (halls) and owners (private) -----

  async list(user: AuthUser, q: { search?: string; unpaidOnly?: boolean }) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    const hostelFilter: Prisma.HostelWhereInput = perms.has(PERMISSIONS.HOSTELS_MANAGE) ? { kind: 'UNIVERSITY' } : { kind: 'PRIVATE', ownerId: user.id };
    if (!perms.has(PERMISSIONS.HOSTELS_MANAGE) && !perms.has(PERMISSIONS.PRIVATE_HOSTEL_OWN)) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'Only the Hostel Manager and hostel owners see hostel fees.' });
    const s = q.search?.trim();
    const fees = await this.prisma.hostelFee.findMany({
      where: { semesterId: semester?.id, hostel: hostelFilter, ...(s ? { student: { OR: [{ indexNumber: { contains: s.toUpperCase() } }, { lastName: { contains: s, mode: 'insensitive' } }, { firstName: { contains: s, mode: 'insensitive' } }] } } : {}) },
      orderBy: [{ hostel: { name: 'asc' } }, { description: 'asc' }],
      take: 500,
      select: FEE_SELECT,
    });
    const rows = fees.map(withBalance).filter((f) => !q.unpaidOnly || f.balance > 0);
    return { rows, totals: { due: rows.reduce((t, f) => t + f.amount, 0), paid: rows.reduce((t, f) => t + f.paid, 0) } };
  }

  async record(user: AuthUser, feeId: string, dto: { amount: number; method: 'CASH' | 'MOBILE_MONEY' | 'BANK'; reference?: string; paidOn: string }) {
    const f = await this.load(feeId);
    if (!(await this.canManage(user, f))) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: f.hostel.kind === 'PRIVATE' ? 'Only the owner records payments for this hostel.' : 'Only the Hostel Manager records payments for university halls.' });
    if (new Date(dto.paidOn) > new Date()) throw new BadRequestException({ code: 'FUTURE', message: 'The payment date cannot be in the future.' });
    if (dto.method !== 'CASH' && !dto.reference) throw new BadRequestException({ code: 'REFERENCE', message: 'Enter the transaction ID for MoMo and bank payments.' });
    try {
      const pay = await this.prisma.hostelFeePayment.create({ data: { feeId, amount: dto.amount, method: dto.method, reference: dto.reference ? `${dto.method}:${dto.reference.toUpperCase()}` : null, receiptNumber: newReceipt(), paidOn: new Date(dto.paidOn), recordedById: user.id } });
      await this.audit.record({ action: 'accommodation.hostel_fee_recorded', module: 'accommodation', targetType: 'HostelFee', targetId: feeId, after: { amount: dto.amount, method: dto.method, receipt: pay.receiptNumber } });
      await this.sendReceipt(pay.id);
      return withBalance(await this.load(feeId));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'DUPLICATE', message: 'A payment with that transaction ID has already been recorded.' });
      throw err;
    }
  }

  async reverse(user: AuthUser, paymentId: string, reason: string) {
    const p = await this.prisma.hostelFeePayment.findUnique({ where: { id: paymentId } });
    if (!p || p.reversedAt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payment not found or already reversed.' });
    if (p.method === 'ONLINE') throw new ForbiddenException({ code: 'ONLINE', message: 'Online payments are refunded through Paystack.' });
    const f = await this.load(p.feeId);
    if (!(await this.canManage(user, f))) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'You cannot reverse this payment.' });
    await this.prisma.hostelFeePayment.update({ where: { id: paymentId }, data: { reversedAt: new Date(), reversedById: user.id, reversalReason: reason } });
    await this.audit.record({ action: 'accommodation.hostel_fee_reversed', module: 'accommodation', targetType: 'HostelFee', targetId: f.id, before: { receipt: p.receiptNumber, amount: p.amount }, after: { reason } });
    return withBalance(await this.load(f.id));
  }

  /** The receipt goes to the student and to whoever runs the hostel: the Hostel Manager for halls, the owner for private hostels. */
  private async sendReceipt(paymentId: string) {
    const p = await this.prisma.hostelFeePayment.findUniqueOrThrow({ where: { id: paymentId } });
    const f = withBalance(await this.load(p.feeId));
    const managers = f.hostel.kind === 'PRIVATE'
      ? (f.hostel.ownerId ? [f.hostel.ownerId] : [])
      : (await this.prisma.user.findMany({ where: { status: 'ACTIVE', roles: { some: { role: { key: ROLE_KEYS.HOSTEL_MANAGER } } } }, select: { id: true } })).map((u) => u.id);
    const vars = { hostel: f.hostel.name, student: `${f.student.firstName} ${f.student.lastName}`, indexNumber: f.student.indexNumber ?? '', place: f.description, amount: formatCedis(p.amount), method: METHOD_LABEL[p.method], receipt: p.receiptNumber, balance: formatCedis(Math.max(0, f.balance)) };
    await this.notifications.notify({ eventKey: EVENT_KEYS.HOSTEL_FEE_RECEIPT, recipients: [{ userId: f.student.id }], channels: ['IN_APP', 'EMAIL', 'SMS'], sharedVars: { ...vars, link: '/accommodation' }, link: '/accommodation' });
    if (managers.length) await this.notifications.notify({ eventKey: EVENT_KEYS.HOSTEL_FEE_RECEIPT, recipients: managers.map((userId) => ({ userId })), channels: ['IN_APP', 'EMAIL'], sharedVars: { ...vars, link: f.hostel.kind === 'PRIVATE' ? '/my-hostel/fees' : '/hostels/fees' }, link: f.hostel.kind === 'PRIVATE' ? '/my-hostel/fees' : '/hostels/fees' });
  }

  async receiptPdf(user: AuthUser, paymentId: string) {
    const p = await this.prisma.hostelFeePayment.findUnique({ where: { id: paymentId } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Receipt not found.' });
    const f = await this.load(p.feeId);
    if (f.student.id !== user.id && !(await this.canManage(user, f))) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Receipt not found.' });
    const d = await PdfDoc.create(`Hostel fees receipt: ${f.hostel.name}`, p.reversedAt ? `THIS PAYMENT WAS REVERSED: ${p.reversalReason ?? ''}` : f.hostel.kind === 'PRIVATE' ? 'Private hostel' : 'University hall');
    d.rows([
      ['Receipt number', p.receiptNumber], ['Student', `${f.student.firstName} ${f.student.lastName} (${f.student.indexNumber ?? ''})`], ['Place', f.description],
      ['Amount received', formatCedis(p.amount)], ['Paid by', METHOD_LABEL[p.method]], ...(p.reference && p.method !== 'ONLINE' ? [['Transaction ID', p.reference.split(':').slice(1).join(':')] as [string, string]] : []),
      ['Date paid', p.paidOn.toISOString().slice(0, 10)], ['Hostel fees for the semester', formatCedis(f.amount)],
    ]);
    return { filename: `hostel-receipt-${p.receiptNumber}.pdf`, buffer: await d.toBuffer(`Generated ${new Date().toISOString().slice(0, 10)} from the ANU platform.`) };
  }

  /** Owners set where Finance sends their online fees. */
  async setPayoutDetails(user: AuthUser, dto: { hostelId: string; network: string; number: string; name: string }) {
    const h = await this.prisma.hostel.findUnique({ where: { id: dto.hostelId }, select: { ownerId: true } });
    if (!h || h.ownerId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
    await this.prisma.hostel.update({ where: { id: dto.hostelId }, data: { payoutNetwork: dto.network, payoutNumber: dto.number, payoutName: dto.name } });
    await this.audit.record({ action: 'accommodation.owner_payout_details', module: 'accommodation', targetType: 'Hostel', targetId: dto.hostelId });
    return { ok: true };
  }

  // ----- Finance: paying private hostel owners the fees collected online -----

  async ownerSettlements() {
    const hostels = await this.prisma.hostel.findMany({
      where: { kind: 'PRIVATE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, payoutNetwork: true, payoutNumber: true, payoutName: true, owner: { select: { firstName: true, lastName: true, phone: true } }, hostelFees: { select: { payments: { where: { method: 'ONLINE', reversedAt: null }, select: { amount: true } } } }, ownerPayouts: { select: { amount: true } } },
    });
    return hostels.map(({ hostelFees, ownerPayouts, ...h }) => {
      const online = hostelFees.flatMap((f) => f.payments).reduce((t, p) => t + p.amount, 0);
      const paidOut = ownerPayouts.reduce((t, p) => t + p.amount, 0);
      return { ...h, online, paidOut, owed: online - paidOut };
    });
  }

  async recordOwnerPayout(user: AuthUser, dto: { hostelId: string; amount: number; reference?: string }) {
    const s = (await this.ownerSettlements()).find((h) => h.id === dto.hostelId);
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
    if (dto.amount > s.owed) throw new BadRequestException({ code: 'TOO_MUCH', message: `Only ${formatCedis(s.owed)} is owed to ${s.name}.` });
    const p = await this.prisma.hostelOwnerPayout.create({ data: { hostelId: dto.hostelId, amount: dto.amount, reference: dto.reference || null, recordedById: user.id } });
    await this.audit.record({ action: 'accommodation.owner_payout_recorded', module: 'accommodation', targetType: 'Hostel', targetId: dto.hostelId, after: { amount: dto.amount, reference: dto.reference } });
    return p;
  }
}
