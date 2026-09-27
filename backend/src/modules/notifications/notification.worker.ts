import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { MailService } from '../../core/mail/mail.service';
import { SmsService } from '../../core/sms/sms.service';

const MAX_ATTEMPTS = 6; // first try + 5 retries

@Injectable()
export class NotificationWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  async onModuleInit() {
    await this.jobs.work<{ deliveryId: string }>(QUEUES.NOTIFICATION_DELIVER, (data) => this.deliver(data.deliveryId));
  }

  private async deliver(deliveryId: string) {
    const d = await this.prisma.notificationDelivery.findUnique({ where: { id: deliveryId } });
    if (!d || d.status === 'SENT' || d.status === 'DELIVERED') return;

    const attempts = d.attempts + 1;
    try {
      const result =
        d.channel === 'EMAIL'
          ? await this.mail.send(d.destination, d.subject ?? 'All Nations University', d.content)
          : await this.sms.send(d.destination, d.content);
      await this.prisma.notificationDelivery.update({
        where: { id: d.id },
        data: {
          status: 'SENT',
          attempts,
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
          lastError: null,
          ...(d.sensitive ? { content: '[redacted]' } : {}),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const final = attempts >= MAX_ATTEMPTS;
      await this.prisma.notificationDelivery.update({
        where: { id: d.id },
        data: {
          status: final ? 'FAILED' : 'QUEUED',
          attempts,
          lastError: message.slice(0, 500),
          ...(final && d.sensitive ? { content: '[redacted]' } : {}),
        },
      });
      this.logger.warn(`Delivery ${d.id} attempt ${attempts} failed: ${message}`);
      if (!final) throw err; // lets pg-boss retry with backoff
    }
  }
}
