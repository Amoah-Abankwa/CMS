import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireRecentMfa } from '../../common/decorators/require-recent-mfa.decorator';
import { StaffService } from './staff.service';
import { StaffRolesService } from './staff-roles.service';
import { CreateStaffDto, ListStaffDto, RoleSetDto } from './dto/staff.dto';

@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly roles: StaffRolesService,
  ) {}

  @Get('assignable-roles')
  @RequirePermission(PERMISSIONS.USERS_READ)
  assignableRoles() {
    return this.roles.assignable();
  }

  @Post()
  @RequirePermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE)
  @RequireRecentMfa()
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.USERS_READ)
  list(@Query() q: ListStaffDto) {
    return this.staff.list(q);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USERS_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.staff.get(id);
  }

  @Put(':id/roles')
  @RequirePermission(PERMISSIONS.ROLES_MANAGE)
  @RequireRecentMfa()
  updateRoles(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RoleSetDto) {
    return this.staff.updateRoles(actor, id, dto);
  }

  @Post(':id/resend-setup')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  async resendSetup(@Param('id', ParseUUIDPipe) id: string) {
    await this.staff.resendSetup(id);
    return { ok: true };
  }
}
