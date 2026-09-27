import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PolicyDto {
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) minimumPercent: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(120) lateAfterMinutes: number;
  @Type(() => Number) @IsInt() @Min(5) @Max(180) checkInMinutes: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) warnAfterSessions: number;
}

export class CreateSessionDto {
  @IsDateString() startsAt: string;
  @Type(() => Number) @IsInt() @Min(30) @Max(480) durationMinutes: number;
  @IsIn(['LECTURE', 'TUTORIAL', 'PRACTICAL']) kind: 'LECTURE' | 'TUTORIAL' | 'PRACTICAL';
  @IsOptional() @IsString() @MaxLength(120) topic?: string;
  @IsOptional() @IsString() @MaxLength(80) venue?: string;
  /** Repeat weekly up to and including this date. */
  @IsOptional() @IsDateString() repeatWeeklyUntil?: string;
}

export class UpdateSessionDto {
  @IsDateString() startsAt: string;
  @Type(() => Number) @IsInt() @Min(30) @Max(480) durationMinutes: number;
  @IsIn(['LECTURE', 'TUTORIAL', 'PRACTICAL']) kind: 'LECTURE' | 'TUTORIAL' | 'PRACTICAL';
  @IsOptional() @IsString() @MaxLength(120) topic?: string;
  @IsOptional() @IsString() @MaxLength(80) venue?: string;
}

export class CancelSessionDto {
  @IsString() @MinLength(3) @MaxLength(200) reason: string;
}

export class RegisterEntryDto {
  @IsUUID() studentId: string;
  @IsIn(['PRESENT', 'LATE', 'ABSENT']) status: 'PRESENT' | 'LATE' | 'ABSENT';
}

export class SaveRegisterDto {
  @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => RegisterEntryDto) entries: RegisterEntryDto[];
}

export class OpenCheckInDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(180) minutes?: number;
}

export class CheckInDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
  @Matches(/^[A-Z0-9]{6}$/, { message: 'Enter the 6-character code on the screen.' })
  code: string;
  @IsOptional() @IsUUID() sessionId?: string;
}

export class ExcuseDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase()) @IsString() @MinLength(8) @MaxLength(20) indexNumber: string;
  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;
  @IsIn(['MEDICAL', 'BEREAVEMENT', 'OFFICIAL_DUTY', 'OTHER']) category: 'MEDICAL' | 'BEREAVEMENT' | 'OFFICIAL_DUTY' | 'OTHER';
  @IsString() @MinLength(5) @MaxLength(500) note: string;
}

export class RevokeExcuseDto {
  @IsString() @MinLength(5) @MaxLength(300) reason: string;
}

export class ReportQuery {
  @IsOptional() @IsUUID() semesterId?: string;
}

export class ExcuseListDto extends PaginationDto {}
