import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
import { SemestersService } from '../academics/semesters.service';
import { BulkRoomsDto, HostelDto, OwnerDto, RoomUpdateDto, VerifyDto } from './dto/accommodation.dto';

/** Statuses that hold a bed. */
export const HOLDING = ['PROVISIONAL', 'OFFERED', 'ACCEPTED'] as const;

/**
 * Hostel Office administration: university hostels and rooms, verifying private hostels,
 * and creating accounts for private hostel owners.
 */
@Injectable()
export class HostelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly setup: AccountSetupService,
  ) {}

  /** University hostels with beds, taken and free for the semester. */
  async university(semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const hostels = await this.prisma.hostel.findMany({
      where: { kind: 'UNIVERSITY' },
      orderBy: { name: 'asc' },
      include: {
        rooms: {
          select: {
            capacity: true, isActive: true, roomType: true, pricePerSemester: true,
            allocations: { where: { semesterId: semester.id, status: { in: [...HOLDING] } }, select: { status: true } },
          },
        },
      },
    });
    return {
      semester,
      items: hostels.map(({ rooms, ...h }) => {
        const active = rooms.filter((r) => r.isActive);
        const beds = active.reduce((s, r) => s + r.capacity, 0);
        const held = active.flatMap((r) => r.allocations);
        return {
          ...h,
          rooms: active.length,
          beds,
          accepted: held.filter((a) => a.status === 'ACCEPTED').length,
          offered: held.filter((a) => a.status === 'OFFERED').length,
          provisional: held.filter((a) => a.status === 'PROVISIONAL').length,
          free: beds - held.length,
          roomTypes: [...new Set(active.map((r) => r.roomType))],
        };
      }),
    };
  }

  async saveUniversity(dto: HostelDto, id?: string) {
    if (dto.gender === 'MIXED') throw new BadRequestException({ code: 'GENDER_REQUIRED', message: 'University hostels are for male or female students.' });
    const data = { ...dto, facilities: dto.facilities ?? [], contactPhone: dto.contactPhone ? normaliseGhanaPhone(dto.contactPhone) : undefined };
    try {
      const hostel = id
        ? await this.prisma.hostel.update({ where: { id, kind: 'UNIVERSITY' }, data })
        : await this.prisma.hostel.create({ data: { ...data, kind: 'UNIVERSITY', verification: 'APPROVED' } });
      await this.audit.record({ action: id ? 'hostels.hostel_updated' : 'hostels.hostel_created', module: 'accommodation', targetType: 'Hostel', targetId: hostel.id, after: hostel });
      return hostel;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'NAME_TAKEN', message: 'A hostel with this name already exists.' });
      throw err;
    }
  }

  /** Rooms with their current occupants, for the Hostel Office. */
  async rooms(hostelId: string, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const hostel = await this.prisma.hostel.findFirst({ where: { id: hostelId, kind: 'UNIVERSITY' } });
    if (!hostel) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
    const rooms = await this.prisma.room.findMany({
      where: { hostelId },
      select: {
        id: true, number: true, floor: true, capacity: true, roomType: true, pricePerSemester: true, isActive: true, notes: true,
        allocations: {
          where: { semesterId: semester.id, status: { in: [...HOLDING] } },
          select: { id: true, status: true, acceptBy: true, student: { select: { id: true, indexNumber: true, firstName: true, lastName: true } } },
        },
      },
    });
    rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return { semester, hostel, rooms };
  }

  /** Adds numbered rooms in one go, e.g. prefix A, 101 to 120. Existing numbers are skipped. */
  async addRooms(hostelId: string, dto: BulkRoomsDto) {
    if (dto.to < dto.from) throw new BadRequestException({ code: 'RANGE', message: 'The last room number must not be lower than the first.' });
    if (dto.to - dto.from > 199) throw new BadRequestException({ code: 'RANGE', message: 'Add at most 200 rooms at a time.' });
    const hostel = await this.prisma.hostel.findFirst({ where: { id: hostelId, kind: 'UNIVERSITY' } });
    if (!hostel) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
    const data = [];
    for (let n = dto.from; n <= dto.to; n++) {
      data.push({ hostelId, number: `${dto.prefix}${n}`, floor: dto.floor ?? null, capacity: dto.capacity, roomType: dto.roomType, pricePerSemester: dto.pricePerSemester });
    }
    const result = await this.prisma.room.createMany({ data, skipDuplicates: true });
    await this.audit.record({ action: 'hostels.rooms_added', module: 'accommodation', targetType: 'Hostel', targetId: hostelId, metadata: { added: result.count, range: `${dto.prefix}${dto.from}-${dto.prefix}${dto.to}` } });
    return { added: result.count, skipped: data.length - result.count };
  }

  async updateRoom(roomId: string, dto: RoomUpdateDto) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { allocations: { where: { status: { in: [...HOLDING] } }, select: { semesterId: true } } } });
    if (!room) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Room not found.' });
    const most = Math.max(0, ...Object.values(room.allocations.reduce<Record<string, number>>((m, a) => ({ ...m, [a.semesterId]: (m[a.semesterId] ?? 0) + 1 }), {})));
    if (dto.capacity < most) throw new ConflictException({ code: 'OCCUPIED', message: `${most} students are allocated to this room. Move some before reducing its beds.` });
    if (!dto.isActive && most > 0) throw new ConflictException({ code: 'OCCUPIED', message: 'Students are allocated to this room. Move them before closing it.' });
    const updated = await this.prisma.room.update({ where: { id: roomId }, data: dto });
    await this.audit.record({ action: 'hostels.room_updated', module: 'accommodation', targetType: 'Room', targetId: roomId, before: room, after: updated });
    return updated;
  }

  /** Private hostels for verification, pending first. */
  async privateHostels() {
    const rows = await this.prisma.hostel.findMany({
      where: { kind: 'PRIVATE' },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
        roomTypes: { select: { name: true, pricePerSemester: true, availableBeds: true, bedsPerRoom: true, isActive: true } },
      },
    });
    const order = { PENDING: 0, SUSPENDED: 1, APPROVED: 2, REJECTED: 3 };
    return rows.sort((a, b) => order[a.verification] - order[b.verification]);
  }

  async verify(user: AuthUser, id: string, dto: VerifyDto) {
    const hostel = await this.prisma.hostel.findFirst({ where: { id, kind: 'PRIVATE' } });
    if (!hostel) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Private hostel not found.' });
    const updated = await this.prisma.hostel.update({
      where: { id },
      data: { verification: dto.status, verificationNote: dto.note?.trim() || null, verifiedAt: new Date(), verifiedById: user.id },
    });
    await this.audit.record({ action: 'hostels.private_verified', module: 'accommodation', targetType: 'Hostel', targetId: id, before: { verification: hostel.verification }, after: { verification: dto.status, note: dto.note } });
    if (hostel.ownerId) {
      const outcome = { APPROVED: 'approved and now visible to students', REJECTED: 'not approved', SUSPENDED: 'suspended and hidden from students' }[dto.status];
      await this.notifications.notify({
        eventKey: EVENT_KEYS.HOSTEL_VERIFICATION,
        recipients: [{ userId: hostel.ownerId }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { hostel: hostel.name, outcome, noteLine: dto.note ? `Note from the Hostel Office: ${dto.note}` : '' },
        link: '/my-hostel',
      });
    }
    return updated;
  }

  owners() {
    return this.prisma.user.findMany({
      where: { type: 'PARTNER', roles: { some: { role: { key: ROLE_KEYS.PRIVATE_HOSTEL_OWNER } } } },
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, ownedHostels: { select: { id: true, name: true, verification: true } } },
    });
  }

  /** Creates a private hostel owner's account and emails them a setup link. */
  async createOwner(dto: OwnerDto) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.PRIVATE_HOSTEL_OWNER } });
    try {
      const owner = await this.prisma.user.create({
        data: {
          type: 'PARTNER', status: 'PENDING_SETUP', firstName: dto.firstName, lastName: dto.lastName, email: dto.email, phone: normaliseGhanaPhone(dto.phone),
          primaryRoleKey: ROLE_KEYS.PRIVATE_HOSTEL_OWNER, isDemo: loadEnv().DEMO_MODE, roles: { create: { roleId: role.id } },
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      await this.audit.record({ action: 'hostels.owner_created', module: 'accommodation', targetType: 'User', targetId: owner.id, after: owner });
      await this.setup.sendSetupLink(owner.id);
      return owner;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' });
      throw err;
    }
  }
}
