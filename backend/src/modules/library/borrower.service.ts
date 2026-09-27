import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { CirculationService } from './circulation.service';
import { LibraryPolicyService } from './library-policy.service';

/** A student's or staff member's own library account. */
@Injectable()
export class BorrowerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circulation: CirculationService,
    private readonly policy: LibraryPolicyService,
    private readonly audit: AuditService,
  ) {}

  mine(user: AuthUser) {
    this.circulation.kind(user.type);
    return this.circulation.summary(user.id);
  }

  renew(user: AuthUser, loanId: string) {
    this.circulation.kind(user.type);
    return this.circulation.renew(loanId, { borrowerId: user.id });
  }

  /** Reserving is for titles with no copy on the shelf; otherwise the borrower is told to come and borrow it. */
  async reserve(user: AuthUser, titleId: string) {
    this.circulation.kind(user.type);
    const policy = await this.policy.get();
    const title = await this.prisma.libraryTitle.findUnique({ where: { id: titleId }, include: { copies: { select: { status: true, isReference: true } } } });
    if (!title) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Title not found.' });
    const lendable = title.copies.filter((c) => !c.isReference && !['LOST', 'WITHDRAWN'].includes(c.status));
    if (!lendable.length) throw new ConflictException({ code: 'NOT_LENDABLE', message: 'This title has no copies that can be borrowed. Read it in the library.' });
    if (lendable.some((c) => c.status === 'AVAILABLE')) throw new ConflictException({ code: 'ON_SHELF', message: 'A copy is on the shelf now. Borrow it at the desk.' });

    const [mineOpen, alreadyQueued, holding] = await Promise.all([
      this.prisma.libraryReservation.count({ where: { borrowerId: user.id, status: { in: ['WAITING', 'READY'] } } }),
      this.prisma.libraryReservation.count({ where: { borrowerId: user.id, titleId, status: { in: ['WAITING', 'READY'] } } }),
      this.prisma.loan.count({ where: { borrowerId: user.id, status: 'ACTIVE', copy: { titleId } } }),
    ]);
    if (alreadyQueued) throw new ConflictException({ code: 'ALREADY', message: 'You have already reserved this title.' });
    if (holding) throw new ConflictException({ code: 'HAVE_IT', message: 'You already have a copy of this title.' });
    if (mineOpen >= policy.maxReservations) throw new ConflictException({ code: 'TOO_MANY', message: `You can have at most ${policy.maxReservations} reservations at a time.` });

    const r = await this.prisma.libraryReservation.create({ data: { titleId, borrowerId: user.id } });
    const position = await this.prisma.libraryReservation.count({ where: { titleId, status: 'WAITING', createdAt: { lte: r.createdAt } } });
    await this.audit.record({ action: 'library.reserved', module: 'library', targetType: 'LibraryTitle', targetId: titleId, metadata: { position } });
    return { position };
  }

  async cancelReservation(user: AuthUser, id: string) {
    const r = await this.prisma.libraryReservation.findFirst({ where: { id, borrowerId: user.id, status: { in: ['WAITING', 'READY'] } }, include: { title: true } });
    if (!r) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reservation not found.' });
    await this.prisma.libraryReservation.update({ where: { id }, data: { status: 'CANCELLED', closedAt: new Date() } });
    await this.audit.record({ action: 'library.reservation_cancelled', module: 'library', targetType: 'LibraryReservation', targetId: id });
    // A copy that was being kept goes to the next person, or back on the shelf.
    if (r.status === 'READY' && r.copyId) await this.circulation.passOn(r.copyId);
    return { ok: true };
  }
}
