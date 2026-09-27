import { Controller, Get, Header, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuditQueryService } from './audit-query.service';
import { AuditService } from './audit.service';
import { AdminAuditQueryDto, GroupSummaryQueryDto, MyAuditQueryDto } from './dto/audit-query.dto';

@Controller('audit')
export class AuditController {
  constructor(
    private readonly query: AuditQueryService,
    private readonly audit: AuditService,
  ) {}

  /** Every account can see and print its own activity. */
  @Get('me')
  mine(@CurrentUser() user: AuthUser, @Query() q: MyAuditQueryDto) {
    return this.query.list(q, { actorId: user.id });
  }

  @Get('me/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="my-activity.csv"')
  async exportMine(@CurrentUser() user: AuthUser, @Query() q: MyAuditQueryDto) {
    await this.audit.record({ action: 'audit.export.own', module: 'audit', metadata: { filters: { ...q } } });
    return this.query.exportCsv(q, { actorId: user.id });
  }

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ_ALL)
  all(@Query() q: AdminAuditQueryDto) {
    return this.query.list(q);
  }

  @Get('groups')
  @RequirePermission(PERMISSIONS.AUDIT_READ_ALL)
  groups(@Query() q: GroupSummaryQueryDto) {
    return this.query.groupSummary(q.from, q.to);
  }

  @Get('export.csv')
  @RequirePermission(PERMISSIONS.AUDIT_READ_ALL, PERMISSIONS.AUDIT_EXPORT)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="activity-log.csv"')
  async exportAll(@Query() q: AdminAuditQueryDto) {
    await this.audit.record({ action: 'audit.export.all', module: 'audit', metadata: { filters: { ...q } } });
    return this.query.exportCsv(q);
  }
}
