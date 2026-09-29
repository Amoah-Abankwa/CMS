import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_FEE_RULES, validateFeeRules, type FeeRules } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const KEY = 'fees.rules';

@Injectable()
export class FeeRulesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async get(): Promise<FeeRules> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    return { ...DEFAULT_FEE_RULES, ...((row?.value as Partial<FeeRules>) ?? {}) };
  }

  /** Finance: online payment minimums. */
  async setFinance(v: Partial<Pick<FeeRules, 'minOnlinePayment' | 'minOnlinePaymentUsd' | 'lateFeeEnabled' | 'lateFee' | 'lateFeeUsd'>>) {
    return this.set({ ...(await this.get()), ...v });
  }

  /** Registrar: the share of fees paid to be cleared for exams. */
  async setClearance(clearancePercent: number) {
    return this.set({ ...(await this.get()), clearancePercent });
  }

  private async set(rules: FeeRules) {
    const problems = validateFeeRules(rules);
    if (problems.length) throw new BadRequestException({ code: 'RULES', message: problems[0] });
    const before = await this.get();
    await this.prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { ...rules } }, update: { value: { ...rules } } });
    await this.audit.record({ action: 'fees.rules_changed', module: 'fees', before, after: rules });
    return { before, after: rules };
  }
}
