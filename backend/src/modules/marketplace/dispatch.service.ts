import { TransfersService } from '../payments/transfers.service';
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { averageStars, deliveryArea, formatCedis } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { EmploymentRulesService } from '../employment/employment-rules.service';
import { OrdersService } from './orders.service';

const IN_HAND = ['ASSIGNED', 'PICKED_UP'] as const;
/** Dispatchers who have not opened the Deliveries page for this long are taken offline. */
const OFFLINE_AFTER_MINUTES = 20;

/**
 * The dispatcher's side of a delivery. Taking a delivery is a single conditional update, so when
 * two dispatchers tap at the same moment only one gets it.
 */
@Injectable()
export class DispatchService implements OnModuleInit {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly orders: OrdersService,
    private readonly rules: EmploymentRulesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly transfers: TransfersService,
  ) {}

  async onModuleInit() {
    this.transfers.register('DISPATCHER', {
      recipient: async (dispatcherId) => {
        const p = await this.prisma.dispatcherProfile.findUniqueOrThrow({ where: { id: dispatcherId }, select: { payoutNetwork: true, payoutNumber: true, payoutName: true, student: { select: { firstName: true, lastName: true } } } });
        const row = (await this.settlements('2000-01-01T00:00:00Z', new Date().toISOString())).find((r) => r.id === dispatcherId);
        return { network: p.payoutNetwork, number: p.payoutNumber, name: p.payoutName, owed: row?.owed ?? 0, label: `${p.student.firstName} ${p.student.lastName}` };
      },
      record: async (actorId, dispatcherId, amount, reference, meta) => {
        const now = new Date().toISOString();
        await this.recordPayout({ id: actorId } as AuthUser, { dispatcherId, periodFrom: meta.periodFrom ?? now, periodTo: meta.periodTo ?? now, amount, reference, note: 'Paystack transfer' });
      },
    });
    await this.jobs.work(QUEUES.DISPATCH_MINUTELY, () => this.tick());
    await this.jobs.schedule(QUEUES.DISPATCH_MINUTELY, '*/5 * * * *');
  }

  private async profile(user: AuthUser) {
    const p = user.type === 'STUDENT' ? await this.prisma.dispatcherProfile.findUnique({ where: { studentId: user.id }, include: { student: { select: { firstName: true } } } }) : null;
    if (!p || p.status !== 'ACTIVE') throw new ForbiddenException({ code: 'NOT_DISPATCHER', message: 'Only approved dispatchers can take deliveries.' });
    return p;
  }

  private async mineOrThrow(user: AuthUser, deliveryId: string) {
    const p = await this.profile(user);
    const d = await this.prisma.delivery.findUnique({ where: { id: deliveryId }, include: { order: { select: { id: true, number: true, vendor: { select: { name: true, ownerId: true } } } } } });
    if (!d || d.dispatcherId !== p.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'This delivery is not with you.' });
    return { p, d };
  }

  /** The Deliveries page. Opening it also counts as checking in while online. */
  async state(user: AuthUser) {
    const p = await this.profile(user);
    if (p.online) await this.prisma.dispatcherProfile.update({ where: { id: p.id }, data: { lastSeenAt: new Date() } });
    const rules = await this.rules.get();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [available, mine, doneToday] = await Promise.all([
      p.online
        ? this.prisma.delivery.findMany({
            where: { status: 'WAITING', order: { status: 'READY', customerId: { not: p.studentId } } },
            orderBy: { offeredAt: 'asc' },
            take: 30,
            select: { id: true, fee: true, feeSettlement: true, offeredAt: true, order: { select: { number: true, deliveryAddress: true, vendor: { select: { name: true, location: true } }, _count: { select: { items: true } } } } },
          })
        : [],
      this.prisma.delivery.findMany({
        where: { dispatcherId: p.id, status: { in: [...IN_HAND] } },
        orderBy: { assignedAt: 'asc' },
        select: {
          id: true, status: true, fee: true, feeSettlement: true, assignedAt: true, pickedUpAt: true, problemNote: true,
          order: {
            select: {
              id: true, number: true, deliveryAddress: true, deliveryNote: true, total: true,
              vendor: { select: { name: true, location: true, phone: true } },
              customer: { select: { firstName: true, lastName: true, phone: true } },
              items: { select: { name: true, quantity: true } },
            },
          },
        },
      }),
      this.prisma.delivery.findMany({ where: { dispatcherId: p.id, status: 'DELIVERED', deliveredAt: { gte: today } }, select: { fee: true } }),
    ]);
    return {
      profile: { online: p.online, transport: p.transport },
      maxActive: rules.maxActiveDeliveries,
      feePerDelivery: rules.dispatchFee,
      // Only the hall shows until the delivery is taken; the full address and phone numbers come after.
      available: available.map((d) => ({ id: d.id, fee: d.fee, feeSettlement: d.feeSettlement, offeredAt: d.offeredAt, number: d.order.number, vendor: d.order.vendor, area: deliveryArea(d.order.deliveryAddress), items: d.order._count.items })),
      mine,
      today: { deliveries: doneToday.length, earned: doneToday.reduce((s, d) => s + d.fee, 0) },
      rating: averageStars((await this.prisma.orderRating.findMany({ where: { dispatcherId: p.id, dispatcherStars: { not: null } }, select: { dispatcherStars: true } })).map((r) => r.dispatcherStars!)),
    };
  }

  async setOnline(user: AuthUser, online: boolean) {
    const p = await this.profile(user);
    await this.prisma.dispatcherProfile.update({ where: { id: p.id }, data: { online, lastSeenAt: new Date() } });
    await this.audit.record({ action: online ? 'dispatch.online' : 'dispatch.offline', module: 'dispatch', targetType: 'DispatcherProfile', targetId: p.id });
    return { online };
  }

  async take(user: AuthUser, deliveryId: string) {
    const p = await this.profile(user);
    if (!p.online) throw new ConflictException({ code: 'OFFLINE', message: 'Go online to take deliveries.' });
    const rules = await this.rules.get();
    const inHand = await this.prisma.delivery.count({ where: { dispatcherId: p.id, status: { in: [...IN_HAND] } } });
    if (inHand >= rules.maxActiveDeliveries) throw new ConflictException({ code: 'FULL', message: `You can carry ${rules.maxActiveDeliveries} deliveries at a time. Finish one first.` });
    const taken = await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'WAITING', dispatcherId: null, order: { status: 'READY', customerId: { not: p.studentId } } },
      data: { status: 'ASSIGNED', dispatcherId: p.id, assignedAt: new Date() },
    });
    if (taken.count !== 1) throw new ConflictException({ code: 'GONE', message: 'Someone else has just taken this delivery.' });
    const d = await this.prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { order: { select: { id: true, number: true, vendor: { select: { ownerId: true } } } } } });
    await this.audit.record({ action: 'dispatch.taken', module: 'dispatch', targetType: 'Delivery', targetId: deliveryId, metadata: { order: d.order.number } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DELIVERY_UPDATE,
      recipients: [{ userId: d.order.vendor.ownerId }],
      channels: ['IN_APP'],
      sharedVars: { number: d.order.number, headline: `${p.student.firstName} is coming to collect it`, detail: 'A campus dispatcher has taken this delivery.', link: '/vendor' },
      link: '/vendor',
    });
    return { ok: true };
  }

  /** Hands a delivery back before picking it up, so someone else can take it. */
  async release(user: AuthUser, deliveryId: string) {
    const { d } = await this.mineOrThrow(user, deliveryId);
    const r = await this.prisma.delivery.updateMany({ where: { id: deliveryId, status: 'ASSIGNED' }, data: { status: 'WAITING', dispatcherId: null, assignedAt: null } });
    if (r.count !== 1) throw new ConflictException({ code: 'NOT_ALLOWED', message: 'You have already collected this order. Deliver it or report a problem.' });
    await this.audit.record({ action: 'dispatch.released', module: 'dispatch', targetType: 'Delivery', targetId: deliveryId, metadata: { order: d.order.number } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DELIVERY_UPDATE,
      recipients: [{ userId: d.order.vendor.ownerId }],
      channels: ['IN_APP'],
      sharedVars: { number: d.order.number, headline: 'the dispatcher has handed it back', detail: 'It is waiting for another dispatcher.', link: '/vendor' },
      link: '/vendor',
    });
    await this.orders.offerToDispatchers(d.order.id);
    return { ok: true };
  }

  async pickedUp(user: AuthUser, deliveryId: string) {
    const { p, d } = await this.mineOrThrow(user, deliveryId);
    await this.orders.move(d.order.id, 'OUT_FOR_DELIVERY', 'DISPATCHER', { dispatcherId: p.id });
    return { ok: true };
  }

  async delivered(user: AuthUser, deliveryId: string, code: string) {
    const { p, d } = await this.mineOrThrow(user, deliveryId);
    await this.orders.move(d.order.id, 'COMPLETED', 'DISPATCHER', { dispatcherId: p.id, code });
    // Stop holding a location once nothing is being carried.
    if (!(await this.prisma.delivery.count({ where: { dispatcherId: p.id, status: 'PICKED_UP' } }))) {
      await this.prisma.dispatcherProfile.update({ where: { id: p.id }, data: { lastLat: null, lastLng: null, lastAccuracy: null, lastLocationAt: null } });
    }
    return { ok: true, earned: d.fee };
  }

  /** Something is wrong (customer not answering, wrong address). The vendor decides what to do. */
  async problem(user: AuthUser, deliveryId: string, note: string) {
    const { p, d } = await this.mineOrThrow(user, deliveryId);
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { problemNote: note, problemAt: new Date() } });
    await this.audit.record({ action: 'dispatch.problem', module: 'dispatch', targetType: 'Delivery', targetId: deliveryId, metadata: { order: d.order.number, note } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DELIVERY_UPDATE,
      recipients: [{ userId: d.order.vendor.ownerId }],
      channels: ['IN_APP', 'SMS'],
      sharedVars: { number: d.order.number, headline: 'the dispatcher reports a problem', detail: `${p.student.firstName}: ${note}`, link: '/vendor' },
      link: '/vendor',
    });
    return { ok: true };
  }

  async earnings(user: AuthUser, from: string, to: string) {
    const p = await this.profile(user);
    const range = { gte: new Date(from), lte: new Date(to) };
    const [deliveries, payouts, allEarned, allPaid] = await Promise.all([
      this.prisma.delivery.findMany({ where: { dispatcherId: p.id, status: 'DELIVERED', deliveredAt: range }, orderBy: { deliveredAt: 'desc' }, select: { id: true, fee: true, feeSettlement: true, deliveredAt: true, order: { select: { number: true, vendor: { select: { name: true } }, deliveryAddress: true } } } }),
      this.prisma.dispatcherPayout.findMany({ where: { dispatcherId: p.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, amount: true, reference: true, createdAt: true, periodFrom: true, periodTo: true } }),
      this.prisma.delivery.aggregate({ where: { dispatcherId: p.id, status: 'DELIVERED', feeSettlement: 'UNIVERSITY' }, _sum: { fee: true } }),
      this.prisma.dispatcherPayout.aggregate({ where: { dispatcherId: p.id }, _sum: { amount: true } }),
    ]);
    return {
      deliveries: deliveries.map((d) => ({ ...d, order: { ...d.order, deliveryAddress: deliveryArea(d.order.deliveryAddress) } })),
      earned: deliveries.reduce((s, d) => s + d.fee, 0),
      payouts,
      balance: (allEarned._sum.fee ?? 0) - (allPaid._sum.amount ?? 0),
      payout: { network: p.payoutNetwork, number: p.payoutNumber, name: p.payoutName },
    };
  }

  /** Every 5 minutes: take idle dispatchers offline, and tell vendors when nobody has taken an order. */
  async tick() {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MINUTES * 60_000);
    await this.prisma.dispatcherProfile.updateMany({ where: { online: true, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] }, data: { online: false } });

    const { dispatchWaitMinutes } = await this.rules.get();
    const waiting = await this.prisma.delivery.findMany({
      where: { status: 'WAITING', waitAlertAt: null, offeredAt: { lt: new Date(Date.now() - dispatchWaitMinutes * 60_000) }, order: { status: 'READY' } },
      select: { id: true, order: { select: { number: true, vendor: { select: { ownerId: true } } } } },
    });
    for (const d of waiting) {
      try {
        await this.prisma.delivery.update({ where: { id: d.id }, data: { waitAlertAt: new Date() } });
        await this.notifications.notify({
          eventKey: EVENT_KEYS.DELIVERY_UPDATE,
          recipients: [{ userId: d.order.vendor.ownerId }],
          channels: ['IN_APP', 'SMS'],
          sharedVars: { number: d.order.number, headline: 'no dispatcher yet', detail: `Nobody has taken it in ${dispatchWaitMinutes} minutes. You can send it with your own staff from the orders board, or keep waiting.`, link: '/vendor' },
          link: '/vendor',
        });
      } catch (err) {
        this.logger.error(`Wait alert failed for delivery ${d.id}: ${(err as Error).message}`);
      }
    }
  }

  // ----- Finance -----

  /** What each dispatcher earned in a period, what has been paid, and what is owed overall. */
  async settlements(from: string, to: string) {
    const range = { gte: new Date(from), lte: new Date(to) };
    const profiles = await this.prisma.dispatcherProfile.findMany({
      where: { status: { in: ['ACTIVE', 'SUSPENDED', 'ENDED'] } },
      orderBy: { student: { lastName: 'asc' } },
      select: {
        id: true, status: true, payoutNetwork: true, payoutNumber: true, payoutName: true,
        student: { select: { firstName: true, lastName: true, indexNumber: true } },
        deliveries: { where: { status: 'DELIVERED' }, select: { fee: true, deliveredAt: true, feeSettlement: true } },
        payouts: { select: { amount: true, createdAt: true, periodFrom: true, periodTo: true, reference: true } },
      },
    });
    return profiles.map(({ deliveries, payouts, ...p }) => {
      const inPeriod = deliveries.filter((d) => d.deliveredAt && d.deliveredAt >= range.gte && d.deliveredAt <= range.lte);
      // Finance only owes fees the university collected (Paystack); vendors and customers pay the rest directly.
      const earnedAll = deliveries.filter((d) => d.feeSettlement === 'UNIVERSITY').reduce((s, d) => s + d.fee, 0);
      const paidAll = payouts.reduce((s, x) => s + x.amount, 0);
      return {
        ...p,
        deliveries: inPeriod.length,
        earned: inPeriod.reduce((s, d) => s + d.fee, 0),
        paidOut: payouts.filter((x) => x.periodFrom >= range.gte && x.periodTo <= range.lte).reduce((s, x) => s + x.amount, 0),
        owed: earnedAll - paidAll,
      };
    }).filter((r) => r.deliveries > 0 || r.owed !== 0);
  }

  async recordPayout(user: AuthUser, dto: { dispatcherId: string; periodFrom: string; periodTo: string; amount: number; reference?: string; note?: string }) {
    const p = await this.prisma.dispatcherProfile.findUnique({ where: { id: dto.dispatcherId }, select: { id: true, studentId: true } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dispatcher not found.' });
    const payout = await this.prisma.dispatcherPayout.create({
      data: { dispatcherId: p.id, periodFrom: new Date(dto.periodFrom), periodTo: new Date(dto.periodTo), amount: dto.amount, reference: dto.reference || null, note: dto.note || null, recordedById: user.id },
    });
    await this.audit.record({ action: 'dispatch.payout_recorded', module: 'dispatch', targetType: 'DispatcherProfile', targetId: p.id, after: { amount: dto.amount, reference: dto.reference } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DISPATCHER_UPDATE,
      recipients: [{ userId: p.studentId }],
      channels: ['IN_APP', 'SMS'],
      sharedVars: { headline: `${formatCedis(dto.amount)} paid to you`, detail: `Finance has paid you ${formatCedis(dto.amount)} for your deliveries${dto.reference ? ` (transaction ${dto.reference})` : ''}.`, smsDetail: dto.reference ? `Transaction ${dto.reference}.` : '' },
      link: '/dispatch/earnings',
    });
    return payout;
  }

  /** The dispatcher's phone reports its position while carrying an order; nothing is kept otherwise. */
  async location(user: AuthUser, dto: { lat: number; lng: number; accuracy?: number }) {
    const p = await this.profile(user);
    const carrying = await this.prisma.delivery.count({ where: { dispatcherId: p.id, status: 'PICKED_UP' } });
    if (!carrying) {
      await this.prisma.dispatcherProfile.update({ where: { id: p.id }, data: { lastLat: null, lastLng: null, lastAccuracy: null, lastLocationAt: null } });
      return { sharing: false };
    }
    await this.prisma.dispatcherProfile.update({ where: { id: p.id }, data: { lastLat: dto.lat, lastLng: dto.lng, lastAccuracy: dto.accuracy ?? null, lastLocationAt: new Date(), lastSeenAt: new Date() } });
    return { sharing: true };
  }
}
