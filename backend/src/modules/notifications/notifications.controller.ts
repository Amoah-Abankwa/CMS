import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';
import { AuditService } from '../audit/audit.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async mine(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    const [items, total, unread] = await this.notifications.listMine(user.id, q.page, q.pageSize);
    return { items, total, unread, page: q.page, pageSize: q.pageSize };
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.id);
    return { ok: true };
  }

  @Post(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markRead(user.id, id);
    return { ok: true };
  }

  @Get('failed')
  @RequirePermission(PERMISSIONS.NOTIFICATIONS_FAILED_READ)
  async failed(@Query() q: PaginationDto) {
    const [items, total] = await this.notifications.failedDeliveries(q.page, q.pageSize);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Post('deliveries/:id/resend')
  @RequirePermission(PERMISSIONS.NOTIFICATIONS_FAILED_READ)
  async resend(@Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.resend(id);
    await this.audit.record({ action: 'notification.delivery.resend', module: 'notifications', targetType: 'NotificationDelivery', targetId: id });
    return { ok: true };
  }
}
