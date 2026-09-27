import { Injectable, Logger } from '@nestjs/common';
import { ROLE_LOG_GROUP, RoleKey } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RequestContext } from '../../core/context/request-context';
import { Prisma } from '../../generated/prisma/client';

export interface AuditInput {
  action: string;
  module: string;
  targetType?: string;
  targetId?: string;
  result?: 'SUCCESS' | 'FAILURE';
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  /** Override the actor when there is no signed-in user yet (for example, login). */
  actor?: { id: string; label: string; roleKey: string | null };
}

const SECRET_FIELDS = new Set(['passwordHash', 'secretEncrypted', 'refreshTokenHash', 'codeHash', 'tokenHash', 'setupUrl', 'password']);

function scrub(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (k, v) => (SECRET_FIELDS.has(k) ? '[hidden]' : typeof v === 'bigint' ? v.toString() : v)),
  );
}

/** Appends to the audit log. Never edits or deletes entries. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    const ctx = RequestContext.get();
    const roleKey = input.actor ? input.actor.roleKey : ctx?.activeRoleKey ?? null;
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actor?.id ?? ctx?.userId,
          actorLabel: input.actor?.label ?? ctx?.userLabel,
          actorRoleKey: roleKey,
          logGroup: roleKey ? ROLE_LOG_GROUP[roleKey as RoleKey] ?? null : null,
          action: input.action,
          module: input.module,
          targetType: input.targetType,
          targetId: input.targetId,
          result: input.result ?? 'SUCCESS',
          before: scrub(input.before),
          after: scrub(input.after),
          metadata: scrub(input.metadata),
          ipAddress: ctx?.ipAddress,
          userAgent: ctx?.userAgent,
          correlationId: ctx?.correlationId,
        },
      });
    } catch (err) {
      // An audit failure must be visible in server logs; it must not silently vanish.
      this.logger.error(`Audit write failed for ${input.action}: ${(err as Error).message}`);
      throw err;
    }
  }
}
