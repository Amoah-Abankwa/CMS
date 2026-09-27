import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface MarketplaceSettings {
  commissionPercent: number;
  unpaidMinutes: number;
}
const KEY = 'marketplace.settings';
const DEFAULTS: MarketplaceSettings = { commissionPercent: 0, unpaidMinutes: 30 };

@Injectable()
export class MarketplaceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<MarketplaceSettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    return { ...DEFAULTS, ...((row?.value as Partial<MarketplaceSettings>) ?? {}) };
  }

  async set(settings: MarketplaceSettings) {
    const before = await this.get();
    await this.prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { ...settings } }, update: { value: { ...settings } } });
    await this.audit.record({ action: 'marketplace.settings_changed', module: 'marketplace', before, after: settings });
    return settings;
  }
}
