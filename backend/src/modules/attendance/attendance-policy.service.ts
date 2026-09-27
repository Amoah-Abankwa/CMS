import { Injectable } from '@nestjs/common';
import { DEFAULT_ATTENDANCE_POLICY, type AttendancePolicy } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const KEY = 'attendance.policy';

@Injectable()
export class AttendancePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<AttendancePolicy> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    return { ...DEFAULT_ATTENDANCE_POLICY, ...((row?.value as Partial<AttendancePolicy>) ?? {}) };
  }

  async set(policy: AttendancePolicy) {
    const before = await this.get();
    await this.prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { ...policy } }, update: { value: { ...policy } } });
    await this.audit.record({ action: 'attendance.policy_changed', module: 'attendance', before, after: policy });
    return policy;
  }
}
