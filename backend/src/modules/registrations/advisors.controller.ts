import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdvisorsService } from './advisors.service';

class DepartmentQuery {
  @IsUUID() departmentId: string;
}

class AssignDto {
  @IsUUID() departmentId: string;
  /** Leave empty to remove these students' advisor. */
  @IsOptional() @IsUUID() advisorId?: string | null;
  @Transform(({ value }) => (typeof value === 'string' ? value.split(/[\s,;]+/) : value)) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) indexNumbers: string[];
}

@Controller('advisors')
@RequirePermission(PERMISSIONS.ADVISORS_ASSIGN)
export class AdvisorsController {
  constructor(private readonly advisors: AdvisorsService) {}
  @Get('departments') departments(@CurrentUser() u: AuthUser) { return this.advisors.departments(u); }
  @Get() department(@CurrentUser() u: AuthUser, @Query() q: DepartmentQuery) { return this.advisors.department(u, q.departmentId); }
  @Post('assign') @HttpCode(200) assign(@CurrentUser() u: AuthUser, @Body() dto: AssignDto) { return this.advisors.assign(u, dto.departmentId, dto.advisorId ?? null, dto.indexNumbers); }
}
