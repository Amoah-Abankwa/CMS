import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { loadEnv } from '../../core/config/env';
import { DEFAULT_TEMPLATES, render, TemplateDefinition } from './templates';

export type Channel = 'IN_APP' | 'EMAIL' | 'SMS';

export interface Recipient {
  userId: string;
  vars?: Record<string, string | number | undefined>;
}

export interface NotifyInput {
  eventKey: string;
  recipients: Recipient[];
  channels: Channel[];
  sharedVars?: Record<string, string | number | undefined>;
  link?: string;
  /** Rendered content is redacted after delivery (temporary passwords, reset codes). */
  sensitive?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  private async template(eventKey: string): Promise<TemplateDefinition> {
    const stored = await this.prisma.notificationTemplate.findUnique({ where: { eventKey } });
    const fallback = DEFAULT_TEMPLATES.find((t) => t.eventKey === eventKey);
    const tpl = stored ?? fallback;
    if (!tpl) throw new Error(`No notification template for ${eventKey}`);
    return tpl;
  }

  /** Records notifications and queues each delivery. Never sends inside the calling request. */
  async notify(input: NotifyInput): Promise<void> {
    const tpl = await this.template(input.eventKey);
    const portalUrl = loadEnv().WEB_ORIGIN;
    const users = await this.prisma.user.findMany({
      where: { id: { in: input.recipients.map((r) => r.userId) } },
      select: { id: true, firstName: true, email: true, phone: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const deliveryIds: string[] = [];

    for (const recipient of input.recipients) {
      const user = byId.get(recipient.userId);
      if (!user) continue;
      const vars = { portalUrl, firstName: user.firstName, ...input.sharedVars, ...recipient.vars };
      const deliveries: Array<{ channel: Channel; destination: string; subject?: string; content: string; sensitive: boolean }> = [];

      if (input.channels.includes('EMAIL') && user.email) {
        deliveries.push({
          channel: 'EMAIL',
          destination: user.email,
          subject: render(tpl.emailSubject, vars),
          content: render(tpl.emailBody, vars),
          sensitive: !!input.sensitive,
        });
      }
      if (input.channels.includes('SMS') && user.phone) {
        deliveries.push({ channel: 'SMS', destination: user.phone, content: render(tpl.smsBody, vars), sensitive: !!input.sensitive });
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId: user.id,
          eventKey: input.eventKey,
          title: render(tpl.inAppTitle, vars),
          body: render(tpl.inAppBody, vars),
          link: input.link,
          // In-app rows are always stored; they are what the bell icon lists.
          deliveries: { create: deliveries },
        },
        include: { deliveries: { select: { id: true } } },
      });
      deliveryIds.push(...notification.deliveries.map((d) => d.id));
    }

    for (const deliveryId of deliveryIds) {
      await this.jobs.send(QUEUES.NOTIFICATION_DELIVER, { deliveryId });
    }
  }

  listMine(userId: string, page: number, pageSize: number) {
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, eventKey: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  failedDeliveries(page: number, pageSize: number) {
    const where = { status: 'FAILED' as const };
    return this.prisma.$transaction([
      this.prisma.notificationDelivery.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, channel: true, destination: true, attempts: true, lastError: true, updatedAt: true, notification: { select: { eventKey: true, userId: true } } },
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);
  }

  async resend(deliveryId: string) {
    const d = await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'QUEUED', lastError: null },
      select: { id: true, content: true },
    });
    if (d.content === '[redacted]') throw new Error('This message contained sensitive data and cannot be resent.');
    await this.jobs.send(QUEUES.NOTIFICATION_DELIVER, { deliveryId });
  }
}
