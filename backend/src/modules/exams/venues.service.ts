import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { VenueDto } from './dto/exams.dto';

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.examVenue.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  }

  async save(dto: VenueDto, id?: string) {
    try {
      const venue = id
        ? await this.prisma.examVenue.update({ where: { id }, data: dto })
        : await this.prisma.examVenue.create({ data: { ...dto, isActive: dto.isActive ?? true } });
      await this.audit.record({ action: id ? 'exams.venue_updated' : 'exams.venue_created', module: 'exams', targetType: 'ExamVenue', targetId: venue.id, after: venue });
      return venue;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'VENUE_EXISTS', message: 'A venue with this name already exists.' });
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new NotFoundException({ code: 'NOT_FOUND', message: 'Venue not found.' });
      throw err;
    }
  }
}
