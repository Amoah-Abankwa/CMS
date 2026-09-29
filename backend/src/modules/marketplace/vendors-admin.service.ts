import { TransfersService } from '../payments/transfers.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import { loadEnv } from '../../core/config/env';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { AccountSetupService } from '../account-setup/account-setup.service';
import { CreateVendorDto, PayoutDto, ReviewVendorDto } from './dto/marketplace.dto';

const DEFAULT_HOURS = { '0': [], '1': [['08:00', '18:00']], '2': [['08:00', '18:00']], '3': [['08:00', '18:00']], '4': [['08:00', '18:00']], '5': [['08:00', '18:00']], '6': [] };

/** Dean of Students and Finance: vendors, approvals, settlements and payouts. */
@Injectable()
export class VendorsAdminService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly setup: AccountSetupService,
    private readonly transfers: TransfersService,
  ) {}

  onModuleInit() {
    this.transfers.register('VENDOR', {
      recipient: async (vendorId, meta) => {
        const v = await this.prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { name: true, payoutNetwork: true, payoutNumber: true, payoutName: true } });
        if (!meta.periodFrom || !meta.periodTo) throw new BadRequestException({ code: 'PERIOD', message: 'Choose the settlement period first.' });
        const row = (await this.settlements(meta.periodFrom, meta.periodTo)).find((r) => r.vendor.id === vendorId);
        return { network: v.payoutNetwork, number: v.payoutNumber, name: v.payoutName, owed: row?.owed ?? 0, label: v.name };
      },
      record: async (actorId, vendorId, amount, reference, meta) => {
        await this.recordPayout({ id: actorId } as AuthUser, { vendorId, periodFrom: meta.periodFrom!, periodTo: meta.periodTo!, amount, reference, note: 'Paystack transfer' });
      },
    });
  }

  async list() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const vendors = await this.prisma.vendor.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        owner: { select: { firstName: true, lastName: true, email: true, phone: true, status: true } },
        _count: { select: { items: true, orders: { where: { status: 'COMPLETED', completedAt: { gte: since } } } } },
      },
    });
    return vendors.map(({ _count, ...v }) => ({ ...v, menuItems: _count.items, ordersLast30Days: _count.orders }));
  }

  /** Creates the owner's partner account (they get a setup link) and a vendor waiting for approval. */
  async create(dto: CreateVendorDto) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.VENDOR } });
    const phone = normaliseGhanaPhone(dto.phone);
    try {
      const vendor = await this.prisma.$transaction(async (tx) => {
        const owner = await tx.user.create({
          data: {
            type: 'PARTNER', status: 'PENDING_SETUP', firstName: dto.firstName, lastName: dto.lastName, email: dto.email, phone,
            primaryRoleKey: ROLE_KEYS.VENDOR, isDemo: loadEnv().DEMO_MODE, roles: { create: { roleId: role.id } },
          },
        });
        return tx.vendor.create({ data: { ownerId: owner.id, name: dto.vendorName, location: dto.location, phone, openingHours: DEFAULT_HOURS } });
      });
      await this.audit.record({ action: 'marketplace.vendor_created', module: 'marketplace', targetType: 'Vendor', targetId: vendor.id, after: { name: vendor.name, owner: dto.email } });
      await this.setup.sendSetupLink(vendor.ownerId);
      return vendor;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'TAKEN', message: 'That email or vendor name is already in use.' });
      }
      throw err;
    }
  }

  async review(user: AuthUser, id: string, dto: ReviewVendorDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Vendor not found.' });
    const updated = await this.prisma.vendor.update({ where: { id }, data: { status: dto.status, statusNote: dto.note || null, reviewedAt: new Date(), reviewedById: user.id } });
    await this.audit.record({ action: 'marketplace.vendor_reviewed', module: 'marketplace', targetType: 'Vendor', targetId: id, before: { status: vendor.status }, after: { status: dto.status, note: dto.note } });
    const outcome = { APPROVED: 'approved and is now visible to students and staff', SUSPENDED: 'suspended and is hidden from customers', REJECTED: 'not approved' }[dto.status];
    await this.notifications.notify({
      eventKey: EVENT_KEYS.VENDOR_REVIEW,
      recipients: [{ userId: vendor.ownerId }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { vendor: vendor.name, outcome, noteLine: dto.note ? `Note: ${dto.note}` : '' },
      link: '/vendor',
    });
    return updated;
  }

  /**
   * What each vendor is owed for completed online orders in a period, less commission, campus dispatcher fees and payouts
   * already recorded for that period. Pay-at-counter sales go straight to the vendor and are shown for reference.
   */
  async settlements(from: string, to: string) {
    const settingsPercent = ((await this.prisma.systemSetting.findUnique({ where: { key: 'marketplace.settings' } }))?.value as { commissionPercent?: number } | null)?.commissionPercent ?? 0;
    const start = new Date(from);
    const end = new Date(to);
    const [vendors, orders, payouts, deliveries, plans] = await Promise.all([
      this.prisma.vendor.findMany({ where: { status: { not: 'REJECTED' } }, orderBy: { name: 'asc' }, select: { id: true, name: true, payoutNetwork: true, payoutNumber: true, payoutName: true } }),
      this.prisma.foodOrder.findMany({ where: { status: 'COMPLETED', completedAt: { gte: start, lte: end } }, select: { vendorId: true, paymentOption: true, total: true, commission: true } }),
      this.prisma.vendorPayout.findMany({ where: { periodFrom: { gte: start }, periodTo: { lte: end } }, orderBy: { createdAt: 'desc' } }),
      // Campus dispatchers are paid per delivery by Finance, and that cost comes out of the vendor's share.
      this.prisma.delivery.findMany({ where: { status: 'DELIVERED', feeSettlement: 'UNIVERSITY', order: { completedAt: { gte: start, lte: end } } }, select: { fee: true, order: { select: { vendorId: true } } } }),
      // Meal plans are sold online and belong to the vendor from the day they are paid.
      this.prisma.mealPlanPurchase.findMany({ where: { paidAt: { gte: start, lte: end } }, select: { price: true, plan: { select: { vendorId: true } } } }),
    ]);
    return vendors.map((v) => {
      const mine = orders.filter((o) => o.vendorId === v.id);
      const online = mine.filter((o) => o.paymentOption === 'ONLINE');
      const planSales = plans.filter((p) => p.plan.vendorId === v.id).reduce((s, p) => s + p.price, 0);
      const gross = online.reduce((s, o) => s + o.total, 0) + planSales;
      const commissionTotal = online.reduce((s, o) => s + o.commission, 0) + Math.round((planSales * settingsPercent) / 100);
      const paidOut = payouts.filter((p) => p.vendorId === v.id).reduce((s, p) => s + p.amount, 0);
      const dispatchFees = deliveries.filter((d) => d.order.vendorId === v.id).reduce((s, d) => s + d.fee, 0);
      return {
        vendor: v,
        onlineOrders: online.length,
        onlineGross: gross,
        commission: commissionTotal,
        dispatchFees,
        net: gross - commissionTotal - dispatchFees,
        paidOut,
        owed: gross - commissionTotal - dispatchFees - paidOut,
        counterOrders: mine.length - online.length,
        counterGross: mine.filter((o) => o.paymentOption === 'ON_PICKUP').reduce((s, o) => s + o.total, 0),
        payouts: payouts.filter((p) => p.vendorId === v.id),
      };
    });
  }

  async recordPayout(user: AuthUser, dto: PayoutDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Vendor not found.' });
    const payout = await this.prisma.vendorPayout.create({
      data: { vendorId: dto.vendorId, periodFrom: new Date(dto.periodFrom), periodTo: new Date(dto.periodTo), amount: dto.amount, reference: dto.reference || null, note: dto.note || null, recordedById: user.id },
    });
    await this.audit.record({ action: 'marketplace.payout_recorded', module: 'marketplace', targetType: 'Vendor', targetId: dto.vendorId, after: { amount: dto.amount, reference: dto.reference, period: `${dto.periodFrom} to ${dto.periodTo}` } });
    return payout;
  }

  ratings() {
    return this.prisma.orderRating.findMany({ where: { vendorComment: { not: null } }, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, vendorStars: true, vendorComment: true, hiddenAt: true, createdAt: true, order: { select: { number: true, vendor: { select: { name: true } } } } } });
  }

  async hideRating(user: AuthUser, id: string, hide: boolean) {
    await this.prisma.orderRating.update({ where: { id }, data: hide ? { hiddenAt: new Date(), hiddenById: user.id } : { hiddenAt: null, hiddenById: null } });
    await this.audit.record({ action: hide ? 'marketplace.rating_hidden' : 'marketplace.rating_shown', module: 'marketplace', targetType: 'OrderRating', targetId: id });
    return { hidden: hide };
  }
}
