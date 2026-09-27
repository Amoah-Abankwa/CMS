import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DevotionPolicyDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) days: number[];
  @Matches(TIME) opensAt: string;
  @Matches(TIME) startsAt: string;
  @Matches(TIME) lateFrom: string;
  @Matches(TIME) endsAt: string;
  @Type(() => Number) @IsNumber() @Min(0.5) @Max(100) totalMarks: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(0.99) lateCredit: number;
}

export class SemesterQuery {
  @IsOptional() @IsUUID() semesterId?: string;
}

export class AddServiceDto {
  @IsDateString() date: string;
  @IsOptional() @IsString() @MaxLength(120) theme?: string;
  @IsOptional() @IsString() @MaxLength(80) speaker?: string;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(120) theme?: string;
  @IsOptional() @IsString() @MaxLength(80) speaker?: string;
}

export class CancelServiceDto {
  @IsString() @MinLength(3) @MaxLength(200) reason: string;
}

export class DoorEntryDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase()) @IsString() @MinLength(8) @MaxLength(20) indexNumber: string;
}

export class CorrectionDto {
  @IsIn(['EARLY', 'LATE', 'ABSENT']) status: 'EARLY' | 'LATE' | 'ABSENT';
  @IsString() @MinLength(5) @MaxLength(200) reason: string;
}

export class RecordsQuery extends PaginationDto {
  @IsOptional() @IsIn(['EARLY', 'LATE', 'ABSENT', 'EXCUSED', 'NONE']) status?: string;
}

export class ScoresQuery extends PaginationDto {
  @IsOptional() @IsUUID() semesterId?: string;
}

export class DevotionCheckInDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
  @Matches(/^[A-Z0-9]{6}$/, { message: 'Enter the 6-character code on the screen.' })
  code: string;
}
