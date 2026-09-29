import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { ComplaintCategory } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class FileDto {
  @IsUUID() hostelId: string;
  @IsIn(['SAFETY', 'CLEANLINESS', 'WATER_POWER', 'OWNER_CONDUCT', 'PRICING', 'OTHER']) category: ComplaintCategory;
  @Transform(trim) @IsString() @MinLength(20) @MaxLength(2000) description: string;
  @IsBoolean() shareName: boolean;
}
class HandleDto { @IsIn(['IN_REVIEW', 'RESOLVED', 'DISMISSED']) status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'; @Transform(trim) @IsOptional() @IsString() @MaxLength(1000) note?: string; }
class RespondDto { @Transform(trim) @IsString() @MinLength(5) @MaxLength(1000) response: string; }
class ListQuery { @IsOptional() @IsIn(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']) status?: string; }

/** Complaints about private hostels. Who may do what (student, Hostel Office, owner) is checked in the service. */
@Controller('hostel-complaints')
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}
  @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.complaints.mine(u); }
  @Post() file(@CurrentUser() u: AuthUser, @Body() dto: FileDto) { return this.complaints.file(u, dto); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) { return this.complaints.list(u, q.status); }
  @Post(':id/handle') @HttpCode(200) handle(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleDto) { return this.complaints.handleChecked(u, id, dto); }
  @Post(':id/respond') @HttpCode(200) respond(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondDto) { return this.complaints.respond(u, id, dto.response); }
}
