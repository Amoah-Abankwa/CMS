import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_DEVOTION_POLICY, validateDevotionPolicy, type DevotionPolicy } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const KEY = 'devotion.policy';

@Injectable()
export class DevotionPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<DevotionPolicy> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    return { ...DEFAULT_DEVOTION_POLICY, ...((row?.value as Partial<DevotionPolicy>) ?? {}) };
  }

  /** New times apply to services created afterwards; the marks settings apply to every score. */
  async set(policy: DevotionPolicy) {
    const clean = { ...policy, days: [...new Set(policy.days)].sort() };
    const problems = validateDevotionPolicy(clean);
    if (problems.length) throw new BadRequestException({ code: 'POLICY_INVALID', message: problems[0], details: problems });
    const before = await this.get();
    await this.prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { ...clean } }, update: { value: { ...clean } } });
    await this.audit.record({ action: 'devotion.policy_changed', module: 'devotion', before, after: clean });
    return clean;
  }
}
