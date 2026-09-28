import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { loadEnv } from '../../core/config/env';

/**
 * Refuses to start a production server whose database holds demo accounts. They all share a
 * password and authenticator secret published in docs/DEMO_ACCOUNTS.md, so on a live system they
 * would be open doors, including Super Admin.
 */
@Injectable()
export class ProductionGuardService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductionGuardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    if (loadEnv().NODE_ENV !== 'production') return;
    const demo = await this.prisma.user.count({ where: { isDemo: true } });
    if (demo > 0) {
      const message = `Refusing to start in production: the database has ${demo} demo accounts, which use a published password and authenticator secret. Use a fresh database seeded for production (see docs/DEPLOYMENT.md).`;
      this.logger.error(message);
      throw new Error(message);
    }
  }
}
