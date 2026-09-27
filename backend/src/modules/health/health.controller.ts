import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }

  /** Developer role only (while a Super Admin grant is active). Contains no personal data. */
  @Get('system/diagnostics')
  @RequirePermission(PERMISSIONS.SYSTEM_DIAGNOSTICS_READ)
  async diagnostics() {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - started;
    const [queued, failed, sessions] = await Promise.all([
      this.prisma.notificationDelivery.count({ where: { status: 'QUEUED' } }),
      this.prisma.notificationDelivery.count({ where: { status: 'FAILED' } }),
      this.prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    const mem = process.memoryUsage();
    return {
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: { rss: Math.round(mem.rss / 1e6), heapUsed: Math.round(mem.heapUsed / 1e6) },
      dbLatencyMs,
      notifications: { queued, failed },
      activeSessions: sessions,
    };
  }
}
