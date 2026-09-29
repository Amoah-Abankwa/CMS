import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireRecentMfa } from '../../common/decorators/require-recent-mfa.decorator';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_RETENTION, RETENTION_KEY, retentionProblems, type RetentionRules } from './retention';

class RetentionDto {
  @Type(() => Number) @IsInt() @Min(30) @Max(3650) notificationsDays: number;
  @Type(() => Number) @IsInt() @Min(30) @Max(3650) deliveriesDays: number;
  @Type(() => Number) @IsInt() @Min(30) @Max(3650) abandonedPaymentsDays: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) activityLogYears?: number | null;
}

/** Records retention periods (Super Admin). */
@Controller('security/retention')
@RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
export class RetentionController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  async get() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: RETENTION_KEY } });
    return { ...DEFAULT_RETENTION, ...((row?.value as Partial<RetentionRules>) ?? {}) };
  }

  @Put() @RequireRecentMfa()
  async set(@Body() dto: RetentionDto) {
    const r: RetentionRules = { ...dto, activityLogYears: dto.activityLogYears ?? null };
    const problems = retentionProblems(r);
    if (problems.length) throw new BadRequestException({ code: 'RETENTION', message: problems.join(' ') });
    const before = await this.get();
    await this.prisma.systemSetting.upsert({ where: { key: RETENTION_KEY }, create: { key: RETENTION_KEY, value: r as never }, update: { value: r as never } });
    await this.audit.record({ action: 'security.retention_changed', module: 'security', before, after: r });
    return r;
  }
}
