import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { ExcusesService } from './excuses.service';

type Category = 'MEDICAL' | 'BEREAVEMENT' | 'OFFICIAL_DUTY' | 'OTHER';
const SELECT = {
  id: true, fromDate: true, toDate: true, category: true, statement: true, status: true, decisionNote: true, decidedAt: true, createdAt: true,
  document: { select: { id: true, originalName: true } },
  student: { select: { id: true, firstName: true, lastName: true, indexNumber: true } },
} as const;

/**
 * Students ask to be excused, attaching evidence (a medical note, a funeral programme...). Staff who
 * handle excuses approve or decline; approving records the excuse, which corrects class attendance and
 * morning devotion for those dates.
 */
@Injectable()
export class ExcuseRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly excuses: ExcusesService, private readonly audit: AuditService) {}

  mine(user: AuthUser) {
    return this.prisma.excuseRequest.findMany({ where: { studentId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, select: SELECT });
  }

  async request(user: AuthUser, dto: { fromDate: string; toDate: string; category: Category; statement: string; documentId?: string }) {
    if (user.type !== 'STUDENT') throw new BadRequestException({ code: 'STUDENTS_ONLY', message: 'Students request excuses.' });
    const from = new Date(`${dto.fromDate.slice(0, 10)}T00:00:00Z`);
    const to = new Date(`${dto.toDate.slice(0, 10)}T00:00:00Z`);
    if (to < from) throw new BadRequestException({ code: 'DATES', message: 'The end date must be on or after the start date.' });
    if ((to.getTime() - from.getTime()) / 86_400_000 > 60) throw new BadRequestException({ code: 'TOO_LONG', message: 'Ask for at most 60 days at a time.' });
    if (from.getTime() < Date.now() - 60 * 86_400_000) throw new BadRequestException({ code: 'TOO_OLD', message: 'Requests must be made within 60 days. Contact the Health Centre or the Dean of Students office.' });
    if (dto.category === 'MEDICAL' && !dto.documentId) throw new BadRequestException({ code: 'DOCUMENT', message: 'Attach your medical note.' });
    if (dto.documentId) {
      const doc = await this.prisma.storedDocument.findUnique({ where: { id: dto.documentId } });
      if (!doc || doc.uploadedById !== user.id || doc.purpose !== 'EXCUSE') throw new BadRequestException({ code: 'DOCUMENT', message: 'Upload the document first.' });
    }
    const r = await this.prisma.excuseRequest.create({ data: { studentId: user.id, fromDate: from, toDate: to, category: dto.category, statement: dto.statement, documentId: dto.documentId ?? null } });
    await this.audit.record({ action: 'attendance.excuse_requested', module: 'attendance', targetType: 'ExcuseRequest', targetId: r.id, metadata: { from: dto.fromDate, to: dto.toDate, category: dto.category } });
    return r;
  }

  async withdraw(user: AuthUser, id: string) {
    const r = await this.prisma.excuseRequest.findUnique({ where: { id } });
    if (!r || r.studentId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found.' });
    if (r.status !== 'REQUESTED') throw new ConflictException({ code: 'DECIDED', message: 'This request has already been decided.' });
    await this.prisma.excuseRequest.update({ where: { id }, data: { status: 'WITHDRAWN' } });
    return { ok: true };
  }

  list(status?: string) {
    return this.prisma.excuseRequest.findMany({ where: status ? { status: status as never } : {}, orderBy: { createdAt: 'desc' }, take: 200, select: SELECT });
  }

  async decide(user: AuthUser, id: string, approve: boolean, note?: string) {
    const r = await this.prisma.excuseRequest.findUnique({ where: { id }, include: { student: { select: { indexNumber: true } } } });
    if (!r) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found.' });
    if (r.status !== 'REQUESTED') throw new ConflictException({ code: 'DECIDED', message: 'This request has already been decided.' });
    if (!approve && !note) throw new BadRequestException({ code: 'NOTE', message: 'Tell the student why.' });
    let excuseId: string | null = null;
    if (approve) {
      const out = await this.excuses.record(user, { indexNumber: r.student.indexNumber!, fromDate: r.fromDate.toISOString(), toDate: r.toDate.toISOString(), category: r.category, note: `Student request: ${r.statement}`.slice(0, 500) });
      excuseId = out.excuse.id;
    }
    await this.prisma.excuseRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'DECLINED', decisionNote: note || null, decidedById: user.id, decidedAt: new Date(), excuseId } });
    await this.audit.record({ action: approve ? 'attendance.excuse_request_approved' : 'attendance.excuse_request_declined', module: 'attendance', targetType: 'ExcuseRequest', targetId: id, metadata: { note } });
    return { status: approve ? 'APPROVED' : 'DECLINED' };
  }
}
