import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireRecentMfa } from '../../common/decorators/require-recent-mfa.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DeveloperAccessService } from './developer-access.service';
import { DisableDeveloperDto, EnableDeveloperDto } from './dto/developer-access.dto';

@Controller('admin/developer-access')
@RequirePermission(PERMISSIONS.DEVELOPER_ACCESS_MANAGE)
export class DeveloperAccessController {
  constructor(private readonly service: DeveloperAccessService) {}

  @Get()
  list(@Query() q: PaginationDto) {
    return this.service.list(q.search);
  }

  @Post('enable')
  @RequireRecentMfa()
  enable(@CurrentUser() actor: AuthUser, @Body() dto: EnableDeveloperDto) {
    return this.service.enable(actor, dto.userId, dto.reason, dto.expiresAt);
  }

  @Post(':userId/disable')
  @RequireRecentMfa()
  disable(@CurrentUser() actor: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: DisableDeveloperDto) {
    return this.service.disable(actor, userId, dto.reason);
  }
}
