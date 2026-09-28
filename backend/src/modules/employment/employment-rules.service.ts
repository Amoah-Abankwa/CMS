import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_EMPLOYMENT_RULES, validateEmploymentRules, type EmploymentRules } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const KEY = 'employment.rules';

@Injectable()
export class EmploymentRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<EmploymentRules> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    return { ...DEFAULT_EMPLOYMENT_RULES, ...((row?.value as Partial<EmploymentRules>) ?? {}) };
  }

  async set(rules: EmploymentRules) {
    const problems = validateEmploymentRules(rules);
    if (problems.length) throw new BadRequestException({ code: 'RULES', message: problems[0] });
    const before = await this.get();
    await this.prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { ...rules } }, update: { value: { ...rules } } });
    await this.audit.record({ action: 'employment.rules_changed', module: 'employment', before, after: rules });
    return rules;
  }
}
