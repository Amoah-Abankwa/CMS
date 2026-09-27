import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class SemesterParam {
  @IsOptional() @IsUUID() semesterId?: string;
}

export class VenueDto {
  @Transform(({ value }) => String(value ?? '').trim()) @IsString() @MinLength(2) @MaxLength(80) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5000) capacity: number;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SessionDto {
  @IsUUID() offeringId: string;
  @IsDateString() startsAt: string;
  @Type(() => Number) @IsInt() @Min(15) @Max(480) durationMinutes: number;
  @IsOptional() @IsUUID() venueId?: string | null;
  @IsArray() @ArrayMaxSize(10) @IsUUID('all', { each: true }) invigilatorIds: string[];
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class ClearanceListDto extends PaginationDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsIn(['CLEARED', 'NOT_CLEARED']) status?: 'CLEARED' | 'NOT_CLEARED';
}

export class BulkClearanceDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsArray() @ArrayMaxSize(5000) @IsString({ each: true }) indexNumbers: string[];
  @IsBoolean() cleared: boolean;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class HoldDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase()) @IsString() @MinLength(8) @MaxLength(20) indexNumber: string;
  @IsOptional() @IsUUID() offeringId?: string;
  @IsIn(['DISCIPLINARY', 'ACADEMIC_MISCONDUCT', 'ADMINISTRATIVE', 'OTHER']) category: 'DISCIPLINARY' | 'ACADEMIC_MISCONDUCT' | 'ADMINISTRATIVE' | 'OTHER';
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}

export class LiftHoldDto {
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}

export class EligibilityListDto extends PaginationDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsIn(['NOT_ELIGIBLE', 'ELIGIBLE', 'UNPUBLISHED']) filter?: 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'UNPUBLISHED';
}

export class PolicyDto {
  @IsBoolean() requireFinancialClearance: boolean;
  @IsBoolean() requireMinimumAttendance: boolean;
}

export class OverrideDto {
  @IsIn(['ELIGIBLE', 'NOT_ELIGIBLE']) status: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}
