import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_LIBRARY_POLICY, validateLibraryPolicy, type LibraryPolicy } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const KEY = 'library.policy';

@Injectable()
export class LibraryPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<LibraryPolicy> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value as Partial<LibraryPolicy>) ?? {};
    return { ...DEFAULT_LIBRARY_POLICY, ...stored, student: { ...DEFAULT_LIBRARY_POLICY.student, ...stored.student }, staff: { ...DEFAULT_LIBRARY_POLICY.staff, ...stored.staff } };
  }

  /** New loan lengths apply to loans issued or renewed afterwards; fine settings apply to fines charged afterwards. */
  async set(policy: LibraryPolicy) {
    const clean = { ...policy, closedDays: [...new Set(policy.closedDays)].sort() };
    const problems = validateLibraryPolicy(clean);
    if (problems.length) throw new BadRequestException({ code: 'POLICY_INVALID', message: problems[0], details: problems });
    const before = await this.get();
    await this.prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { ...clean } }, update: { value: { ...clean } } });
    await this.audit.record({ action: 'library.policy_changed', module: 'library', before, after: clean });
    return clean;
  }
}
