import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';

const DAY = 86_400_000;

/** Ended sessions are kept this long so "where you are signed in" and investigations can use them. */
export const SESSION_KEEP_DAYS = 90;

/** Used or expired one-time codes and links have no further use. */
export const CODE_KEEP_DAYS = 7;

/**
 * Nightly clean-up of sign-in records that have served their purpose. The activity log is never
 * cleaned up here: how long ANU keeps it is a records-management decision (see docs/SECURITY.md).
 */
@Injectable()
export class HousekeepingService implements OnModuleInit {
  private readonly logger = new Logger(HousekeepingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async onModuleInit() {
    await this.jobs.work(
      QUEUES.HOUSEKEEPING,
      async () => {
        await this.run();
      },
    );

    await this.jobs.schedule(
      QUEUES.HOUSEKEEPING,
      '30 2 * * *',
    );
  }

  async run(now = new Date()) {
    const sessionCutoff = new Date(
      now.getTime() - SESSION_KEEP_DAYS * DAY,
    );

    const codeCutoff = new Date(
      now.getTime() - CODE_KEEP_DAYS * DAY,
    );

    const [sessions, resets, setups] = await Promise.all([
      this.prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: sessionCutoff } },
            { revokedAt: { lt: sessionCutoff } },
          ],
        },
      }),

      this.prisma.passwordResetCode.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: codeCutoff } },
            { usedAt: { lt: codeCutoff } },
          ],
        },
      }),

      this.prisma.accountSetupToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: codeCutoff } },
            { usedAt: { lt: codeCutoff } },
          ],
        },
      }),
    ]);

    this.logger.log(
      `Housekeeping removed ${sessions.count} old sessions, ${resets.count} reset codes, ${setups.count} setup links`,
    );

    return {
      sessions: sessions.count,
      resets: resets.count,
      setups: setups.count,
    };
  }
}