import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AmendmentsService } from './amendments.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class RequestDto {
  @IsUUID() resultId: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) caScore: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) examScore: number;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(500) reason: string;
}
class NoteDto {
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) note: string;
}
class ListQuery {
  @IsOptional() @IsIn(['REQUESTED', 'HOD_APPROVED', 'DEAN_APPROVED', 'APPLIED', 'REJECTED']) status?: string;
}
class SearchQuery {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(20) indexNumber?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(20) courseCode?: string;
}

/** Result amendments. Each action checks the person's role and scope in the service. */
@Controller('results/amendments')
export class AmendmentsController {
  constructor(private readonly amendments: AmendmentsService) {}
  @Get('amendable') amendable(@CurrentUser() u: AuthUser, @Query() q: SearchQuery) { return this.amendments.amendable(u, q); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) { return this.amendments.list(u, q.status); }
  @Post() request(@CurrentUser() u: AuthUser, @Body() dto: RequestDto) { return this.amendments.request(u, dto.resultId, dto); }
  @Post(':id/approve') @HttpCode(200) approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.amendments.approve(u, id); }
  @Post(':id/reject') @HttpCode(200) reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) { return this.amendments.reject(u, id, dto.note); }
}
