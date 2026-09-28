import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FeesService } from './fees.service';

/**
 * Hall fees for university hostels go on the student's semester fee bill, so they are paid, receipted
 * and shown on the statement like every other fee. The charge follows the room: the room's price while
 * the allocation is accepted, nothing otherwise. Each change is a separate adjustment linked to the
 * allocation, so moves and cancellations leave a clear trail.
 */
@Injectable()
export class HallChargesService {
  private readonly logger = new Logger(HallChargesService.name);

  constructor(private readonly prisma: PrismaService, private readonly fees: FeesService, private readonly audit: AuditService) {}

  async sync(allocationId: string, actorId: string) {
    const a = await this.prisma.roomAllocation.findUnique({
      where: { id: allocationId },
      select: { id: true, status: true, studentId: true, semesterId: true, cancelReason: true, room: { select: { number: true, pricePerSemester: true, hostel: { select: { name: true } } } } },
    });
    if (!a) return;
    const bill = await this.prisma.studentBill.findUnique({ where: { studentId_semesterId: { studentId: a.studentId, semesterId: a.semesterId } }, select: { id: true, currency: true } });
    // No bill yet: the charge is added when bills are issued (syncSemester).
    if (!bill) return;
    const charged = await this.prisma.feeAdjustment.aggregate({ where: { allocationId: a.id }, _sum: { amount: true } });
    const current = charged._sum.amount ?? 0;
    // Hall fees now live in the student's hostel fees account; any charge left on the tuition bill from before is credited back.
    const wanted = 0;
    if (wanted === current) return;
    if (bill.currency !== 'GHS') {
      // Room prices are in cedis; a dollar bill cannot take a cedi charge without an exchange rate.
      await this.audit.record({ action: 'fees.hall_fee_skipped', module: 'fees', targetType: 'StudentBill', targetId: bill.id, metadata: { reason: 'Bill is in US dollars; charge the hall fee separately', allocationId: a.id } });
      return;
    }
    const where = `${a.room.hostel.name}, room ${a.room.number}`;
    const reason = `Hall fees moved to your hostel fees account (${where})`;
    await this.prisma.feeAdjustment.create({ data: { billId: bill.id, amount: wanted - current, reason, allocationId: a.id, createdById: actorId } });
    await this.audit.record({ action: 'fees.hall_fee_charged', module: 'fees', targetType: 'StudentBill', targetId: bill.id, metadata: { allocationId: a.id, amount: wanted - current, where } });
    await this.fees.afterChange(bill.id, actorId);
  }

  /** After bills are issued: charge everyone who had already accepted a room. */
  async syncSemester(semesterId: string, actorId: string) {
    const allocations = await this.prisma.roomAllocation.findMany({ where: { semesterId, status: { in: ['ACCEPTED', 'CANCELLED'] } }, select: { id: true } });
    for (const a of allocations) await this.sync(a.id, actorId).catch((err) => this.logger.error(`Hall fee sync failed for ${a.id}: ${(err as Error).message}`));
    return allocations.length;
  }
}
