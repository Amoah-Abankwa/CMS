import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { canTransition, commission, formatCedis, isOpenAt, orderTotals, type OpeningHours, type OrderActor, type OrderStatus } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService, type Channel } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PaymentsService } from '../payments/payments.service';
import { MarketplaceSettingsService } from './marketplace-settings.service';
import { PlaceOrderDto } from './dto/marketplace.dto';

const MAX_ACTIVE_ORDERS = 3;

export const ORDER_SELECT = {
  id: true, number: true, status: true, fulfilment: true, deliveryAddress: true, deliveryNote: true, paymentOption: true,
  subtotal: true, deliveryFee: true, total: true, pickupCode: true, note: true, paid: true,
  placedAt: true, acceptedAt: true, readyAt: true, completedAt: true, cancelledAt: true, cancelledBy: true, cancelReason: true, estimatedReadyAt: true, createdAt: true,
  vendor: { select: { id: true, name: true, location: true, phone: true } },
  customer: { select: { id: true, firstName: true, lastName: true, indexNumber: true, phone: true } },
  items: { select: { name: true, unitPrice: true, quantity: true, lineTotal: true } },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { reference: true, status: true, provider: true, channel: true } },
} satisfies Prisma.FoodOrderSelect;

type OrderRow = Prisma.FoodOrderGetPayload<{ select: typeof ORDER_SELECT }>;

/**
 * Orders move through a fixed set of steps (see canTransition in @anu/shared). Every step is checked
 * against the current status in the database, so two people acting at once cannot both succeed.
 */
