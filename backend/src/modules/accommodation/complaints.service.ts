import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { COMPLAINT_CATEGORY_LABEL, PERMISSIONS, type ComplaintCategory } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PermissionResolverService } from '../rbac/permission-resolver.service';

const SELECT = {
  id: true, category: true, description: true, shareName: true, status: true, officeNote: true, ownerResponse: true, ownerRespondedAt: true, createdAt: true, updatedAt: true,
  hostel: { select: { id: true, name: true, ownerId: true } },
  student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, phone: true } },
} as const;

/**
 * Complaints about private hostels. Students file them; the Hostel Office reviews and closes them; the
 * owner sees each complaint about their hostel and can respond, without the student's name unless the
 * student agreed to share it.
 */
@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService, private readonly resolver: PermissionResolverService, private readonly audit: AuditService, private readonly notifications: NotificationsService) {}

  async file(user: AuthUser, dto: { hostelId: string; category: ComplaintCategory; description: string; shareName: boolean }) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Students file hostel complaints.' });
    const h = await this.prisma.hostel.findUnique({ where: { id: dto.hostelId }, select: { kind: true, name: true } });
    if (!h || h.kind !== 'PRIVATE') throw new NotFoundException({ code: 'NOT_FOUND', message: 'Choose a private hostel.' });
    const open = await this.prisma.hostelComplaint.count({ where: { studentId: user.id, status: { in: ['OPEN', 'IN_REVIEW'] } } });
    if (open >= 5) throw new BadRequestException({ code: 'TOO_MANY', message: 'You have 5 complaints still open. Wait for the Hostel Office to deal with them.' });
    const c = await this.prisma.hostelComplaint.create({ data: { ...dto, studentId: user.id } });
    await this.audit.record({ action: 'accommodation.complaint_filed', module: 'accommodation', targetType: 'HostelComplaint', targetId: c.id, metadata: { hostel: h.name, category: dto.category } });
    return c;
  }

  mine(user: AuthUser) {
    return this.prisma.hostelComplaint.findMany({ where: { studentId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, select: SELECT });
  }

  async list(user: AuthUser, status?: string) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    const office = perms.has(PERMISSIONS.HOSTELS_MANAGE);
    if (!office && !perms.has(PERMISSIONS.PRIVATE_HOSTEL_OWN)) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'Only the Hostel Office and owners see hostel complaints.' });
    const rows = await this.prisma.hostelComplaint.findMany({
      where: { ...(status ? { status: status as never } : {}), ...(office ? {} : { hostel: { ownerId: user.id } }) },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: SELECT,
    });
    // Owners see the student only if the student agreed.
    return rows.map((c) => (office || c.shareName ? c : { ...c, student: null }));
  }

  /** Only the Hostel Office moves a complaint along. */
  async handleChecked(user: AuthUser, id: string, dto: { status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'; note?: string }) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(PERMISSIONS.HOSTELS_MANAGE)) throw new ForbiddenException({ code: 'OFFICE_ONLY', message: 'The Hostel Office handles complaints.' });
    return this.handle(user, id, dto);
  }

  private async handle(user: AuthUser, id: string, dto: { status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'; note?: string }) {
    const c = await this.prisma.hostelComplaint.findUnique({ where: { id }, select: SELECT });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Complaint not found.' });
    if (dto.status !== 'IN_REVIEW' && !dto.note) throw new BadRequestException({ code: 'NOTE', message: 'Say what was done.' });
    await this.prisma.hostelComplaint.update({ where: { id }, data: { status: dto.status, officeNote: dto.note ?? c.officeNote, handledById: user.id } });
    await this.audit.record({ action: 'accommodation.complaint_handled', module: 'accommodation', targetType: 'HostelComplaint', targetId: id, before: { status: c.status }, after: { status: dto.status } });
    const verb = dto.status === 'IN_REVIEW' ? 'is being looked into' : dto.status === 'RESOLVED' ? 'has been resolved' : 'has been closed';
    const vars = { headline: `Your complaint about ${c.hostel.name} ${verb}`, detail: dto.note ?? '' };
    await this.notifications.notify({ eventKey: EVENT_KEYS.TIMESHEET_UPDATE, recipients: [{ userId: c.student.id }], channels: ['IN_APP', 'EMAIL'], sharedVars: vars, link: '/accommodation' });
    if (c.hostel.ownerId) await this.notifications.notify({ eventKey: EVENT_KEYS.TIMESHEET_UPDATE, recipients: [{ userId: c.hostel.ownerId }], channels: ['IN_APP'], sharedVars: { headline: `A complaint about ${c.hostel.name} ${verb}`, detail: `${COMPLAINT_CATEGORY_LABEL[c.category as ComplaintCategory]}. ${dto.note ?? ''}` }, link: '/my-hostel/complaints' });
    return { status: dto.status };
  }

  async respond(user: AuthUser, id: string, response: string) {
    const c = await this.prisma.hostelComplaint.findUnique({ where: { id }, select: SELECT });
    if (!c || c.hostel.ownerId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Complaint not found.' });
    await this.prisma.hostelComplaint.update({ where: { id }, data: { ownerResponse: response, ownerRespondedAt: new Date() } });
    await this.audit.record({ action: 'accommodation.complaint_answered', module: 'accommodation', targetType: 'HostelComplaint', targetId: id });
    return { ok: true };
  }
}
