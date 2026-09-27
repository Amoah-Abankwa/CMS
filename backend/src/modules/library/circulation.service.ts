import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  BORROW_BLOCK_TEXT, borrowBlocks, daysOverdue, dueDate, formatCedis, overdueFine, RENEW_BLOCK_TEXT, renewBlock, type BorrowerKind, type LibraryPolicy,
} from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { LibraryPolicyService } from './library-policy.service';

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short' });
const short = (t: string) => (t.length > 40 ? `${t.slice(0, 37)}...` : t);
export const outstanding = (f: { amount: number; paid: number; waived: number }) => f.amount - f.paid - f.waived;

const BORROWER_SELECT = {
  id: true, type: true, status: true, firstName: true, lastName: true, indexNumber: true, email: true, phone: true,
  staffProfile: { select: { staffNumber: true } },
  studentProfile: { select: { programme: { select: { name: true } }, currentLevel: true } },
} satisfies Prisma.UserSelect;

/**
 * The circulation desk. Issue needs the borrower and the copy; return needs only the copy.
 * Returned copies go to the next reservation in the queue before going back on the shelf.
 */
@Injectable()
export class CirculationService implements OnModuleInit {
  private readonly logger = new Logger(CirculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly policy: LibraryPolicyService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.jobs.work(QUEUES.LIBRARY_HOURLY, () => this.hourly());
    await this.jobs.schedule(QUEUES.LIBRARY_HOURLY, '0 * * * *');
  }

  kind(type: string): BorrowerKind {
    if (type === 'STUDENT') return 'STUDENT';
    if (type === 'STAFF') return 'STAFF';
    throw new ForbiddenException({ code: 'NOT_A_BORROWER', message: 'Only students and staff can borrow from the library.' });
  }