@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly payments: PaymentsService,
    private readonly settings: MarketplaceSettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    this.payments.onSucceeded('FOOD_ORDER', async (p) => {
      if (p.orderId) await this.markPaid(p.orderId);
    });
    await this.jobs.work(QUEUES.FOOD_EXPIRE_UNPAID, () => this.expireUnpaid());
    await this.jobs.schedule(QUEUES.FOOD_EXPIRE_UNPAID, '*/5 * * * *');
  }

  async place(user: AuthUser, dto: PlaceOrderDto) {
    if (user.type !== 'STUDENT' && user.type !== 'STAFF') throw new ForbiddenException({ code: 'NOT_A_CUSTOMER', message: 'Food orders are for students and staff.' });
    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor || vendor.status !== 'APPROVED') throw new NotFoundException({ code: 'NOT_FOUND', message: 'This vendor is not taking orders.' });
    if (!isOpenAt(vendor.openingHours as OpeningHours, new Date(), vendor.paused)) {
      throw new ConflictException({ code: 'CLOSED', message: `${vendor.name} is not taking orders right now.` });
    }
    if (dto.fulfilment === 'DELIVERY' && !vendor.offersDelivery) throw new BadRequestException({ code: 'NO_DELIVERY', message: `${vendor.name} does not deliver.` });
    if (dto.fulfilment === 'PICKUP' && !vendor.offersPickup) throw new BadRequestException({ code: 'NO_PICKUP', message: `${vendor.name} only delivers.` });
    if (dto.fulfilment === 'DELIVERY' && !dto.deliveryAddress) throw new BadRequestException({ code: 'ADDRESS', message: 'Tell the vendor where to deliver.' });
    if (dto.paymentOption === 'ONLINE' && !vendor.acceptsOnline) throw new BadRequestException({ code: 'NO_ONLINE', message: `${vendor.name} does not take online payment.` });
    if (dto.paymentOption === 'ON_PICKUP' && !vendor.acceptsPayOnPickup) throw new BadRequestException({ code: 'PAY_ONLINE', message: `${vendor.name} needs payment online.` });

    const active = await this.prisma.foodOrder.count({ where: { customerId: user.id, status: { in: ['PENDING_PAYMENT', 'PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY'] } } });
    if (active >= MAX_ACTIVE_ORDERS) throw new ConflictException({ code: 'TOO_MANY', message: `You can have at most ${MAX_ACTIVE_ORDERS} orders on the go.` });

    const ids = [...new Set(dto.lines.map((l) => l.menuItemId))];
    const items = await this.prisma.menuItem.findMany({ where: { id: { in: ids }, vendorId: vendor.id } });
    const byId = new Map(items.map((i) => [i.id, i]));
    const soldOut = items.filter((i) => !i.isAvailable).map((i) => i.name);
    if (items.length !== ids.length) throw new BadRequestException({ code: 'STALE', message: 'The menu has changed. Refresh and try again.' });
    if (soldOut.length) throw new ConflictException({ code: 'SOLD_OUT', message: `Sold out: ${soldOut.join(', ')}.` });

    const lines = dto.lines.map((l) => ({ item: byId.get(l.menuItemId)!, quantity: l.quantity }));
    const totals = orderTotals(lines.map((l) => ({ price: l.item.price, quantity: l.quantity })), dto.fulfilment, vendor);
    if (totals.belowMinimum) throw new BadRequestException({ code: 'MINIMUM', message: `The minimum order is ${formatCedis(vendor.minimumOrder)}.` });
    const settings = await this.settings.get();
    const online = dto.paymentOption === 'ONLINE';

    const order = await this.prisma.foodOrder.create({
      data: {
        vendorId: vendor.id, customerId: user.id,
        status: online ? 'PENDING_PAYMENT' : 'PLACED',
        fulfilment: dto.fulfilment, deliveryAddress: dto.fulfilment === 'DELIVERY' ? dto.deliveryAddress : null, deliveryNote: dto.deliveryNote || null,
        paymentOption: dto.paymentOption, ...totals, commission: online ? commission(totals.total, settings.commissionPercent) : 0,
        pickupCode: String(randomInt(1000, 10000)), note: dto.note || null, placedAt: online ? null : new Date(),
        items: { create: lines.map((l) => ({ menuItemId: l.item.id, name: l.item.name, unitPrice: l.item.price, quantity: l.quantity, lineTotal: l.item.price * l.quantity })) },
      },
      select: { id: true, number: true, total: true },
    });
    await this.audit.record({ action: 'marketplace.order_placed', module: 'marketplace', targetType: 'FoodOrder', targetId: order.id, metadata: { number: order.number, vendor: vendor.name, total: order.total, payment: dto.paymentOption } });

    if (!online) {
      await this.notifyVendor(order.id);
      return { orderId: order.id, number: order.number };
    }
    const payment = await this.payments.start({ purpose: 'FOOD_ORDER', userId: user.id, orderId: order.id, amount: order.total, returnPath: `/food/orders/${order.id}`, description: `Order #${order.number} at ${vendor.name}` });
    return { orderId: order.id, number: order.number, paymentUrl: payment.authorizationUrl, provider: payment.provider };
  }

  /** Starts payment again for an order still waiting to be paid. */
  async retryPayment(user: AuthUser, id: string) {
    const order = await this.prisma.foodOrder.findFirst({ where: { id, customerId: user.id }, include: { vendor: { select: { name: true } } } });
    if (!order || order.status !== 'PENDING_PAYMENT') throw new ConflictException({ code: 'NOT_PENDING', message: 'This order is not waiting for payment.' });
    const payment = await this.payments.start({ purpose: 'FOOD_ORDER', userId: user.id, orderId: order.id, amount: order.total, returnPath: `/food/orders/${order.id}`, description: `Order #${order.number} at ${order.vendor.name}` });
    return { paymentUrl: payment.authorizationUrl };
  }

  /** Called once when an online payment succeeds. */
  private async markPaid(orderId: string) {
    const moved = await this.prisma.foodOrder.updateMany({ where: { id: orderId, status: 'PENDING_PAYMENT' }, data: { status: 'PLACED', paid: true, placedAt: new Date() } });
    if (moved.count === 1) {
      await this.notifyVendor(orderId);
      return;
    }
    // Paid after the order was cancelled for being unpaid: give the money back.
    const order = await this.prisma.foodOrder.findUnique({ where: { id: orderId }, include: { payments: { where: { status: 'SUCCEEDED' } } } });
    if (order?.status === 'CANCELLED') {
      for (const p of order.payments) await this.payments.refund(p.id, 'Paid after the order had expired');
      await this.notifyCustomer(orderId, 'payment received after the order expired', 'Your payment arrived after the order had been cancelled for not being paid in time, so it is being refunded.', 'Payment is being refunded.');
    }
  }

  async get(id: string) {
    const order = await this.prisma.foodOrder.findUnique({ where: { id }, select: ORDER_SELECT });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found.' });
    return order;
  }

  /**
   * Moves an order to a new status. Vendors must enter the customer's code to complete, and give a
   * reason to decline or cancel. Paid online orders that end cancelled or declined are refunded.
   */
  async move(id: string, to: OrderStatus, actor: OrderActor, opts: { reason?: string; code?: string; byUser?: AuthUser } = {}) {
    const order = await this.get(id);
    if (!canTransition(order.status, to, actor, order.fulfilment)) {
      throw new ConflictException({ code: 'NOT_ALLOWED', message: `An order that is ${order.status.toLowerCase().replace(/_/g, ' ')} cannot be moved to ${to.toLowerCase().replace(/_/g, ' ')}.` });
    }
    if ((to === 'REJECTED' || (to === 'CANCELLED' && actor === 'VENDOR')) && !opts.reason) {
      throw new BadRequestException({ code: 'REASON', message: 'Tell the customer why.' });
    }
    if (to === 'COMPLETED' && opts.code !== order.pickupCode) {
      throw new BadRequestException({ code: 'WRONG_CODE', message: "That is not the customer's code. Ask them to show the code on their order." });
    }
    const now = new Date();
    const vendor = await this.prisma.vendor.findUniqueOrThrow({ where: { id: order.vendor.id }, select: { prepMinutes: true } });
    const data: Prisma.FoodOrderUpdateManyMutationInput = { status: to };
    if (to === 'ACCEPTED') Object.assign(data, { acceptedAt: now, estimatedReadyAt: new Date(now.getTime() + vendor.prepMinutes * 60_000) });
    if (to === 'READY' || to === 'OUT_FOR_DELIVERY') data.readyAt = now;
    if (to === 'COMPLETED') Object.assign(data, { completedAt: now, paid: true });
    if (to === 'CANCELLED' || to === 'REJECTED') Object.assign(data, { cancelledAt: now, cancelledBy: actor, cancelReason: opts.reason ?? null });

    const moved = await this.prisma.foodOrder.updateMany({ where: { id, status: order.status }, data });
    if (moved.count !== 1) throw new ConflictException({ code: 'CHANGED', message: 'This order was just updated. Refresh.' });
    await this.audit.record({
      action: `marketplace.order_${to.toLowerCase()}`,
      module: 'marketplace',
      targetType: 'FoodOrder',
      targetId: id,
      metadata: { number: order.number, from: order.status, reason: opts.reason },
      ...(actor === 'SYSTEM' ? { actor: { id: order.customer.id, label: 'System', roleKey: null } } : {}),
    });

    let refundNote = '';
    if ((to === 'CANCELLED' || to === 'REJECTED') && order.paymentOption === 'ONLINE' && order.paid) {
      const payment = await this.prisma.payment.findFirst({ where: { orderId: id, status: 'SUCCEEDED' } });
      if (payment) {
        const r = await this.payments.refund(payment.id, opts.reason ?? to);
        refundNote = r === 'FAILED_TO_REFUND' ? ' Your refund needs attention from the Finance Office, who have been alerted.' : ` Your payment of ${formatCedis(order.total)} is being refunded to where you paid from.`;
      }
    }

    const minutes = vendor.prepMinutes;
    const messages: Partial<Record<OrderStatus, [string, string, string | null]>> = {
      ACCEPTED: ['accepted', `The vendor is preparing it. About ${minutes} minutes.`, null],
      READY: ['ready to collect', `Collect it at ${order.vendor.location}. Show your code ${order.pickupCode}.`, `Collect at ${order.vendor.location}. Code ${order.pickupCode}.`],
      OUT_FOR_DELIVERY: ['on the way', `It is being delivered to ${order.deliveryAddress}. Give your code ${order.pickupCode} to the person delivering.`, `Your code is ${order.pickupCode}.`],
      REJECTED: ['declined', `Reason: ${opts.reason}.${refundNote}`, `Reason: ${opts.reason}.${refundNote ? ' Refund on its way.' : ''}`],
      CANCELLED: actor === 'VENDOR' ? ['cancelled by the vendor', `Reason: ${opts.reason}.${refundNote}`, `Reason: ${opts.reason}.${refundNote ? ' Refund on its way.' : ''}`] : actor === 'SYSTEM' ? ['cancelled', 'It was not paid in time.', null] : undefined,
    };
    const m = messages[to];
    if (m) await this.notifyCustomer(id, m[0], m[1], m[2]);
    return this.get(id);
  }

  /** Runs every 5 minutes: orders left unpaid too long are cancelled so they do not clutter anyone's list. */
  async expireUnpaid() {
    const { unpaidMinutes } = await this.settings.get();
    const stale = await this.prisma.foodOrder.findMany({ where: { status: 'PENDING_PAYMENT', createdAt: { lt: new Date(Date.now() - unpaidMinutes * 60_000) } }, select: { id: true } });
    for (const o of stale) {
      try {
        // One last check with the provider in case the payment went through but its notice was missed.
        const pending = await this.prisma.payment.findMany({ where: { orderId: o.id, status: 'PENDING' }, select: { reference: true } });
        for (const p of pending) await this.payments.confirm(p.reference).catch(() => undefined);
        const fresh = await this.prisma.foodOrder.findUnique({ where: { id: o.id }, select: { status: true } });
        if (fresh?.status !== 'PENDING_PAYMENT') continue;
        await this.prisma.payment.updateMany({ where: { orderId: o.id, status: 'PENDING' }, data: { status: 'FAILED' } });
        await this.move(o.id, 'CANCELLED', 'SYSTEM', { reason: 'Not paid in time' });
      } catch (err) {
        this.logger.error(`Could not expire order ${o.id}: ${(err as Error).message}`);
      }
    }
  }

  private async notifyVendor(orderId: string) {
    const o = await this.get(orderId);
    const owner = await this.prisma.vendor.findUniqueOrThrow({ where: { id: o.vendor.id }, select: { ownerId: true } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.FOOD_ORDER_NEW,
      recipients: [{ userId: owner.ownerId }],
      channels: ['IN_APP'],
      sharedVars: {
        number: o.number, customer: `${o.customer.firstName} ${o.customer.lastName}`,
        summary: o.items.map((i) => `${i.quantity} x ${i.name}`).join(', '),
        fulfilment: o.fulfilment === 'DELIVERY' ? `Deliver to ${o.deliveryAddress}` : 'Pickup',
        total: formatCedis(o.total), payment: o.paymentOption === 'ONLINE' ? 'paid online' : 'pay at the counter',
      },
      link: '/vendor',
    });
  }

  private async notifyCustomer(orderId: string, headline: string, detail: string, smsDetail: string | null) {
    const o = await this.get(orderId);
    const channels: Channel[] = smsDetail ? ['IN_APP', 'SMS'] : ['IN_APP'];
    await this.notifications.notify({
      eventKey: EVENT_KEYS.FOOD_ORDER_UPDATE,
      recipients: [{ userId: o.customer.id }],
      channels,
      sharedVars: { number: o.number, vendor: o.vendor.name, headline, detail, smsDetail: smsDetail ?? '', orderId: o.id },
      link: `/food/orders/${o.id}`,
    });
  }
}

export type { OrderRow };
