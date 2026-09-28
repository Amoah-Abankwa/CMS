import { HostelFeesService } from './hostel-fees.service';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { HostelDto, RoomTypeDto } from './dto/accommodation.dto';

/** A private hostel owner's own listings and booking requests. Owners only ever see their own hostels. */
@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly hostelFees: HostelFeesService,
  ) {}

  hostels(user: AuthUser) {
    return this.prisma.hostel.findMany({
      where: { ownerId: user.id },
      orderBy: { name: 'asc' },
      include: { roomTypes: { orderBy: { pricePerSemester: 'asc' } } },
    });
  }

  /** New listings wait for the Hostel Office to verify them before students can see them. */
  async save(user: AuthUser, dto: HostelDto, id?: string) {
    if (id) await this.own(user, id);
    const data = { ...dto, facilities: dto.facilities ?? [], contactPhone: dto.contactPhone ? normaliseGhanaPhone(dto.contactPhone) : undefined };
    try {
      const hostel = id
        ? await this.prisma.hostel.update({ where: { id }, data })
        : await this.prisma.hostel.create({ data: { ...data, kind: 'PRIVATE', ownerId: user.id, verification: 'PENDING' } });
      await this.audit.record({ action: id ? 'hostels.private_updated' : 'hostels.private_listed', module: 'accommodation', targetType: 'Hostel', targetId: hostel.id });
      return hostel;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'NAME_TAKEN', message: 'A hostel with this name is already listed.' });
      throw err;
    }
  }

  async saveRoomType(user: AuthUser, hostelId: string, dto: RoomTypeDto, roomTypeId?: string) {
    await this.own(user, hostelId);
    const rt = roomTypeId
      ? await this.prisma.privateRoomType.update({ where: { id: roomTypeId, hostelId }, data: dto })
      : await this.prisma.privateRoomType.create({ data: { ...dto, hostelId } });
    await this.audit.record({ action: roomTypeId ? 'hostels.room_type_updated' : 'hostels.room_type_added', module: 'accommodation', targetType: 'PrivateRoomType', targetId: rt.id, after: dto });
    return rt;
  }

  bookings(user: AuthUser, status?: string) {
    return this.prisma.privateBooking.findMany({
      where: { roomType: { hostel: { ownerId: user.id } }, ...(status ? { status: status as 'REQUESTED' } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, status: true, message: true, ownerNote: true, createdAt: true, respondedAt: true,
        roomType: { select: { id: true, name: true, availableBeds: true, hostel: { select: { name: true } } } },
        // Owners see enough to contact the student, nothing academic.
        student: { select: { firstName: true, lastName: true, phone: true, email: true, indexNumber: true } },
      },
    });
  }

  async respond(user: AuthUser, id: string, accept: boolean, note?: string) {
    const booking = await this.prisma.privateBooking.findFirst({
      where: { id, roomType: { hostel: { ownerId: user.id } } },
      include: { roomType: { include: { hostel: { select: { name: true, contactPhone: true } } } } },
    });
    if (!booking) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Booking not found.' });
    if (booking.status !== 'REQUESTED') throw new ConflictException({ code: 'ANSWERED', message: 'This request has already been answered or cancelled.' });

    if (accept) {
      const clash = await this.prisma.privateBooking.findFirst({ where: { studentId: booking.studentId, semesterId: booking.semesterId, status: 'ACCEPTED' } });
      const university = await this.prisma.roomAllocation.findFirst({ where: { studentId: booking.studentId, semesterId: booking.semesterId, status: 'ACCEPTED' } });
      if (clash || university) throw new ConflictException({ code: 'STUDENT_PLACED', message: 'This student has already confirmed another place to stay this semester.' });
      await this.prisma.$transaction(async (tx) => {
        // The condition stops two acceptances taking the last bed.
        const taken = await tx.privateRoomType.updateMany({ where: { id: booking.roomTypeId, availableBeds: { gt: 0 } }, data: { availableBeds: { decrement: 1 } } });
        if (taken.count !== 1) throw new ConflictException({ code: 'FULL', message: 'There are no beds left in this room type. Update your availability or decline.' });
        await tx.privateBooking.update({ where: { id }, data: { status: 'ACCEPTED', ownerNote: note || null, respondedAt: new Date() } });
        // The student's other waiting requests are no longer needed.
        await tx.privateBooking.updateMany({ where: { studentId: booking.studentId, semesterId: booking.semesterId, status: 'REQUESTED', id: { not: id } }, data: { status: 'CANCELLED' } });
      });
    } else {
      await this.prisma.privateBooking.update({ where: { id }, data: { status: 'DECLINED', ownerNote: note || null, respondedAt: new Date() } });
    }

    await this.audit.record({ action: accept ? 'hostels.booking_accepted' : 'hostels.booking_declined', module: 'accommodation', targetType: 'PrivateBooking', targetId: id });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.PRIVATE_BOOKING_RESPONDED,
      recipients: [{ userId: booking.studentId }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: {
        hostel: booking.roomType.hostel.name,
        roomType: booking.roomType.name,
        decision: accept ? 'accepted' : 'declined',
        noteLine: note ? `Note from the owner: ${note}` : '',
        nextStep: accept ? `Contact the hostel on ${booking.roomType.hostel.contactPhone ?? 'the number in the listing'} to arrange payment and moving in. Pay only the hostel, never a third party.` : 'You can ask for a room at another hostel.',
        smsNext: accept ? 'Contact the hostel to arrange payment.' : 'You can ask elsewhere.',
      },
      link: '/accommodation',
    });
    await this.hostelFees.syncBooking(id);
    return { ok: true };
  }

  private async own(user: AuthUser, hostelId: string) {
    const hostel = await this.prisma.hostel.findUnique({ where: { id: hostelId }, select: { ownerId: true, kind: true } });
    if (!hostel || hostel.kind !== 'PRIVATE') throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
    if (hostel.ownerId !== user.id) throw new ForbiddenException({ code: 'NOT_YOURS', message: 'You can only manage your own hostels.' });
  }
}