  /** Finds borrowers by index number, staff number or email (exact), or by name. */
  async lookup(q: string) {
    const v = q.trim();
    const exact = await this.prisma.user.findMany({
      where: { type: { in: ['STUDENT', 'STAFF'] }, OR: [{ indexNumber: v.toUpperCase() }, { email: v.toLowerCase() }, { staffProfile: { staffNumber: v.toUpperCase() } }] },
      select: BORROWER_SELECT,
      take: 1,
    });
    if (exact.length) return exact;
    const words = v.split(/\s+/).filter(Boolean).slice(0, 3);
    return this.prisma.user.findMany({
      where: { type: { in: ['STUDENT', 'STAFF'] }, AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }] })) },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 10,
      select: BORROWER_SELECT,
    });
  }

  /** Everything the desk or the borrower needs: loans with estimated fines, reservations, fines, and any reason they cannot borrow. */
  async summary(borrowerId: string) {
    const policy = await this.policy.get();
    const borrower = await this.prisma.user.findUnique({ where: { id: borrowerId }, select: BORROWER_SELECT });
    if (!borrower) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Borrower not found.' });
    const kind = this.kind(borrower.type);
    const rules = kind === 'STUDENT' ? policy.student : policy.staff;
    const now = new Date();
    const [loans, reservations, fines] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId, status: 'ACTIVE' },
        orderBy: { dueAt: 'asc' },
        select: { id: true, issuedAt: true, dueAt: true, renewals: true, copy: { select: { barcode: true, title: { select: { id: true, title: true, authors: true } } } } },
      }),
      this.prisma.libraryReservation.findMany({
        where: { borrowerId, status: { in: ['WAITING', 'READY'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, status: true, createdAt: true, expiresAt: true, title: { select: { id: true, title: true } }, copy: { select: { barcode: true } } },
      }),
      this.prisma.libraryFine.findMany({ where: { borrowerId, settledAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, reason: true, amount: true, paid: true, waived: true, note: true, createdAt: true } }),
    ]);
    const reserved = new Set(
      (await this.prisma.libraryReservation.findMany({ where: { titleId: { in: loans.map((l) => l.copy.title.id) }, status: 'WAITING', borrowerId: { not: borrowerId } }, select: { titleId: true } })).map((r) => r.titleId),
    );
    // Position in each queue, for the borrower's own view.
    const positions = await Promise.all(
      reservations.map((r) => (r.status === 'WAITING' ? this.prisma.libraryReservation.count({ where: { titleId: r.title.id, status: 'WAITING', createdAt: { lte: r.createdAt } } }) : 0)),
    );
    const owed = fines.reduce((s, f) => s + outstanding(f), 0);
    const overdue = loans.filter((l) => l.dueAt < now);
    return {
      borrower: { ...borrower, kind },
      rules,
      policy: { finePerDay: policy.finePerDay, blockAtFines: policy.blockAtFines, holdDays: policy.holdDays, maxReservations: policy.maxReservations },
      loans: loans.map((l) => {
        const block = renewBlock(l, reserved.has(l.copy.title.id), rules, now);
        return {
          ...l,
          overdueDays: daysOverdue(l.dueAt, now),
          fineSoFar: overdueFine(l.dueAt, now, policy),
          canRenew: !block,
          renewBlock: block ? RENEW_BLOCK_TEXT[block] : null,
        };
      }),
      reservations: reservations.map((r, i) => ({ ...r, position: positions[i] })),
      fines: fines.map((f) => ({ ...f, outstanding: outstanding(f) })),
      owed,
      blocks: borrower.status !== 'ACTIVE'
        ? ['Account is not active']
        : borrowBlocks({ activeLoans: loans.length, overdueLoans: overdue.length, finesOwed: owed }, rules, policy).map((b) => BORROW_BLOCK_TEXT[b]),
    };
  }

  async issue(user: AuthUser, borrowerId: string, barcode: string) {
    const summary = await this.summary(borrowerId);
    if (summary.blocks.length) throw new ConflictException({ code: 'CANNOT_BORROW', message: `Cannot borrow: ${summary.blocks.join('; ')}.`, details: summary.blocks });
    const copy = await this.prisma.libraryCopy.findUnique({ where: { barcode }, include: { title: { select: { id: true, title: true } }, holds: { where: { status: 'READY' }, select: { id: true, borrowerId: true } } } });
    if (!copy) throw new NotFoundException({ code: 'NO_COPY', message: `No copy has the barcode ${barcode}.` });
    if (copy.isReference) throw new ConflictException({ code: 'REFERENCE', message: 'This is a reference copy and stays in the library.' });
    if (copy.status === 'ON_LOAN') throw new ConflictException({ code: 'ON_LOAN', message: 'This copy is still on loan. Return it first.' });
    if (['LOST', 'DAMAGED', 'WITHDRAWN'].includes(copy.status)) throw new ConflictException({ code: 'NOT_LENDABLE', message: `This copy is marked ${copy.status.toLowerCase()}.` });
    const hold = copy.holds[0];
    if (copy.status === 'ON_HOLD' && hold?.borrowerId !== borrowerId) throw new ConflictException({ code: 'HELD', message: 'This copy is kept for someone who reserved it.' });

    const policy = await this.policy.get();
    const due = dueDate(new Date(), summary.rules.loanDays, policy.closedDays);
    const loan = await this.prisma.$transaction(async (tx) => {
      // The status condition stops the same copy being issued twice at two desks.
      const claimed = await tx.libraryCopy.updateMany({ where: { id: copy.id, status: { in: ['AVAILABLE', 'ON_HOLD'] } }, data: { status: 'ON_LOAN' } });
      if (claimed.count !== 1) throw new ConflictException({ code: 'CHANGED', message: 'This copy was just issued at another desk.' });
      // Collecting a reservation, or borrowing a title the borrower was queued for, closes their reservation.
      await tx.libraryReservation.updateMany({ where: { borrowerId, titleId: copy.title.id, status: { in: ['WAITING', 'READY'] } }, data: { status: 'COLLECTED', closedAt: new Date() } });
      return tx.loan.create({ data: { copyId: copy.id, borrowerId, dueAt: due, issuedById: user.id } });
    });
    await this.audit.record({ action: 'library.issued', module: 'library', targetType: 'Loan', targetId: loan.id, metadata: { barcode, title: copy.title.title, borrower: summary.borrower.indexNumber ?? summary.borrower.email, due } });
    return { loan, title: copy.title.title, dueAt: due, borrower: summary.borrower };
  }

  async return(user: AuthUser, barcode: string) {
    const copy = await this.prisma.libraryCopy.findUnique({ where: { barcode }, include: { title: { select: { id: true, title: true } } } });
    if (!copy) throw new NotFoundException({ code: 'NO_COPY', message: `No copy has the barcode ${barcode}.` });
    const loan = await this.prisma.loan.findFirst({ where: { copyId: copy.id, status: { in: ['ACTIVE', 'LOST'] }, returnedAt: null }, include: { borrower: { select: { id: true, firstName: true, lastName: true, indexNumber: true, email: true } } } });
    if (!loan) throw new ConflictException({ code: 'NOT_ON_LOAN', message: 'This copy is not on loan.' });

    const policy = await this.policy.get();
    const now = new Date();
    const fine = loan.status === 'ACTIVE' ? overdueFine(loan.dueAt, now, policy) : 0;
    const days = daysOverdue(loan.dueAt, now);
    await this.prisma.$transaction(async (tx) => {
      await tx.loan.update({ where: { id: loan.id }, data: { status: loan.status === 'LOST' ? 'LOST' : 'RETURNED', returnedAt: now, returnedById: user.id } });
      if (fine > 0) {
        await tx.libraryFine.create({ data: { borrowerId: loan.borrowerId, loanId: loan.id, reason: 'OVERDUE', amount: fine, note: `Returned ${days} days late` } });
      }
    });
    const next = await this.releaseCopy(copy.id, copy.title.id, copy.title.title, policy);
    await this.audit.record({ action: 'library.returned', module: 'library', targetType: 'Loan', targetId: loan.id, metadata: { barcode, title: copy.title.title, daysLate: days, fine, heldFor: next?.borrowerId ?? null } });
    if (fine > 0) await this.notifyFine(loan.borrowerId, fine, `"${copy.title.title}" returned ${days} days late`, 'late return');
    return {
      title: copy.title.title,
      borrower: loan.borrower,
      daysLate: days,
      fine,
      foundAfterLost: loan.status === 'LOST',
      heldFor: next ? `${next.name}. Put it on the reservations shelf.` : null,
    };
  }

  async renew(loanId: string, by: { deskUser?: AuthUser; borrowerId?: string }) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId }, include: { borrower: { select: { type: true } }, copy: { select: { titleId: true, title: { select: { title: true } } } } } });
    if (!loan || loan.status !== 'ACTIVE' || (by.borrowerId && loan.borrowerId !== by.borrowerId)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Loan not found.' });
    const policy = await this.policy.get();
    const rules = this.kind(loan.borrower.type) === 'STUDENT' ? policy.student : policy.staff;
    const reserved = await this.prisma.libraryReservation.count({ where: { titleId: loan.copy.titleId, status: 'WAITING', borrowerId: { not: loan.borrowerId } } });
    const block = renewBlock(loan, reserved > 0, rules, new Date());
    if (block) throw new ConflictException({ code: block, message: `Cannot renew: ${RENEW_BLOCK_TEXT[block]}` });
    const due = dueDate(new Date(), rules.loanDays, policy.closedDays);
    const updated = await this.prisma.loan.update({ where: { id: loanId }, data: { dueAt: due, renewals: { increment: 1 }, dueReminderSentAt: null } });
    await this.audit.record({ action: by.deskUser ? 'library.renewed_at_desk' : 'library.renewed', module: 'library', targetType: 'Loan', targetId: loanId, metadata: { title: loan.copy.title.title, newDue: due, renewals: updated.renewals } });
    return { dueAt: due, renewalsLeft: rules.maxRenewals - updated.renewals };
  }

  /** The borrower says the book is lost: the replacement fee is charged and the copy is marked lost. */
  async lost(user: AuthUser, loanId: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId }, include: { copy: { include: { title: true } } } });
    if (!loan || loan.status !== 'ACTIVE') throw new NotFoundException({ code: 'NOT_FOUND', message: 'Active loan not found.' });
    const policy = await this.policy.get();
    await this.prisma.$transaction([
      this.prisma.loan.update({ where: { id: loanId }, data: { status: 'LOST' } }),
      this.prisma.libraryCopy.update({ where: { id: loan.copyId }, data: { status: 'LOST' } }),
      ...(policy.lostItemFee > 0 ? [this.prisma.libraryFine.create({ data: { borrowerId: loan.borrowerId, loanId, reason: 'LOST', amount: policy.lostItemFee, note: `Lost: ${loan.copy.title.title} (${loan.copy.barcode})` } })] : []),
    ]);
    await this.audit.record({ action: 'library.declared_lost', module: 'library', targetType: 'Loan', targetId: loanId, metadata: { barcode: loan.copy.barcode, fee: policy.lostItemFee } });
    if (policy.lostItemFee > 0) await this.notifyFine(loan.borrowerId, policy.lostItemFee, `"${loan.copy.title.title}" declared lost (replacement cost)`, 'lost book');
    return { fee: policy.lostItemFee };
  }

  /** Passes a copy that was being kept for someone to the next person queued, or back to the shelf. */
  async passOn(copyId: string) {
    const copy = await this.prisma.libraryCopy.findUniqueOrThrow({ where: { id: copyId }, include: { title: { select: { id: true, title: true } } } });
    if (copy.status !== 'ON_HOLD') return null;
    return this.releaseCopy(copy.id, copy.title.id, copy.title.title, await this.policy.get());
  }

  /** A copy coming back goes to the next person queued for its title, or back on the shelf. */
  private async releaseCopy(copyId: string, titleId: string, titleText: string, policy: LibraryPolicy) {
    const next = await this.prisma.libraryReservation.findFirst({
      where: { titleId, status: 'WAITING', borrower: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
      include: { borrower: { select: { firstName: true, lastName: true } } },
    });
    if (!next) {
      await this.prisma.libraryCopy.update({ where: { id: copyId }, data: { status: 'AVAILABLE' } });
      return null;
    }
    const until = dueDate(new Date(), policy.holdDays, policy.closedDays);
    await this.prisma.$transaction([
      this.prisma.libraryReservation.update({ where: { id: next.id }, data: { status: 'READY', copyId, readyAt: new Date(), expiresAt: until } }),
      this.prisma.libraryCopy.update({ where: { id: copyId }, data: { status: 'ON_HOLD' } }),
    ]);
    await this.notifications.notify({
      eventKey: EVENT_KEYS.LIBRARY_HOLD_READY,
      recipients: [{ userId: next.borrowerId }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { title: titleText, shortTitle: short(titleText), until: fmtDay(until) },
      link: '/library',
    });
    return { borrowerId: next.borrowerId, name: `${next.borrower.firstName} ${next.borrower.lastName}` };
  }

  async notifyFine(borrowerId: string, amount: number, reason: string, reasonShort: string) {
    const policy = await this.policy.get();
    const fines = await this.prisma.libraryFine.findMany({ where: { borrowerId, settledAt: null }, select: { amount: true, paid: true, waived: true } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.LIBRARY_FINE,
      recipients: [{ userId: borrowerId }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { amount: formatCedis(amount), reason, reasonShort, owed: formatCedis(fines.reduce((s, f) => s + outstanding(f), 0)), blockAt: formatCedis(policy.blockAtFines) },
      link: '/library',
    });
  }

  /**
   * Runs every hour. Reminders go out only between 07:00 and 20:00 so nobody gets an SMS at night;
   * expired reservations are handled at any hour.
   */
  async hourly() {
    const policy = await this.policy.get();
    const now = new Date();
    try {
      const expired = await this.prisma.libraryReservation.findMany({ where: { status: 'READY', expiresAt: { lt: now } }, include: { title: true } });
      for (const r of expired) {
        await this.prisma.libraryReservation.update({ where: { id: r.id }, data: { status: 'EXPIRED', closedAt: now } });
        await this.notifications.notify({
          eventKey: EVENT_KEYS.LIBRARY_HOLD_EXPIRED,
          recipients: [{ userId: r.borrowerId }],
          channels: ['IN_APP', 'EMAIL'],
          sharedVars: { title: r.title.title, shortTitle: short(r.title.title), until: r.expiresAt ? fmtDay(r.expiresAt) : '' },
          link: '/library',
        });
        if (r.copyId) await this.releaseCopy(r.copyId, r.titleId, r.title.title, policy);
      }
    } catch (err) {
      this.logger.error(`Reservation expiry failed: ${(err as Error).message}`);
    }

    if (now.getUTCHours() < 7 || now.getUTCHours() >= 20) return;
    try {
      const soon = await this.prisma.loan.findMany({
        where: { status: 'ACTIVE', dueReminderSentAt: null, dueAt: { gt: now, lte: new Date(now.getTime() + policy.dueReminderDays * 86_400_000) } },
        include: { copy: { include: { title: true } } },
      });
      for (const l of soon) {
        await this.notifications.notify({
          eventKey: EVENT_KEYS.LIBRARY_DUE_SOON,
          recipients: [{ userId: l.borrowerId }],
          channels: ['IN_APP', 'EMAIL', 'SMS'],
          sharedVars: { title: l.copy.title.title, shortTitle: short(l.copy.title.title), due: fmtDay(l.dueAt) },
          link: '/library',
        });
        await this.prisma.loan.update({ where: { id: l.id }, data: { dueReminderSentAt: now } });
      }

      // Overdue: the day after it is due, then weekly, at most three times.
      const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
      const overdue = await this.prisma.loan.findMany({
        where: { status: 'ACTIVE', dueAt: { lt: now }, overdueNoticeCount: { lt: 3 }, OR: [{ lastOverdueNoticeAt: null }, { lastOverdueNoticeAt: { lt: weekAgo } }] },
        include: { copy: { include: { title: true } } },
      });
      for (const l of overdue) {
        const days = daysOverdue(l.dueAt, now);
        if (days < 1) continue;
        const fine = overdueFine(l.dueAt, now, policy);
        await this.notifications.notify({
          eventKey: EVENT_KEYS.LIBRARY_OVERDUE,
          recipients: [{ userId: l.borrowerId }],
          channels: ['IN_APP', 'EMAIL', 'SMS'],
          sharedVars: {
            title: l.copy.title.title, shortTitle: short(l.copy.title.title), due: fmtDay(l.dueAt), days,
            fineLine: fine ? ` The fine so far is ${formatCedis(fine)} and grows each day until it is returned.` : '',
            smsFine: fine ? ` Fine so far ${formatCedis(fine)}.` : '',
          },
          link: '/library',
        });
        await this.prisma.loan.update({ where: { id: l.id }, data: { overdueNoticeCount: { increment: 1 }, lastOverdueNoticeAt: now } });
      }
    } catch (err) {
      this.logger.error(`Library reminders failed: ${(err as Error).message}`);
    }
  }

  async overdueList() {
    const policy = await this.policy.get();
    const now = new Date();
    const loans = await this.prisma.loan.findMany({
      where: { status: 'ACTIVE', dueAt: { lt: now } },
      orderBy: { dueAt: 'asc' },
      select: {
        id: true, dueAt: true, overdueNoticeCount: true,
        copy: { select: { barcode: true, title: { select: { title: true } } } },
        borrower: { select: { id: true, type: true, firstName: true, lastName: true, indexNumber: true, email: true, phone: true } },
      },
    });
    return loans.map((l) => ({ ...l, days: daysOverdue(l.dueAt, now), fineSoFar: overdueFine(l.dueAt, now, policy) }));
  }

  holdsShelf() {
    return this.prisma.libraryReservation.findMany({
      where: { status: 'READY' },
      orderBy: { expiresAt: 'asc' },
      select: {
        id: true, readyAt: true, expiresAt: true,
        copy: { select: { barcode: true } },
        title: { select: { title: true } },
        borrower: { select: { firstName: true, lastName: true, indexNumber: true, email: true } },
      },
    });
  }

  async stats() {
    const now = new Date();
    const [titles, copies, onLoan, overdue, waiting, ready, fines] = await Promise.all([
      this.prisma.libraryTitle.count(),
      this.prisma.libraryCopy.count({ where: { status: { notIn: ['WITHDRAWN', 'LOST'] } } }),
      this.prisma.loan.count({ where: { status: 'ACTIVE' } }),
      this.prisma.loan.count({ where: { status: 'ACTIVE', dueAt: { lt: now } } }),
      this.prisma.libraryReservation.count({ where: { status: 'WAITING' } }),
      this.prisma.libraryReservation.count({ where: { status: 'READY' } }),
      this.prisma.libraryFine.findMany({ where: { settledAt: null }, select: { amount: true, paid: true, waived: true } }),
    ]);
    return { titles, copies, onLoan, overdue, waiting, ready, finesOwed: fines.reduce((s, f) => s + outstanding(f), 0) };
  }
}
