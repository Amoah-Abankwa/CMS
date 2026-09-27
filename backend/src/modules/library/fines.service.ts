import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { formatCedis } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { outstanding } from './circulation.service';
import { FinesQuery, PayFineDto } from './dto/library.dto';

@Injectable()
export class FinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: FinesQuery) {
    const where: Prisma.LibraryFineWhereInput = {
      ...(q.status === 'SETTLED' ? { settledAt: { not: null } } : q.status === 'ALL' ? {} : { settledAt: null }),
      ...(q.search
        ? { borrower: { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }, { email: { contains: q.search, mode: 'insensitive' as const } }] } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.libraryFine.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          borrower: { select: { id: true, firstName: true, lastName: true, indexNumber: true, email: true } },
          payments: { orderBy: { createdAt: 'asc' }, select: { amount: true, method: true, receiptNumber: true, note: true, createdAt: true } },
        },
      }),
      this.prisma.libraryFine.count({ where }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items: rows.map((f) => ({ ...f, outstanding: outstanding(f) })) };
  }

  /** Records money received at the desk. The receipt number ties it to the Finance Office's records. */
  async pay(user: AuthUser, id: string, dto: PayFineDto) {
    const fine = await this.load(id);
    const owed = outstanding(fine);
    if (dto.amount > owed) throw new BadRequestException({ code: 'TOO_MUCH', message: `Only ${formatCedis(owed)} is owed on this fine.` });
    await this.prisma.$transaction([
      this.prisma.finePayment.create({ data: { fineId: id, amount: dto.amount, method: dto.method, receiptNumber: dto.receiptNumber || null, recordedById: user.id } }),
      this.prisma.libraryFine.update({ where: { id }, data: { paid: { increment: dto.amount }, ...(dto.amount === owed ? { settledAt: new Date() } : {}) } }),
    ]);
    await this.audit.record({ action: 'library.fine_paid', module: 'library', targetType: 'LibraryFine', targetId: id, metadata: { amount: dto.amount, method: dto.method, receipt: dto.receiptNumber, borrower: fine.borrowerId } });
    return { remaining: owed - dto.amount };
  }

  async waive(user: AuthUser, id: string, reason: string, amount?: number) {
    const fine = await this.load(id);
    const owed = outstanding(fine);
    const waive = amount ?? owed;
    if (waive > owed) throw new BadRequestException({ code: 'TOO_MUCH', message: `Only ${formatCedis(owed)} is owed on this fine.` });
    await this.prisma.$transaction([
      this.prisma.finePayment.create({ data: { fineId: id, amount: waive, method: 'WAIVER', note: reason.trim(), recordedById: user.id } }),
      this.prisma.libraryFine.update({ where: { id }, data: { waived: { increment: waive }, ...(waive === owed ? { settledAt: new Date() } : {}) } }),
    ]);
    await this.audit.record({ action: 'library.fine_waived', module: 'library', targetType: 'LibraryFine', targetId: id, metadata: { amount: waive, reason, borrower: fine.borrowerId } });
    return { remaining: owed - waive };
  }

  private async load(id: string) {
    const fine = await this.prisma.libraryFine.findUnique({ where: { id } });
    if (!fine) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fine not found.' });
    if (fine.settledAt) throw new BadRequestException({ code: 'SETTLED', message: 'This fine is already settled.' });
    return fine;
  }
}
