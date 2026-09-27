import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { AddCopiesDto, CatalogueQuery, CopyUpdateDto, TitleDto } from './dto/library.dto';

const searchText = (t: { title: string; authors: string[]; isbn?: string | null; callNumber?: string | null; subjects?: string[] }) =>
  [t.title, ...t.authors, t.isbn ?? '', t.callNumber ?? '', ...(t.subjects ?? [])].join(' ').toLowerCase();

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Search by any part of the title, author, ISBN, call number or subject. */
  async search(q: CatalogueQuery) {
    const words = (q.search ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    const where: Prisma.LibraryTitleWhereInput = {
      AND: words.map((w) => ({ searchText: { contains: w } })),
      ...(q.availableOnly === 'true' ? { copies: { some: { status: 'AVAILABLE', isReference: false } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.libraryTitle.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, title: true, subtitle: true, authors: true, isbn: true, publisher: true, year: true, edition: true, callNumber: true, subjects: true,
          copies: { select: { status: true, isReference: true } },
          _count: { select: { reservations: { where: { status: { in: ['WAITING', 'READY'] } } } } },
        },
      }),
      this.prisma.libraryTitle.count({ where }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: rows.map(({ copies, _count, ...t }) => ({
        ...t,
        copies: copies.length,
        lendable: copies.filter((c) => !c.isReference && !['LOST', 'WITHDRAWN'].includes(c.status)).length,
        available: copies.filter((c) => c.status === 'AVAILABLE' && !c.isReference).length,
        referenceOnly: copies.filter((c) => c.isReference).length,
        waiting: _count.reservations,
      })),
    };
  }

  async detail(id: string) {
    const title = await this.prisma.libraryTitle.findUnique({
      where: { id },
      include: {
        copies: {
          orderBy: { barcode: 'asc' },
          select: {
            id: true, barcode: true, shelf: true, isReference: true, status: true, notes: true,
            loans: { where: { status: 'ACTIVE' }, select: { dueAt: true, borrower: { select: { firstName: true, lastName: true, indexNumber: true, email: true } } } },
          },
        },
        reservations: {
          where: { status: { in: ['WAITING', 'READY'] } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, status: true, createdAt: true, expiresAt: true, borrower: { select: { firstName: true, lastName: true, indexNumber: true, email: true } } },
        },
      },
    });
    if (!title) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Title not found.' });
    return title;
  }

  async save(dto: TitleDto, id?: string) {
    const data = { ...dto, subjects: dto.subjects ?? [], searchText: searchText(dto) };
    try {
      const t = id ? await this.prisma.libraryTitle.update({ where: { id }, data }) : await this.prisma.libraryTitle.create({ data });
      await this.audit.record({ action: id ? 'library.title_updated' : 'library.title_added', module: 'library', targetType: 'LibraryTitle', targetId: t.id, after: { title: t.title, isbn: t.isbn } });
      return t;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'ISBN_EXISTS', message: 'A title with this ISBN is already in the catalogue. Add copies to it instead.' });
      throw err;
    }
  }

  async addCopies(titleId: string, dto: AddCopiesDto) {
    const barcodes = [...new Set(dto.barcodes.map((b) => b.toUpperCase()))];
    if (!barcodes.length) throw new BadRequestException({ code: 'NO_BARCODES', message: 'Enter at least one barcode.' });
    await this.detail(titleId);
    const taken = await this.prisma.libraryCopy.findMany({ where: { barcode: { in: barcodes } }, select: { barcode: true } });
    if (taken.length) throw new ConflictException({ code: 'BARCODE_TAKEN', message: `Already used: ${taken.map((t) => t.barcode).join(', ')}.` });
    await this.prisma.libraryCopy.createMany({ data: barcodes.map((barcode) => ({ titleId, barcode, shelf: dto.shelf ?? null, isReference: dto.isReference ?? false })) });
    await this.audit.record({ action: 'library.copies_added', module: 'library', targetType: 'LibraryTitle', targetId: titleId, metadata: { barcodes } });
    return { added: barcodes.length };
  }

  async updateCopy(id: string, dto: CopyUpdateDto) {
    const copy = await this.prisma.libraryCopy.findUnique({ where: { id } });
    if (!copy) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Copy not found.' });
    if (dto.status && ['ON_LOAN', 'ON_HOLD'].includes(copy.status)) {
      throw new ConflictException({ code: 'IN_USE', message: 'This copy is on loan or kept for a reservation. Return it at the desk first.' });
    }
    const updated = await this.prisma.libraryCopy.update({ where: { id }, data: dto });
    await this.audit.record({ action: 'library.copy_updated', module: 'library', targetType: 'LibraryCopy', targetId: id, before: copy, after: updated });
    return updated;
  }
}
