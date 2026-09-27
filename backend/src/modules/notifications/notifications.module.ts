import { Global, Module } from '@nestjs/common';
import { MailService } from '../../core/mail/mail.service';
import { SmsService } from '../../core/sms/sms.service';
import { NotificationsService } from './notifications.service';
import { NotificationWorker } from './notification.worker';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [MailService, SmsService, NotificationsService, NotificationWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
