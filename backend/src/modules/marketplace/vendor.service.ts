import { averageStars } from '@anu/shared';
import { UploadsService } from '../uploads/uploads.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isOpenAt, validateHours, type OpeningHours } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { OrdersService, ORDER_SELECT } from './orders.service';
import { CategoryDto, MenuItemDto, VendorActionDto, VendorProfileDto } from './dto/marketplace.dto';

/** A vendor's own profile, menu and orders. Vendors only ever see their own. */
@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  async mine(user: AuthUser) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { ownerId: user.id },
      include: {
        categories: { orderBy: { position: 'asc' } },
        items: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!vendor) throw new NotFoundException({ code: 'NO_VENDOR', message: 'No vendor is linked to your account. Contact the Dean of Students office.' });
    return { ...vendor, items: vendor.items.map((i) => ({ ...i, photoUrl: this.uploads.url(i.photoId, 400) })), openNow: isOpenAt(vendor.openingHours as OpeningHours, new Date(), vendor.paused) };
  }

  async updateProfile(user: AuthUser, dto: VendorProfileDto) {
    const v = await this.mine(user);
    const problems = validateHours(dto.openingHours);
    if (problems.length) throw new BadRequestException({ code: 'HOURS', message: problems[0] });
    if (!dto.offersPickup && !dto.offersDelivery) throw new BadRequestException({ code: 'FULFILMENT', message: 'Offer pickup, delivery, or both.' });
    if (!dto.acceptsOnline && !dto.acceptsPayOnPickup) throw new BadRequestException({ code: 'PAYMENT', message: 'Accept online payment, payment at the counter, or both.' });
    if (dto.useDispatchers && (!dto.offersDelivery || !dto.acceptsOnline)) {
      throw new BadRequestException({ code: 'DISPATCH', message: 'Campus dispatchers need delivery switched on and online payment accepted, because they never handle cash.' });
    }
    if (dto.acceptsOnline && !dto.payoutNumber) throw new BadRequestException({ code: 'PAYOUT', message: 'Add a mobile money number so Finance can pay you for online orders.' });
    const updated = await this.prisma.vendor.update({
      where: { id: v.id },
      data: { ...dto, phone: normaliseGhanaPhone(dto.phone), payoutNumber: dto.payoutNumber ? normaliseGhanaPhone(dto.payoutNumber) : null, openingHours: dto.openingHours },
    });
    await this.audit.record({ action: 'marketplace.vendor_profile_updated', module: 'marketplace', targetType: 'Vendor', targetId: v.id, after: { ...dto, payoutNumber: dto.payoutNumber ? 'set' : null } });
    return updated;
  }

  async setPaused(user: AuthUser, paused: boolean) {
    const v = await this.mine(user);
    await this.prisma.vendor.update({ where: { id: v.id }, data: { paused } });
    await this.audit.record({ action: paused ? 'marketplace.vendor_paused' : 'marketplace.vendor_resumed', module: 'marketplace', targetType: 'Vendor', targetId: v.id });
    return { paused };
  }

  async saveCategory(user: AuthUser, dto: CategoryDto, id?: string) {
    const v = await this.mine(user);
    try {
      return id
        ? await this.prisma.menuCategory.update({ where: { id, vendorId: v.id }, data: dto })
        : await this.prisma.menuCategory.create({ data: { ...dto, vendorId: v.id, position: dto.position ?? v.categories.length } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'EXISTS', message: 'You already have a category with that name.' });
      throw err;
    }
  }

  async deleteCategory(user: AuthUser, id: string) {
    const v = await this.mine(user);
    // Items in it stay on the menu, uncategorised.
    await this.prisma.menuCategory.delete({ where: { id, vendorId: v.id } });
    return { ok: true };
  }

  async saveItem(user: AuthUser, dto: MenuItemDto, id?: string) {
    const v = await this.mine(user);
    if (dto.categoryId && !v.categories.some((c) => c.id === dto.categoryId)) throw new BadRequestException({ code: 'CATEGORY', message: 'Choose one of your categories.' });
    const data = { ...dto, tags: dto.tags ?? [] };
    const item = id
      ? await this.prisma.menuItem.update({ where: { id, vendorId: v.id }, data })
      : await this.prisma.menuItem.create({ data: { ...data, vendorId: v.id, position: v.items.length } });
    await this.audit.record({ action: id ? 'marketplace.menu_item_updated' : 'marketplace.menu_item_added', module: 'marketplace', targetType: 'MenuItem', targetId: item.id, after: { name: item.name, price: item.price } });
    return item;
  }

  async setAvailable(user: AuthUser, id: string, isAvailable: boolean) {
    const v = await this.mine(user);
    return this.prisma.menuItem.update({ where: { id, vendorId: v.id }, data: { isAvailable } });
  }

  async deleteItem(user: AuthUser, id: string) {
    const v = await this.mine(user);
    await this.prisma.menuItem.delete({ where: { id, vendorId: v.id } });
    return { ok: true };
  }

  /** The live board: everything still in progress, plus today's finished orders. */
  async board(user: AuthUser) {
    const v = await this.mine(user);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [active, done] = await Promise.all([
      this.prisma.foodOrder.findMany({ where: { vendorId: v.id, status: { in: ['PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY'] } }, orderBy: { placedAt: 'asc' }, select: ORDER_SELECT }),
      this.prisma.foodOrder.findMany({ where: { vendorId: v.id, status: { in: ['COMPLETED', 'CANCELLED', 'REJECTED'] }, updatedAt: { gte: today } }, orderBy: { updatedAt: 'desc' }, take: 50, select: ORDER_SELECT }),
    ]);
    // The customer's code is only for the customer; the vendor must ask for it.
    // The customer's code is for the customer, and the dispatcher's location for the customer alone.
    const hide = <T extends { pickupCode: string; delivery: { dispatcher: { lastLat: number | null } | null } | null }>(o: T) => ({ ...o, pickupCode: undefined, delivery: o.delivery ? { ...o.delivery, dispatcher: o.delivery.dispatcher ? { ...o.delivery.dispatcher, lastLat: null, lastLng: null, lastAccuracy: null, lastLocationAt: null } : null } : null });
    const sales = done.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.total, 0);
    return { vendor: { id: v.id, name: v.name, paused: v.paused, openNow: v.openNow, status: v.status }, active: active.map(hide), done: done.map(hide), salesToday: sales };
  }

  async markPaid(user: AuthUser, orderId: string, via: 'CASH' | 'MOMO', reference?: string) {
    const v = await this.mine(user);
    const o = await this.orders.markPaid(orderId, v.id, via, reference);
    return { ...o, pickupCode: undefined };
  }

  async act(user: AuthUser, orderId: string, dto: VendorActionDto) {
    const v = await this.mine(user);
    const order = await this.prisma.foodOrder.findUnique({ where: { id: orderId }, select: { vendorId: true } });
    if (!order || order.vendorId !== v.id) throw new ForbiddenException({ code: 'NOT_YOURS', message: 'This is not one of your orders.' });
    const o = await this.orders.move(orderId, dto.to, 'VENDOR', { reason: dto.reason, code: dto.code, byUser: user });
    return { ...o, pickupCode: undefined };
  }

  async ratings(user: AuthUser) {
    const v = await this.mine(user);
    const rows = await this.prisma.orderRating.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' }, take: 100, select: { vendorStars: true, vendorComment: true, hiddenAt: true, createdAt: true, order: { select: { number: true } } } });
    return { average: averageStars(rows.map((r) => r.vendorStars)), count: rows.length, rows: rows.map((r) => ({ ...r, vendorComment: r.hiddenAt ? null : r.vendorComment })) };
  }

  async plans(user: AuthUser) {
    const v = await this.mine(user);
    return this.prisma.mealPlan.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, meals: true, price: true, validDays: true, eligibleItemIds: true, isActive: true, _count: { select: { purchases: { where: { status: { in: ['ACTIVE', 'USED_UP', 'EXPIRED'] } } } } } } });
  }

  async savePlan(user: AuthUser, dto: { name: string; meals: number; price: number; validDays: number; eligibleItemIds: string[]; isActive?: boolean }, id?: string) {
    const v = await this.mine(user);
    if (dto.eligibleItemIds.some((i) => !v.items.some((x) => x.id === i))) throw new BadRequestException({ code: 'ITEMS', message: 'Choose dishes from your own menu.' });
    const plan = id
      ? await this.prisma.mealPlan.update({ where: { id, vendorId: v.id }, data: dto })
      : await this.prisma.mealPlan.create({ data: { ...dto, vendorId: v.id } });
    await this.audit.record({ action: id ? 'marketplace.meal_plan_updated' : 'marketplace.meal_plan_created', module: 'marketplace', targetType: 'MealPlan', targetId: plan.id, after: { name: dto.name, meals: dto.meals, price: dto.price } });
    return plan;
  }
}
