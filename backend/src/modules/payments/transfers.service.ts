import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { formatCedis, MOMO_BANK_CODE, PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { PaymentsService } from './payments.service';

export type TransferPurpose = 'VENDOR' | 'DISPATCHER' | 'ASSOCIATION' | 'HOSTEL_OWNER' | 'PAYROLL';
export interface TransferTarget {
  /** Where the money goes: the payee's mobile money details and what they are owed now. */
  recipient(subjectId: string, meta: Record<string, string | undefined>): Promise<{ network: string | null; number: string | null; name: string | null; owed: number; label: string }>;
  /** Records the payout in the settlement once the transfer succeeds. */
  record(actorId: string, subjectId: string, amount: number, reference: string, meta: Record<string, string | undefined>): Promise<void>;
}

const PERMISSION: Record<TransferPurpose, string> = { VENDOR: PERMISSIONS.MARKETPLACE_MANAGE, DISPATCHER: PERMISSIONS.MARKETPLACE_MANAGE, ASSOCIATION: PERMISSIONS.FEES_MANAGE, HOSTEL_OWNER: PERMISSIONS.FEES_MANAGE, PAYROLL: PERMISSIONS.PAYROLL_MANAGE };

/**
 * Payouts sent through Paystack Transfers. Each settlement area registers how to find the payee and
 * how to record the payout; the payout record is created only when the transfer succeeds.
 */
@Injectable()
export class TransfersService implements OnModuleInit {
  private readonly logger = new Logger(TransfersService.name);
  private readonly targets = new Map<TransferPurpose, TransferTarget>();

  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentsService, private readonly resolver: PermissionResolverService, private readonly audit: AuditService) {}

  onModuleInit() {
    this.payments.onTransferEvent((reference, ok, reason) => this.complete(reference, ok, reason));
  }

  register(purpose: TransferPurpose, target: TransferTarget) {
    this.targets.set(purpose, target);
  }

  private async assertAllowed(user: AuthUser, purpose: TransferPurpose) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(PERMISSION[purpose])) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'You cannot send this payout.' });
  }

  async send(user: AuthUser, dto: { purpose: TransferPurpose; subjectId: string; amount: number; periodFrom?: string; periodTo?: string }) {
    await this.assertAllowed(user, dto.purpose);
    const target = this.targets.get(dto.purpose);
    if (!target) throw new BadRequestException({ code: 'UNSUPPORTED', message: 'Automatic payouts are not available for this.' });
    const meta = { periodFrom: dto.periodFrom, periodTo: dto.periodTo };
    const r = await target.recipient(dto.subjectId, meta);
    if (!r.network || !r.number || !r.name || !MOMO_BANK_CODE[r.network]) throw new BadRequestException({ code: 'NO_PAYOUT', message: `${r.label} has no mobile money payout number set.` });
    if (dto.amount > r.owed) throw new BadRequestException({ code: 'TOO_MUCH', message: `Only ${formatCedis(r.owed)} is owed to ${r.label}.` });
    if (await this.prisma.transfer.count({ where: { purpose: dto.purpose, subjectId: dto.subjectId, status: 'PENDING' } })) {
      throw new ConflictException({ code: 'PENDING', message: 'A transfer to this payee is still being processed.' });
    }
    const reference = `ANU-T-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const t = await this.prisma.transfer.create({ data: { purpose: dto.purpose, subjectId: dto.subjectId, amount: dto.amount, network: r.network, number: r.number, name: r.name, reference, meta, createdById: user.id } });
    await this.audit.record({ action: 'payments.transfer_started', module: 'payments', targetType: 'Transfer', targetId: t.id, metadata: { purpose: dto.purpose, to: r.label, amount: dto.amount } });
    const res = await this.payments.paymentProvider.transfer({ amount: dto.amount, bankCode: MOMO_BANK_CODE[r.network], number: r.number, name: r.name, reference, reason: `ANU payout: ${r.label}` });
    await this.prisma.transfer.update({ where: { id: t.id }, data: { transferCode: res.transferCode ?? null } });
    if (res.status !== 'pending') await this.complete(reference, res.status === 'success', res.message);
    return this.prisma.transfer.findUniqueOrThrow({ where: { id: t.id } });
  }

  /** Applies a transfer's outcome once (from the immediate response or Paystack's webhook). */
  async complete(reference: string, ok: boolean, reason?: string) {
    const t = await this.prisma.transfer.findUnique({ where: { reference } });
    if (!t) return;
    const moved = await this.prisma.transfer.updateMany({ where: { id: t.id, status: 'PENDING' }, data: { status: ok ? 'SUCCEEDED' : 'FAILED', failureReason: ok ? null : reason ?? 'Failed', completedAt: new Date() } });
    if (moved.count !== 1) return;
    await this.audit.record({ action: ok ? 'payments.transfer_succeeded' : 'payments.transfer_failed', module: 'payments', result: ok ? 'SUCCESS' : 'FAILURE', targetType: 'Transfer', targetId: t.id, actor: { id: t.createdById, label: 'Paystack', roleKey: null }, metadata: { amount: t.amount, reason } });
    if (ok) {
      try {
        await this.targets.get(t.purpose as TransferPurpose)?.record(t.createdById, t.subjectId, t.amount, t.reference, (t.meta ?? {}) as Record<string, string | undefined>);
      } catch (err) {
        this.logger.error(`Transfer ${t.reference} succeeded but the payout could not be recorded: ${(err as Error).message}`);
      }
    }
  }

  async list(user: AuthUser, purpose: TransferPurpose) {
    await this.assertAllowed(user, purpose);
    return this.prisma.transfer.findMany({ where: { purpose }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, subjectId: true, amount: true, name: true, number: true, network: true, reference: true, status: true, failureReason: true, createdAt: true, completedAt: true } });
  }
}
