import { Injectable } from '@nestjs/common';
import { LOG_GROUP_LABELS, LOG_GROUPS, LogGroup } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AdminAuditQueryDto, MyAuditQueryDto } from './dto/audit-query.dto';

const SELECT = {
  id: true,
  occurredAt: true,
  actorId: true,
  actorLabel: true,
  actorRoleKey: true,
  logGroup: true,
  action: true,
  module: true,
  targetType: true,
  targetId: true,
  result: true,
  ipAddress: true,
  userAgent: true,
  correlationId: true,
  before: true,
  after: true,
  metadata: true,
} satisfies Prisma.AuditLogSelect;

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private where(q: AdminAuditQueryDto | MyAuditQueryDto, extra: Prisma.AuditLogWhereInput = {}): Prisma.AuditLogWhereInput {
    const admin = q as AdminAuditQueryDto;
    return {
      ...extra,
      ...(q.from || q.to ? { occurredAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } } : {}),
      ...(q.action ? { action: { contains: q.action, mode: 'insensitive' as const } } : {}),
      ...(q.module ? { module: q.module } : {}),
      ...(admin.group ? { logGroup: admin.group } : {}),
      ...(admin.actorId ? { actorId: admin.actorId } : {}),
      ...(admin.result ? { result: admin.result } : {}),
      ...(admin.ipAddress ? { ipAddress: admin.ipAddress } : {}),
      ...(q.search
        ? { OR: [{ actorLabel: { contains: q.search, mode: 'insensitive' as const } }, { action: { contains: q.search, mode: 'insensitive' as const } }] }
        : {}),
    };
  }

  async list(q: AdminAuditQueryDto | MyAuditQueryDto, extra: Prisma.AuditLogWhereInput = {}) {
    const where = this.where(q, extra);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { occurredAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: SELECT }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async groupSummary(from?: string, to?: string) {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['logGroup'],
      where: from || to ? { occurredAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } : {},
      _count: { _all: true },
    });
    const counts = new Map(rows.map((r) => [r.logGroup, r._count._all]));
    const groups = (Object.values(LOG_GROUPS) as LogGroup[]).map((g) => ({ group: g, label: LOG_GROUP_LABELS[g], count: counts.get(g) ?? 0 }));
    // Entries with no actor role, such as failed sign-ins for unknown accounts.
    return { groups, unattributed: counts.get(null) ?? 0 };
  }

  /** CSV export, capped at 10,000 rows per file. */
  async exportCsv(q: AdminAuditQueryDto | MyAuditQueryDto, extra: Prisma.AuditLogWhereInput = {}): Promise<string> {
    const rows = await this.prisma.auditLog.findMany({ where: this.where(q, extra), orderBy: { occurredAt: 'desc' }, take: 10_000, select: SELECT });
    const header = ['Time (UTC)', 'Actor', 'Role', 'Group', 'Module', 'Action', 'Target', 'Result', 'IP address', 'Reference'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [r.occurredAt.toISOString(), r.actorLabel, r.actorRoleKey, r.logGroup, r.module, r.action, r.targetType ? `${r.targetType}:${r.targetId}` : '', r.result, r.ipAddress, r.correlationId]
        .map(esc)
        .join(','),
    );
    return [header.map(esc).join(','), ...lines].join('\n');
  }
}
