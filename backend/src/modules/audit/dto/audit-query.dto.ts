import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { LOG_GROUPS } from '@anu/shared';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class MyAuditQueryDto extends PaginationDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(80) action?: string;
  @IsOptional() @IsString() @MaxLength(40) module?: string;
}

export class AdminAuditQueryDto extends MyAuditQueryDto {
  @IsOptional() @IsIn(Object.values(LOG_GROUPS)) group?: string;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsIn(['SUCCESS', 'FAILURE']) result?: 'SUCCESS' | 'FAILURE';
  @IsOptional() @IsString() @MaxLength(64) ipAddress?: string;
}

export class GroupSummaryQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
