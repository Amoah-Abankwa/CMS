import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ExcuseRequestsService } from './excuse-requests.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class RequestDto {
  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;
  @IsIn(['MEDICAL', 'BEREAVEMENT', 'OFFICIAL_DUTY', 'OTHER']) category: 'MEDICAL' | 'BEREAVEMENT' | 'OFFICIAL_DUTY' | 'OTHER';
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(1000) statement: string;
  @IsOptional() @IsUUID() documentId?: string;
}
class DecideDto { @IsBoolean() approve: boolean; @Transform(trim) @IsOptional() @IsString() @MaxLength(500) note?: string; }
class ListQuery { @IsOptional() @IsIn(['REQUESTED', 'APPROVED', 'DECLINED', 'WITHDRAWN']) status?: string; }

@Controller('me/excuse-requests')
export class MyExcuseRequestsController {
  constructor(private readonly requests: ExcuseRequestsService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.requests.mine(u); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: RequestDto) { return this.requests.request(u, dto); }
  @Post(':id/withdraw') @HttpCode(200) withdraw(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.requests.withdraw(u, id); }
}

@Controller('attendance/excuse-requests')
@RequirePermission(PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE)
export class ExcuseRequestsController {
  constructor(private readonly requests: ExcuseRequestsService) {}
  @Get() list(@Query() q: ListQuery) { return this.requests.list(q.status); }
  @Post(':id/decide') @HttpCode(200) decide(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) { return this.requests.decide(u, id, dto.approve, dto.note); }
}
