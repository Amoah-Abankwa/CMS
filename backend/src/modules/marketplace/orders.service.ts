import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  canTransition,
  commission,
  deliveryArea,
  dispatchFeeSettlement,
  mealCredit,
  scheduleProblem,
  formatCedis,
  isOpenAt,
  orderTotals,
  type OpeningHours,
  type OrderActor,
  type OrderStatus,
} from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService, type Channel } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PaymentsService } from '../payments/payments.service';
import { MarketplaceSettingsService } from './marketplace-settings.service';
import { EmploymentRulesService } from '../employment/employment-rules.service';
import { PlaceOrderDto } from './dto/marketplace.dto';

const MAX_ACTIVE_ORDERS = 3;

export const ORDER_SELECT = {
  id: true,
  number: true,
  status: true,
  fulfilment: true,
  viaDispatcher: true,
  scheduledFor: true,
  mealCredit: true,
  mealPlanPurchaseId: true,
  rating: {
    select: {
      vendorStars: true,
      dispatcherStars: true,
      vendorComment: true,
    },
  },
  dispatchFeeMode: true,
  paidVia: true,
  paidReference: true,
  deliveryAddress: true,
  deliveryNote: true,
  paymentOption: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  pickupCode: true,
  note: true,
  paid: true,
  placedAt: true,
  acceptedAt: true,
  readyAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelledBy: true,
  cancelReason: true,
  estimatedReadyAt: true,
  createdAt: true,
  vendor: {
    select: {
      id: true,
      name: true,
      location: true,
      phone: true,
    },
  },
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      indexNumber: true,
      phone: true,
    },
  },
  items: {
    select: {
      name: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
  },
  payments: {
    orderBy: {
      createdAt: 'desc' as const,
    },
    take: 1,
    select: {
      reference: true,
      status: true,
      provider: true,
      channel: true,
    },
  },
  delivery: {
    select: {
      id: true,
      status: true,
      fee: true,
      feeSettlement: true,
      dispatcherId: true,
      problemNote: true,
      dispatcher: {
        select: {
          transport: true,
          lastLat: true,
          lastLng: true,
          lastAccuracy: true,
          lastLocationAt: true,
          student: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.FoodOrderSelect;

type OrderRow = Prisma.FoodOrderGetPayload<{
  select: typeof ORDER_SELECT;
}>;

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
    private readonly employment: EmploymentRulesService,
  ) {}

  async onModuleInit() {
    // Meal plans: paid online, then usable for the plan's number of days.
    this.payments.onSucceeded('MEAL_PLAN', async (p) => {
      if (!p.subjectId) return;

      const m = await this.prisma.mealPlanPurchase.findUnique({
        where: { id: p.subjectId },
        include: { plan: true },
      });

      if (!m || m.status !== 'PENDING_PAYMENT') return;

      await this.prisma.mealPlanPurchase.update({
        where: { id: m.id },
        data: {
          status: 'ACTIVE',
          paidAt: new Date(),
          expiresAt: new Date(
            Date.now() + m.plan.validDays * 86_400_000,
          ),
        },
      });

      await this.audit.record({
        action: 'marketplace.meal_plan_bought',
        module: 'marketplace',
        targetType: 'MealPlanPurchase',
        targetId: m.id,
        actor: {
          id: m.customerId,
          label: 'Online payment',
          roleKey: null,
        },
        metadata: {
          plan: m.plan.name,
          price: m.price,
        },
      });
    });

    this.payments.onSucceeded('FOOD_ORDER', async (p) => {
      if (p.orderId) {
        await this.markOnlinePaymentPaid(p.orderId);
      }
    });

    await this.jobs.work(
      QUEUES.FOOD_EXPIRE_UNPAID,
      async () => {
        await this.expireUnpaid();
      },
    );

    await this.jobs.schedule(
      QUEUES.FOOD_EXPIRE_UNPAID,
      '*/5 * * * *',
    );
  }

  async place(user: AuthUser, dto: PlaceOrderDto) {
    if (user.type !== 'STUDENT' && user.type !== 'STAFF') {
      throw new ForbiddenException({
        code: 'NOT_A_CUSTOMER',
        message: 'Food orders are for students and staff.',
      });
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: dto.vendorId },
    });

    if (!vendor || vendor.status !== 'APPROVED') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'This vendor is not taking orders.',
      });
    }

    // Scheduled orders need the vendor open at the chosen time; others need it open now.
    const scheduledFor = dto.scheduledFor
      ? new Date(dto.scheduledFor)
      : null;

    if (scheduledFor) {
      const problem = scheduleProblem(
        scheduledFor,
        new Date(),
        vendor.prepMinutes,
        vendor.openingHours as OpeningHours,
      );

      if (problem) {
        throw new BadRequestException({
          code: 'SCHEDULE',
          message: problem,
        });
      }
    } else if (
      !isOpenAt(
        vendor.openingHours as OpeningHours,
        new Date(),
        vendor.paused,
      )
    ) {
      throw new ConflictException({
        code: 'CLOSED',
        message: `${vendor.name} is not taking orders right now. You can schedule one for later.`,
      });
    }

    if (
      dto.fulfilment === 'DELIVERY' &&
      !vendor.offersDelivery
    ) {
      throw new BadRequestException({
        code: 'NO_DELIVERY',
        message: `${vendor.name} does not deliver.`,
      });
    }

    if (
      dto.fulfilment === 'PICKUP' &&
      !vendor.offersPickup
    ) {
      throw new BadRequestException({
        code: 'NO_PICKUP',
        message: `${vendor.name} only delivers.`,
      });
    }

    if (
      dto.fulfilment === 'DELIVERY' &&
      !dto.deliveryAddress
    ) {
      throw new BadRequestException({
        code: 'ADDRESS',
        message: 'Tell the vendor where to deliver.',
      });
    }

    if (
      dto.paymentOption === 'ONLINE' &&
      !vendor.acceptsOnline
    ) {
      throw new BadRequestException({
        code: 'NO_ONLINE',
        message: `${vendor.name} does not take online payment.`,
      });
    }

    // Campus dispatcher deliveries: the customer pays the dispatcher's fee, in the payment or on delivery.
    const viaDispatcher =
      dto.fulfilment === 'DELIVERY' &&
      vendor.useDispatchers;

    const dispatchFeeMode = viaDispatcher
      ? dto.dispatchFeeMode ?? 'INCLUDED'
      : null;

    if (
      dto.paymentOption === 'ON_PICKUP' &&
      !vendor.acceptsPayOnPickup
    ) {
      throw new BadRequestException({
        code: 'PAY_ONLINE',
        message: `${vendor.name} needs payment online.`,
      });
    }

    const active = await this.prisma.foodOrder.count({
      where: {
        customerId: user.id,
        status: {
          in: [
            'PENDING_PAYMENT',
            'PLACED',
            'ACCEPTED',
            'READY',
            'OUT_FOR_DELIVERY',
          ],
        },
      },
    });

    if (active >= MAX_ACTIVE_ORDERS) {
      throw new ConflictException({
        code: 'TOO_MANY',
        message: `You can have at most ${MAX_ACTIVE_ORDERS} orders on the go.`,
      });
    }

    const ids = [
      ...new Set(dto.lines.map((l) => l.menuItemId)),
    ];

    const items = await this.prisma.menuItem.findMany({
      where: {
        id: { in: ids },
        vendorId: vendor.id,
      },
    });

    const byId = new Map(items.map((i) => [i.id, i]));

    const soldOut = items
      .filter((i) => !i.isAvailable)
      .map((i) => i.name);

    if (items.length !== ids.length) {
      throw new BadRequestException({
        code: 'STALE',
        message: 'The menu has changed. Refresh and try again.',
      });
    }

    if (soldOut.length) {
      throw new ConflictException({
        code: 'SOLD_OUT',
        message: `Sold out: ${soldOut.join(', ')}.`,
      });
    }

    const lines = dto.lines.map((l) => ({
      item: byId.get(l.menuItemId)!,
      quantity: l.quantity,
    }));

    const base = orderTotals(
      lines.map((l) => ({
        price: l.item.price,
        quantity: l.quantity,
      })),
      dto.fulfilment,
      vendor,
    );

    const dispatchFee = viaDispatcher
      ? (await this.employment.get()).dispatchFee
      : 0;

    // deliveryFee records the dispatcher's fee; the total includes it only when the customer pays it now.
    const totals = viaDispatcher
      ? {
          subtotal: base.subtotal,
          deliveryFee: dispatchFee,
          total:
            base.subtotal +
            (dispatchFeeMode === 'INCLUDED'
              ? dispatchFee
              : 0),
          belowMinimum: base.belowMinimum,
        }
      : base;

    if (totals.belowMinimum) {
      throw new BadRequestException({
        code: 'MINIMUM',
        message: `The minimum order is ${formatCedis(vendor.minimumOrder)}.`,
      });
    }

    const settings = await this.settings.get();

    // One meal from a meal plan covers the dearest eligible dish; taken atomically so it cannot be used twice.
    let credit = 0;

    if (dto.mealPlanPurchaseId) {
      const plan =
        await this.prisma.mealPlanPurchase.findUnique({
          where: { id: dto.mealPlanPurchaseId },
          include: { plan: true },
        });

      if (
        !plan ||
        plan.customerId !== user.id ||
        plan.plan.vendorId !== vendor.id ||
        plan.status !== 'ACTIVE' ||
        !plan.expiresAt ||
        plan.expiresAt < new Date()
      ) {
        throw new BadRequestException({
          code: 'MEAL_PLAN',
          message: 'That meal plan cannot be used here.',
        });
      }

      const c = mealCredit(
        lines.map((l) => ({
          menuItemId: l.item.id,
          price: l.item.price,
        })),
        plan.plan.eligibleItemIds,
      );

      if (!c) {
        throw new BadRequestException({
          code: 'MEAL_PLAN',
          message:
            'None of these dishes is on your meal plan.',
        });
      }

      const took =
        await this.prisma.mealPlanPurchase.updateMany({
          where: {
            id: plan.id,
            status: 'ACTIVE',
            mealsLeft: { gt: 0 },
          },
          data: {
            mealsLeft: { decrement: 1 },
          },
        });

      if (took.count !== 1) {
        throw new ConflictException({
          code: 'NO_MEALS',
          message: 'Your meal plan has no meals left.',
        });
      }

      await this.prisma.mealPlanPurchase.updateMany({
        where: {
          id: plan.id,
          mealsLeft: 0,
        },
        data: {
          status: 'USED_UP',
        },
      });

      credit = Math.min(c.amount, totals.total);
    }

    const payable = totals.total - credit;
    const online =
      dto.paymentOption === 'ONLINE' && payable > 0;

    const order = await this.prisma.foodOrder.create({
      data: {
        vendorId: vendor.id,
        customerId: user.id,
        status: online ? 'PENDING_PAYMENT' : 'PLACED',
        fulfilment: dto.fulfilment,
        viaDispatcher,
        dispatchFeeMode,
        deliveryAddress:
          dto.fulfilment === 'DELIVERY'
            ? dto.deliveryAddress
            : null,
        deliveryNote: dto.deliveryNote || null,
        paymentOption: dto.paymentOption,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        total: payable,
        commission: online
          ? commission(
              Math.max(
                0,
                (viaDispatcher
                  ? totals.subtotal
                  : totals.total) - credit,
              ),
              settings.commissionPercent,
            )
          : 0,
        scheduledFor,
        mealPlanPurchaseId: credit
          ? dto.mealPlanPurchaseId
          : null,
        mealCredit: credit,
        paid: payable === 0,
        pickupCode: String(randomInt(1000, 10000)),
        note: dto.note || null,
        placedAt: online ? null : new Date(),
        items: {
          create: lines.map((l) => ({
            menuItemId: l.item.id,
            name: l.item.name,
            unitPrice: l.item.price,
            quantity: l.quantity,
            lineTotal: l.item.price * l.quantity,
          })),
        },
      },
      select: {
        id: true,
        number: true,
        total: true,
      },
    });

    await this.audit.record({
      action: 'marketplace.order_placed',
      module: 'marketplace',
      targetType: 'FoodOrder',
      targetId: order.id,
      metadata: {
        number: order.number,
        vendor: vendor.name,
        total: order.total,
        payment: dto.paymentOption,
      },
    });

    if (!online) {
      await this.notifyVendor(order.id);
      return {
        orderId: order.id,
        number: order.number,
      };
    }

    const payment = await this.payments.start({
      purpose: 'FOOD_ORDER',
      userId: user.id,
      orderId: order.id,
      amount: order.total,
      returnPath: `/food/orders/${order.id}`,
      description: `Order #${order.number} at ${vendor.name}`,
    });

    return {
      orderId: order.id,
      number: order.number,
      paymentUrl: payment.authorizationUrl,
      provider: payment.provider,
    };
  }

  /** Starts payment again for an order still waiting to be paid. */
  async retryPayment(user: AuthUser, id: string) {
    const order = await this.prisma.foodOrder.findFirst({
      where: {
        id,
        customerId: user.id,
      },
      include: {
        vendor: {
          select: {
            name: true,
          },
        },
      },
    });

    if (
      !order ||
      order.status !== 'PENDING_PAYMENT'
    ) {
      throw new ConflictException({
        code: 'NOT_PENDING',
        message:
          'This order is not waiting for payment.',
      });
    }

    const payment = await this.payments.start({
      purpose: 'FOOD_ORDER',
      userId: user.id,
      orderId: order.id,
      amount: order.total,
      returnPath: `/food/orders/${order.id}`,
      description: `Order #${order.number} at ${order.vendor.name}`,
    });

    return {
      paymentUrl: payment.authorizationUrl,
    };
  }

  /** Called once when an online payment succeeds. */
  private async markOnlinePaymentPaid(orderId: string) {
    const moved = await this.prisma.foodOrder.updateMany({
      where: {
        id: orderId,
        status: 'PENDING_PAYMENT',
      },
      data: {
        status: 'PLACED',
        paid: true,
        placedAt: new Date(),
      },
    });

    if (moved.count === 1) {
      await this.notifyVendor(orderId);
      return;
    }

    // Paid after the order was cancelled for being unpaid: give the money back.
    const order = await this.prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: 'SUCCEEDED',
          },
        },
      },
    });

    if (order?.status === 'CANCELLED') {
      for (const p of order.payments) {
        await this.payments.refund(
          p.id,
          'Paid after the order had expired',
        );
      }

      await this.notifyCustomer(
        orderId,
        'payment received after the order expired',
        'Your payment arrived after the order had been cancelled for not being paid in time, so it is being refunded.',
        'Payment is being refunded.',
      );
    }
  }

  async get(id: string) {
    const order = await this.prisma.foodOrder.findUnique({
      where: { id },
      select: ORDER_SELECT,
    });

    if (!order) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Order not found.',
      });
    }

    return order;
  }

  /**
   * Moves an order to a new status. Vendors must enter the customer's code to complete, and give a
   * reason to decline or cancel. Paid online orders that end cancelled or declined are refunded.
   */
  async move(
    id: string,
    to: OrderStatus,
    actor: OrderActor,
    opts: {
      reason?: string;
      code?: string;
      byUser?: AuthUser;
      dispatcherId?: string;
    } = {},
  ) {
    const order = await this.get(id);

    if (
      !canTransition(
        order.status,
        to,
        actor,
        order.fulfilment,
        order.viaDispatcher,
      )
    ) {
      throw new ConflictException({
        code: 'NOT_ALLOWED',
        message: `An order that is ${order.status
          .toLowerCase()
          .replace(/_/g, ' ')} cannot be moved to ${to
          .toLowerCase()
          .replace(/_/g, ' ')}.`,
      });
    }

    if (
      (to === 'REJECTED' ||
        (to === 'CANCELLED' && actor === 'VENDOR')) &&
      !opts.reason
    ) {
      throw new BadRequestException({
        code: 'REASON',
        message: 'Tell the customer why.',
      });
    }

    if (
      to === 'COMPLETED' &&
      opts.code !== order.pickupCode
    ) {
      throw new BadRequestException({
        code: 'WRONG_CODE',
        message:
          "That is not the customer's code. Ask them to show the code on their order.",
      });
    }

    const delivery = order.delivery;

    if (
      order.viaDispatcher &&
      actor === 'VENDOR' &&
      to === 'COMPLETED' &&
      delivery &&
      delivery.status !== 'CANCELLED'
    ) {
      throw new ConflictException({
        code: 'DISPATCHER_COMPLETES',
        message:
          "The dispatcher completes this order with the customer's code.",
      });
    }

    if (actor === 'DISPATCHER') {
      const expected =
        to === 'OUT_FOR_DELIVERY'
          ? 'ASSIGNED'
          : 'PICKED_UP';

      if (
        !delivery ||
        delivery.dispatcherId !== opts.dispatcherId ||
        delivery.status !== expected
      ) {
        throw new ForbiddenException({
          code: 'NOT_YOURS',
          message: 'This delivery is not with you.',
        });
      }
    }

    // The vendor sends out a dispatched order with their own staff: only while no dispatcher has taken it.
    if (
      order.viaDispatcher &&
      actor === 'VENDOR' &&
      to === 'OUT_FOR_DELIVERY'
    ) {
      const taken = await this.prisma.delivery.updateMany({
        where: {
          orderId: id,
          status: 'WAITING',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          problemNote: 'Delivered by the vendor',
        },
      });

      if (taken.count !== 1) {
        throw new ConflictException({
          code: 'TAKEN',
          message:
            'A dispatcher has just taken this order.',
        });
      }
    }

    const now = new Date();

    const vendor =
      await this.prisma.vendor.findUniqueOrThrow({
        where: {
          id: order.vendor.id,
        },
        select: {
          prepMinutes: true,
        },
      });

    const data: Prisma.FoodOrderUpdateManyMutationInput = {
      status: to,
    };

    if (to === 'ACCEPTED') {
      Object.assign(data, {
        acceptedAt: now,
        estimatedReadyAt: new Date(
          now.getTime() +
            vendor.prepMinutes * 60_000,
        ),
      });
    }

    if (to === 'READY' || to === 'OUT_FOR_DELIVERY') {
      data.readyAt = now;
    }

    if (to === 'COMPLETED') {
      Object.assign(data, {
        completedAt: now,
        paid: true,
      });
    }

    if (to === 'CANCELLED' || to === 'REJECTED') {
      Object.assign(data, {
        cancelledAt: now,
        cancelledBy: actor,
        cancelReason: opts.reason ?? null,
      });
    }

    const moved = await this.prisma.foodOrder.updateMany({
      where: {
        id,
        status: order.status,
      },
      data,
    });

    if (moved.count !== 1) {
      throw new ConflictException({
        code: 'CHANGED',
        message:
          'This order was just updated. Refresh.',
      });
    }

    await this.syncDelivery(
      order,
      to,
      actor,
      opts.dispatcherId,
    );

    await this.audit.record({
      action: `marketplace.order_${to.toLowerCase()}`,
      module: 'marketplace',
      targetType: 'FoodOrder',
      targetId: id,
      metadata: {
        number: order.number,
        from: order.status,
        reason: opts.reason,
      },
      ...(actor === 'SYSTEM'
        ? {
            actor: {
              id: order.customer.id,
              label: 'System',
              roleKey: null,
            },
          }
        : {}),
    });

    let refundNote = '';

    // A meal plan meal comes back if the order does not go ahead.
    if (
      (to === 'CANCELLED' || to === 'REJECTED') &&
      order.mealPlanPurchaseId
    ) {
      await this.prisma.mealPlanPurchase
        .update({
          where: {
            id: order.mealPlanPurchaseId,
          },
          data: {
            mealsLeft: {
              increment: 1,
            },
            status: 'ACTIVE',
          },
        })
        .catch(() => undefined);
    }

    if (
      (to === 'CANCELLED' || to === 'REJECTED') &&
      order.paymentOption === 'ONLINE' &&
      order.paid &&
      order.total > 0
    ) {
      const payment =
        await this.prisma.payment.findFirst({
          where: {
            orderId: id,
            status: 'SUCCEEDED',
          },
        });

      if (payment) {
        const r = await this.payments.refund(
          payment.id,
          opts.reason ?? to,
        );

        refundNote =
          r === 'FAILED_TO_REFUND'
            ? ' Your refund needs attention from the Finance Office, who have been alerted.'
            : ` Your payment of ${formatCedis(order.total)} is being refunded to where you paid from.`;
      }
    }

    const minutes = vendor.prepMinutes;
    const rider = order.delivery?.dispatcher?.student;

    const messages: Partial<
      Record<
        OrderStatus,
        [string, string, string | null]
      >
    > = {
      ...(order.viaDispatcher && to === 'READY'
        ? {
            READY: [
              'ready, a campus dispatcher will bring it',
              'We will tell you when it is on the way.',
              null,
            ] as [string, string, null],
          }
        : {}),

      ...(actor === 'DISPATCHER' &&
      to === 'OUT_FOR_DELIVERY' &&
      rider
        ? {
            OUT_FOR_DELIVERY: [
              'on the way',
              `${rider.firstName} (${rider.phone ?? 'campus dispatcher'}) is bringing it to ${order.deliveryAddress}. Give them your code ${order.pickupCode}.`,
              `${rider.firstName} is bringing it. Your code is ${order.pickupCode}.`,
            ] as [string, string, string],
          }
        : {}),

      ACCEPTED: [
        'accepted',
        `The vendor is preparing it. About ${minutes} minutes.`,
        null,
      ],

      ...(order.viaDispatcher
        ? {}
        : {
            READY: [
              'ready to collect',
              `Collect it at ${order.vendor.location}. Show your code ${order.pickupCode}.`,
              `Collect at ${order.vendor.location}. Code ${order.pickupCode}.`,
            ] as [string, string, string],
          }),

      ...(actor === 'DISPATCHER'
        ? {}
        : {
            OUT_FOR_DELIVERY: [
              'on the way',
              `It is being delivered to ${order.deliveryAddress}. Give your code ${order.pickupCode} to the person delivering.`,
              `Your code is ${order.pickupCode}.`,
            ] as [string, string, string],
          }),

      REJECTED: [
        'declined',
        `Reason: ${opts.reason}.${refundNote}`,
        `Reason: ${opts.reason}.${refundNote ? ' Refund on its way.' : ''}`,
      ],

      CANCELLED:
        actor === 'VENDOR'
          ? [
              'cancelled by the vendor',
              `Reason: ${opts.reason}.${refundNote}`,
              `Reason: ${opts.reason}.${refundNote ? ' Refund on its way.' : ''}`,
            ]
          : actor === 'SYSTEM'
            ? [
                'cancelled',
                'It was not paid in time.',
                null,
              ]
            : undefined,
    };

    const m = messages[to];

    if (m) {
      await this.notifyCustomer(
        id,
        m[0],
        m[1],
        m[2],
      );
    }

    return this.get(id);
  }

  /** Keeps the dispatcher's delivery record in step with the order. */
  private async syncDelivery(
    order: OrderRow,
    to: OrderStatus,
    actor: OrderActor,
    dispatcherId?: string,
  ) {
    if (!order.viaDispatcher) return;

    const now = new Date();

    if (to === 'READY') {
      const feeSettlement = dispatchFeeSettlement(
        order.dispatchFeeMode ?? 'INCLUDED',
        order.paymentOption,
      );

      await this.prisma.delivery.upsert({
        where: {
          orderId: order.id,
        },
        create: {
          orderId: order.id,
          fee: order.deliveryFee,
          feeSettlement,
        },
        update: {},
      });

      await this.offerToDispatchers(order.id);
    }

    if (
      actor === 'DISPATCHER' &&
      to === 'OUT_FOR_DELIVERY'
    ) {
      await this.prisma.delivery.updateMany({
        where: {
          orderId: order.id,
          dispatcherId,
          status: 'ASSIGNED',
        },
        data: {
          status: 'PICKED_UP',
          pickedUpAt: now,
        },
      });
    }

    if (
      actor === 'DISPATCHER' &&
      to === 'COMPLETED'
    ) {
      await this.prisma.delivery.updateMany({
        where: {
          orderId: order.id,
          dispatcherId,
          status: 'PICKED_UP',
        },
        data: {
          status: 'DELIVERED',
          deliveredAt: now,
        },
      });
    }

    if (
      to === 'CANCELLED' ||
      to === 'REJECTED'
    ) {
      const d = order.delivery;

      await this.prisma.delivery.updateMany({
        where: {
          orderId: order.id,
          status: {
            in: [
              'WAITING',
              'ASSIGNED',
              'PICKED_UP',
            ],
          },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
      });

      if (
        d?.dispatcherId &&
        (d.status === 'ASSIGNED' ||
          d.status === 'PICKED_UP')
      ) {
        const p =
          await this.prisma.dispatcherProfile.findUnique(
            {
              where: {
                id: d.dispatcherId,
              },
              select: {
                studentId: true,
              },
            },
          );

        if (p) {
          await this.notifications.notify({
            eventKey: EVENT_KEYS.DELIVERY_UPDATE,
            recipients: [
              {
                userId: p.studentId,
              },
            ],
            channels: ['IN_APP', 'SMS'],
            sharedVars: {
              number: order.number,
              headline:
                'cancelled by the vendor',
              detail:
                d.status === 'PICKED_UP'
                  ? `Take the food back to ${order.vendor.name}.`
                  : 'You do not need to collect it.',
              link: '/dispatch',
            },
            link: '/dispatch',
          });
        }
      }
    }
  }

  /** Tells dispatchers who are online that a delivery is waiting. The first to take it gets it. */
  async offerToDispatchers(orderId: string) {
    const o =
      await this.prisma.foodOrder.findUnique({
        where: {
          id: orderId,
        },
        select: {
          customerId: true,
          deliveryAddress: true,
          vendor: {
            select: {
              name: true,
            },
          },
          delivery: {
            select: {
              fee: true,
              status: true,
            },
          },
        },
      });

    if (
      !o?.delivery ||
      o.delivery.status !== 'WAITING'
    ) {
      return;
    }

    const online =
      await this.prisma.dispatcherProfile.findMany({
        where: {
          status: 'ACTIVE',
          online: true,
          studentId: {
            not: o.customerId,
          },
        },
        select: {
          studentId: true,
        },
        take: 100,
      });

    if (!online.length) return;

    await this.notifications.notify({
      eventKey: EVENT_KEYS.DELIVERY_AVAILABLE,
      recipients: online.map((d) => ({
        userId: d.studentId,
      })),
      channels: ['IN_APP'],
      sharedVars: {
        vendor: o.vendor.name,
        area: deliveryArea(o.deliveryAddress),
        fee: formatCedis(o.delivery.fee),
      },
      link: '/dispatch',
    });
  }

  /** Runs every 5 minutes: orders left unpaid too long are cancelled so they do not clutter anyone's list. */
  async expireUnpaid() {
    const { unpaidMinutes } =
      await this.settings.get();

    await this.prisma.mealPlanPurchase.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    await this.prisma.mealPlanPurchase.updateMany({
      where: {
        status: 'PENDING_PAYMENT',
        createdAt: {
          lt: new Date(
            Date.now() -
              unpaidMinutes * 60_000,
          ),
        },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    const stale =
      await this.prisma.foodOrder.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: {
            lt: new Date(
              Date.now() -
                unpaidMinutes * 60_000,
            ),
          },
        },
        select: {
          id: true,
        },
      });

    for (const o of stale) {
      try {
        // One last check with the provider in case the payment went through but its notice was missed.
        const pending =
          await this.prisma.payment.findMany({
            where: {
              orderId: o.id,
              status: 'PENDING',
            },
            select: {
              reference: true,
            },
          });

        for (const p of pending) {
          await this.payments
            .confirm(p.reference)
            .catch(() => undefined);
        }

        const fresh =
          await this.prisma.foodOrder.findUnique({
            where: {
              id: o.id,
            },
            select: {
              status: true,
            },
          });

        if (
          fresh?.status !== 'PENDING_PAYMENT'
        ) {
          continue;
        }

        await this.prisma.payment.updateMany({
          where: {
            orderId: o.id,
            status: 'PENDING',
          },
          data: {
            status: 'FAILED',
          },
        });

        await this.move(
          o.id,
          'CANCELLED',
          'SYSTEM',
          {
            reason: 'Not paid in time',
          },
        );
      } catch (err) {
        this.logger.error(
          `Could not expire order ${o.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async notifyVendor(orderId: string) {
    const o = await this.get(orderId);

    const owner =
      await this.prisma.vendor.findUniqueOrThrow({
        where: {
          id: o.vendor.id,
        },
        select: {
          ownerId: true,
        },
      });

    await this.notifications.notify({
      eventKey: EVENT_KEYS.FOOD_ORDER_NEW,
      recipients: [
        {
          userId: owner.ownerId,
        },
      ],
      channels: ['IN_APP'],
      sharedVars: {
        number: o.number,
        customer: `${o.customer.firstName} ${o.customer.lastName}`,
        summary: o.items
          .map(
            (i) =>
              `${i.quantity} x ${i.name}`,
          )
          .join(', '),
        fulfilment:
          o.fulfilment === 'DELIVERY'
            ? `Deliver to ${o.deliveryAddress}`
            : 'Pickup',
        total: formatCedis(o.total),
        payment:
          o.paymentOption === 'ONLINE'
            ? 'paid online'
            : 'pay at the counter',
      },
      link: '/vendor',
    });
  }

  private async notifyCustomer(
    orderId: string,
    headline: string,
    detail: string,
    smsDetail: string | null,
  ) {
    const o = await this.get(orderId);

    const channels: Channel[] = smsDetail
      ? ['IN_APP', 'SMS']
      : ['IN_APP'];

    await this.notifications.notify({
      eventKey: EVENT_KEYS.FOOD_ORDER_UPDATE,
      recipients: [
        {
          userId: o.customer.id,
        },
      ],
      channels,
      sharedVars: {
        number: o.number,
        vendor: o.vendor.name,
        headline,
        detail,
        smsDetail: smsDetail ?? '',
        orderId: o.id,
      },
      link: `/food/orders/${o.id}`,
    });
  }

  /** A pay-the-vendor order paid by cash or MoMo: the vendor ticks it paid, with the MoMo transaction ID. */
  async markPaid(
    orderId: string,
    vendorId: string,
    via: 'CASH' | 'MOMO',
    reference?: string,
  ) {
    const o = await this.get(orderId);

    if (o.vendor.id !== vendorId) {
      throw new ForbiddenException({
        code: 'NOT_YOURS',
        message: 'This is not one of your orders.',
      });
    }

    if (o.paymentOption !== 'ON_PICKUP') {
      throw new ConflictException({
        code: 'ONLINE',
        message:
          'Online orders are marked paid by Paystack.',
      });
    }

    if (o.paid) {
      throw new ConflictException({
        code: 'PAID',
        message: 'Already marked paid.',
      });
    }

    if (
      o.status === 'CANCELLED' ||
      o.status === 'REJECTED'
    ) {
      throw new ConflictException({
        code: 'ENDED',
        message: 'This order was cancelled.',
      });
    }

    await this.prisma.foodOrder.update({
      where: {
        id: orderId,
      },
      data: {
        paid: true,
        paidVia: via,
        paidReference: reference || null,
        paidMarkedAt: new Date(),
      },
    });

    await this.audit.record({
      action: 'marketplace.order_marked_paid',
      module: 'marketplace',
      targetType: 'FoodOrder',
      targetId: orderId,
      metadata: {
        number: o.number,
        via,
        reference,
      },
    });

    await this.notifyCustomer(
      orderId,
      'payment received',
      `${o.vendor.name} has received your payment${
        via === 'MOMO'
          ? ' by MoMo'
          : ' in cash'
      }${
        reference
          ? ` (transaction ${reference})`
          : ''
      }.`,
      null,
    );

    return this.get(orderId);
  }
}

export type { OrderRow };