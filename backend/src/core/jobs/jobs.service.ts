import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { loadEnv } from '../config/env';

export const QUEUES = {
  NOTIFICATION_DELIVER: 'notification-deliver',
  DEVELOPER_ACCESS_EXPIRE: 'developer-access-expire',
  ATTENDANCE_CLOSE_CHECKINS: 'attendance-close-checkins',
  DEVOTION_CLOSE_SERVICES: 'devotion-close-services',
  ACCOMMODATION_EXPIRE_OFFERS: 'accommodation-expire-offers',
  LIBRARY_HOURLY: 'library-hourly',
  FOOD_EXPIRE_UNPAID: 'food-expire-unpaid',
  DISPATCH_MINUTELY: 'dispatch-every-5-minutes',
  EMPLOYMENT_DAILY: 'employment-daily',
  HOUSEKEEPING: 'housekeeping',
  ASSOCIATION_TERMS: 'association-terms',
} as const;

type Handler<T> = (data: T) => Promise<void>;

/** Postgres-backed job queue (pg-boss) on the Supabase database. No Redis, no Docker. */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly boss = new PgBoss({ connectionString: loadEnv().DIRECT_URL, schema: 'pgboss' });
  private readonly pending: Array<() => Promise<unknown>> = [];
  private started = false;

  async onModuleInit() {
    this.boss.on('error', (err) => this.logger.error(err.message));
    await this.boss.start();
    for (const name of Object.values(QUEUES)) await this.boss.createQueue(name);
    this.started = true;
    for (const register of this.pending.splice(0)) await register();
  }

  async onModuleDestroy() {
    await this.boss.stop({ graceful: true });
  }

  async send<T extends object>(queue: string, data: T, options: PgBoss.SendOptions = {}) {
    return this.boss.send(queue, data, { retryLimit: 5, retryBackoff: true, retryDelay: 30, ...options });
  }

  async work<T extends object>(queue: string, handler: Handler<T>) {
    const register = () =>
      this.boss.work<T>(queue, async (jobs) => {
        for (const job of jobs) await handler(job.data);
      });
    if (this.started) await register();
    else this.pending.push(register);
  }

  async schedule(queue: string, cron: string) {
    const register = () => this.boss.schedule(queue, cron, {}, { tz: 'Africa/Accra' });
    if (this.started) await register();
    else this.pending.push(register);
  }
}
