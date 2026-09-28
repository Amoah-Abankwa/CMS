import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PermissionResolverService } from '../rbac/permission-resolver.service';

type Scope = { manager: boolean; ownerOf: string[] };

/**
 * Hostel paperwork and arrival: forms students download, sign and send back (tenancy agreement,
 * registration form...), and check-in and check-out. The Hostel Manager runs university halls; owners
 * run their private hostels.
 */
@Injectable()
export class HostelFormsService {
  constructor(private readonly prisma: PrismaService, private readonly resolver: PermissionResolverService, private readonly audit: AuditService) {}

  private async scope(user: AuthUser): Promise<Scope> {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    const owned = perms.has(PERMISSIONS.PRIVATE_HOSTEL_OWN) ? await this.prisma.hostel.findMany({ where: { ownerId: user.id }, select: { id: true } }) : [];
    const s = { manager: perms.has(PERMISSIONS.HOSTELS_MANAGE), ownerOf: owned.map((h) => h.id) };
    if (!s.manager && !s.ownerOf.length) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'Only the Hostel Manager and hostel owners manage hostel forms and residents.' });
    return s;
  }

  private runs(s: Scope, hostel: { id: string; kind: string } | null) {
    return hostel ? (hostel.kind === 'PRIVATE' ? s.ownerOf.includes(hostel.id) : s.manager) : s.manager;
  }

  // ----- Form templates -----

  async templates(user: AuthUser) {
    const s = await this.scope(user);
    return this.prisma.hostelFormTemplate.findMany({
      where: { OR: [...(s.manager ? [{ hostelId: null }, { hostel: { kind: 'UNIVERSITY' as const } }] : []), ...(s.ownerOf.length ? [{ hostelId: { in: s.ownerOf } }] : [])] },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, description: true, isActive: true, createdAt: true, documentId: true, hostel: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
    });
  }

  async createTemplate(user: AuthUser, dto: { title: string; description?: string; hostelId?: string | null; documentId: string }) {
    const s = await this.scope(user);
    const hostel = dto.hostelId ? await this.prisma.hostel.findUnique({ where: { id: dto.hostelId }, select: { id: true, kind: true } }) : null;
    if (dto.hostelId && !hostel) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
    if (!this.runs(s, hostel)) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'You do not run this hostel.' });
    const doc = await this.prisma.storedDocument.findUnique({ where: { id: dto.documentId } });
    if (!doc || doc.uploadedById !== user.id || doc.purpose !== 'HOSTEL_FORM') throw new BadRequestException({ code: 'DOCUMENT', message: 'Upload the form first.' });
    const t = await this.prisma.hostelFormTemplate.create({ data: { title: dto.title, description: dto.description || null, hostelId: dto.hostelId ?? null, documentId: dto.documentId, createdById: user.id } });
    await this.audit.record({ action: 'accommodation.form_added', module: 'accommodation', targetType: 'HostelFormTemplate', targetId: t.id, after: { title: dto.title, hostel: hostel?.id ?? 'all university halls' } });
    return t;
  }

  async setTemplateActive(user: AuthUser, id: string, isActive: boolean) {
    const s = await this.scope(user);
    const t = await this.prisma.hostelFormTemplate.findUnique({ where: { id }, include: { hostel: { select: { id: true, kind: true } } } });
    if (!t || !this.runs(s, t.hostel)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Form not found.' });
    await this.prisma.hostelFormTemplate.update({ where: { id }, data: { isActive } });
    return { isActive };
  }

  // ----- Students -----

  /** The student's places this semester and the forms each needs, with where each submission stands. */
  private async placements(studentId: string) {
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!semester) return { semesterId: null, hostels: [] as Array<{ id: string; kind: string; name: string }> };
    const [alloc, booking] = await Promise.all([
      this.prisma.roomAllocation.findFirst({ where: { studentId, semesterId: semester.id, status: 'ACCEPTED' }, select: { room: { select: { hostel: { select: { id: true, kind: true, name: true } } } } } }),
      this.prisma.privateBooking.findFirst({ where: { studentId, semesterId: semester.id, status: 'ACCEPTED' }, select: { roomType: { select: { hostel: { select: { id: true, kind: true, name: true } } } } } }),
    ]);
    return { semesterId: semester.id, hostels: [alloc?.room.hostel, booking?.roomType.hostel].filter(Boolean) as Array<{ id: string; kind: string; name: string }> };
  }

  async mine(user: AuthUser) {
    const { semesterId, hostels } = await this.placements(user.id);
    if (!semesterId || !hostels.length) return { forms: [] };
    const university = hostels.some((h) => h.kind === 'UNIVERSITY');
    const templates = await this.prisma.hostelFormTemplate.findMany({
      where: { isActive: true, OR: [{ hostelId: { in: hostels.map((h) => h.id) } }, ...(university ? [{ hostelId: null }] : [])] },
      select: { id: true, title: true, description: true, documentId: true, hostel: { select: { name: true } }, submissions: { where: { studentId: user.id, semesterId }, select: { id: true, status: true, note: true, documentId: true, updatedAt: true } } },
    });
    return { forms: templates.map(({ submissions, ...t }) => ({ ...t, hostelName: t.hostel?.name ?? 'University halls', submission: submissions[0] ?? null })) };
  }

  async submit(user: AuthUser, templateId: string, documentId: string) {
    const { semesterId, hostels } = await this.placements(user.id);
    const t = await this.prisma.hostelFormTemplate.findUnique({ where: { id: templateId } });
    const applies = t?.isActive && semesterId && (t.hostelId ? hostels.some((h) => h.id === t.hostelId) : hostels.some((h) => h.kind === 'UNIVERSITY'));
    if (!t || !applies) throw new NotFoundException({ code: 'NOT_FOUND', message: 'This form is not for your hostel.' });
    const doc = await this.prisma.storedDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.uploadedById !== user.id || doc.purpose !== 'HOSTEL_FORM_SUBMISSION' || !doc.publicId.includes(`/${templateId}/`)) throw new BadRequestException({ code: 'DOCUMENT', message: 'Upload your signed form first.' });
    const existing = await this.prisma.hostelFormSubmission.findUnique({ where: { templateId_studentId_semesterId: { templateId, studentId: user.id, semesterId: semesterId! } } });
    if (existing?.status === 'ACCEPTED') throw new ConflictException({ code: 'ACCEPTED', message: 'This form has already been accepted.' });
    const sub = await this.prisma.hostelFormSubmission.upsert({
      where: { templateId_studentId_semesterId: { templateId, studentId: user.id, semesterId: semesterId! } },
      create: { templateId, studentId: user.id, semesterId: semesterId!, documentId },
      update: { documentId, status: 'SUBMITTED', note: null, reviewedAt: null, reviewedById: null },
    });
    await this.audit.record({ action: 'accommodation.form_submitted', module: 'accommodation', targetType: 'HostelFormSubmission', targetId: sub.id, metadata: { form: t.title } });
    return sub;
  }

  // ----- Hostel Manager and owners -----

  async review(user: AuthUser, submissionId: string, accept: boolean, note?: string) {
    const s = await this.scope(user);
    const sub = await this.prisma.hostelFormSubmission.findUnique({ where: { id: submissionId }, include: { template: { include: { hostel: { select: { id: true, kind: true } } } } } });
    if (!sub || !this.runs(s, sub.template.hostel)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Form not found.' });
    if (!accept && !note) throw new BadRequestException({ code: 'NOTE', message: 'Tell the student what to correct.' });
    await this.prisma.hostelFormSubmission.update({ where: { id: submissionId }, data: { status: accept ? 'ACCEPTED' : 'RETURNED', note: note || null, reviewedById: user.id, reviewedAt: new Date() } });
    await this.audit.record({ action: accept ? 'accommodation.form_accepted' : 'accommodation.form_returned', module: 'accommodation', targetType: 'HostelFormSubmission', targetId: submissionId, metadata: { note } });
    return { status: accept ? 'ACCEPTED' : 'RETURNED' };
  }

  /** Everyone placed this semester in the hostels this person runs: check-in state and forms. */
  async residents(user: AuthUser) {
    const s = await this.scope(user);
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!semester) return { residents: [] };
    const person = { select: { id: true, firstName: true, lastName: true, indexNumber: true, phone: true } };
    const checks = { checkedInAt: true, checkInNote: true, checkedOutAt: true, checkOutNote: true } as const;
    const [halls, privates] = await Promise.all([
      s.manager ? this.prisma.roomAllocation.findMany({ where: { semesterId: semester.id, status: 'ACCEPTED' }, orderBy: { room: { number: 'asc' } }, select: { id: true, ...checks, student: person, room: { select: { number: true, hostel: { select: { id: true, name: true } } } } } }) : [],
      s.ownerOf.length ? this.prisma.privateBooking.findMany({ where: { semesterId: semester.id, status: 'ACCEPTED', roomType: { hostelId: { in: s.ownerOf } } }, select: { id: true, ...checks, student: person, roomType: { select: { name: true, hostel: { select: { id: true, name: true } } } } } }) : [],
    ]);
    const studentIds = [...halls, ...privates].map((r) => r.student.id);
    const subs = await this.prisma.hostelFormSubmission.findMany({ where: { semesterId: semester.id, studentId: { in: studentIds } }, select: { id: true, studentId: true, status: true, note: true, documentId: true, template: { select: { title: true, hostelId: true } } } });
    const forms = (studentId: string) => subs.filter((x) => x.studentId === studentId);
    return {
      residents: [
        ...halls.map((r) => ({ kind: 'allocation' as const, id: r.id, hostel: r.room.hostel.name, place: `room ${r.room.number}`, student: r.student, checkedInAt: r.checkedInAt, checkInNote: r.checkInNote, checkedOutAt: r.checkedOutAt, checkOutNote: r.checkOutNote, forms: forms(r.student.id) })),
        ...privates.map((r) => ({ kind: 'booking' as const, id: r.id, hostel: r.roomType.hostel.name, place: r.roomType.name, student: r.student, checkedInAt: r.checkedInAt, checkInNote: r.checkInNote, checkedOutAt: r.checkedOutAt, checkOutNote: r.checkOutNote, forms: forms(r.student.id) })),
      ],
    };
  }

  async check(user: AuthUser, kind: 'allocation' | 'booking', id: string, action: 'in' | 'out', note?: string) {
    const s = await this.scope(user);
    const now = new Date();
    if (kind === 'allocation') {
      if (!s.manager) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'Only the Hostel Manager checks students into university halls.' });
      const a = await this.prisma.roomAllocation.findUnique({ where: { id }, select: { status: true, checkedInAt: true, checkedOutAt: true } });
      this.assertCheck(a, action);
      await this.prisma.roomAllocation.update({ where: { id }, data: action === 'in' ? { checkedInAt: now, checkedInById: user.id, checkInNote: note || null } : { checkedOutAt: now, checkedOutById: user.id, checkOutNote: note || null } });
    } else {
      const b = await this.prisma.privateBooking.findUnique({ where: { id }, select: { status: true, checkedInAt: true, checkedOutAt: true, roomType: { select: { hostelId: true } } } });
      if (!b || !s.ownerOf.includes(b.roomType.hostelId)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Booking not found.' });
      this.assertCheck(b, action);
      await this.prisma.privateBooking.update({ where: { id }, data: action === 'in' ? { checkedInAt: now, checkedInById: user.id, checkInNote: note || null } : { checkedOutAt: now, checkedOutById: user.id, checkOutNote: note || null } });
    }
    await this.audit.record({ action: action === 'in' ? 'accommodation.checked_in' : 'accommodation.checked_out', module: 'accommodation', targetType: kind === 'allocation' ? 'RoomAllocation' : 'PrivateBooking', targetId: id, metadata: { note } });
    return { ok: true };
  }

  private assertCheck(p: { status: string; checkedInAt: Date | null; checkedOutAt: Date | null } | null, action: 'in' | 'out') {
    if (!p || p.status !== 'ACCEPTED') throw new ConflictException({ code: 'NOT_PLACED', message: 'This student does not have this place.' });
    if (action === 'in' && p.checkedInAt) throw new ConflictException({ code: 'IN', message: 'Already checked in.' });
    if (action === 'out' && !p.checkedInAt) throw new ConflictException({ code: 'NOT_IN', message: 'Check the student in first.' });
    if (action === 'out' && p.checkedOutAt) throw new ConflictException({ code: 'OUT', message: 'Already checked out.' });
  }
}
