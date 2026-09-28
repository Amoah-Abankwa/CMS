import { EmploymentRulesService } from '../employment/employment-rules.service';
import { UploadsService } from '../uploads/uploads.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isOpenAt, type OpeningHours } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { OrdersService, ORDER_SELECT } from './orders.service';
import { OrdersQuery } from './dto/marketplace.dto';

const VENDOR_PUBLIC = {
  id: true, name: true, description: true, location: true, phone: true, openingHours: true, paused: true,
  acceptsOnline: true, acceptsPayOnPickup: true, offersPickup: true, offersDelivery: true, useDispatchers: true, deliveryFee: true, deliveryNote: true, minimumOrder: true, prepMinutes: true,
} as const;

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly uploads: UploadsService,
    private readonly employment: EmploymentRulesService,
  ) {}

  private assertCustomer(user: AuthUser) {
    if (user.type !== 'STUDENT' && user.type !== 'STAFF') throw new ForbiddenException({ code: 'NOT_A_CUSTOMER', message: 'Food orders are for students and staff.' });
  }

  async vendors(user: AuthUser) {
    this.assertCustomer(user);
    const now = new Date();
    const vendors = await this.prisma.vendor.findMany({ where: { status: 'APPROVED' }, orderBy: { name: 'asc' }, select: { ...VENDOR_PUBLIC, _count: { select: { items: { where: { isAvailable: true } } } } } });
    return vendors
      .map(({ _count, ...v }) => ({ ...v, openNow: isOpenAt(v.openingHours as OpeningHours, now, v.paused), itemsAvailable: _count.items }))
      .sort((a, b) => Number(b.openNow) - Number(a.openNow));
  }

  async menu(user: AuthUser, vendorId: string) {
    this.assertCustomer(user);
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, status: 'APPROVED' },
      select: {
        ...VENDOR_PUBLIC,
        categories: { orderBy: { position: 'asc' }, select: { id: true, name: true } },
        items: { orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true, name: true, description: true, price: true, isAvailable: true, tags: true, categoryId: true, photoId: true } },
      },
    });
    if (!vendor) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Vendor not found.' });
    return { ...vendor, items: vendor.items.map(({ photoId, ...i }) => ({ ...i, photoUrl: this.uploads.url(photoId, 400) })), openNow: isOpenAt(vendor.openingHours as OpeningHours, new Date(), vendor.paused), defaultAddress: await this.defaultAddress(user), dispatchFee: vendor.useDispatchers ? (await this.employment.get()).dispatchFee : 0, payToNumber: vendor.phone };
  }

  /** Suggests where to deliver: the customer's hostel room, private hostel or declared address this semester. */
  private async defaultAddress(user: AuthUser) {
    if (user.type !== 'STUDENT') return null;
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!semester) return null;
    const [room, booking, declared] = await Promise.all([
      this.prisma.roomAllocation.findFirst({ where: { studentId: user.id, semesterId: semester.id, status: 'ACCEPTED' }, select: { room: { select: { number: true, hostel: { select: { name: true } } } } } }),
      this.prisma.privateBooking.findFirst({ where: { studentId: user.id, semesterId: semester.id, status: 'ACCEPTED' }, select: { roomType: { select: { hostel: { select: { name: true } } } } } }),
      this.prisma.residenceDeclaration.findUnique({ where: { studentId_semesterId: { studentId: user.id, semesterId: semester.id } }, select: { address: true } }),
    ]);
    if (room) return `${room.room.hostel.name}, room ${room.room.number}`;
    if (booking) return booking.roomType.hostel.name;
    return declared?.address ?? null;
  }

  async myOrders(user: AuthUser, q: OrdersQuery) {
    this.assertCustomer(user);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.foodOrder.findMany({ where: { customerId: user.id }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: ORDER_SELECT }),
      this.prisma.foodOrder.count({ where: { customerId: user.id } }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async order(user: AuthUser, id: string) {
    const o = await this.orders.get(id);
    if (o.customer.id !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found.' });
    return o;
  }

  async cancel(user: AuthUser, id: string) {
    await this.order(user, id);
    return this.orders.move(id, 'CANCELLED', 'CUSTOMER', { reason: 'Cancelled by the customer', byUser: user });
  }
}
